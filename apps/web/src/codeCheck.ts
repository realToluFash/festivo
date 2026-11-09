import { ApiError, type CodeState, type PhoneCodeRoute } from '@soirely/api-client';
import { codeWording } from '@soirely/domain';
import { useEffect, useState } from 'react';

import { api } from './api.ts';
import { type CodeStatus, codeRefusal, openingStatus } from './codeScreen.ts';
import { useResendCountdown } from './resendCountdown.ts';

export type Checked =
  { verified: true; primary: boolean } | { verified: false; refusal: CodeStatus };

/** What a resend leaves: a new code on its way, a wait the server named, or nothing sent. */
export type Resent = 'sent' | 'wait' | 'failed';

/** Where a code goes and how it is checked: the API's for an address or a number of your own, the demo's sample. */
export interface CodeSource {
  opening: () => Promise<{
    cooldownSeconds: number;
    codeState: CodeState;
    route: PhoneCodeRoute | null;
  }>;
  verify: (code: string) => Promise<{ primary: boolean }>;
  resend: () => Promise<number>;
  textInstead: () => Promise<void>;
}

/** The API's code check on one of your own addresses or numbers. */
export function apiCodeSource(kind: 'email' | 'phone', id: string): CodeSource {
  return kind === 'email'
    ? {
        opening: () => api.verificationOpening(id).then((answer) => ({ ...answer, route: null })),
        verify: (code) => api.verifyEmail(code, id),
        resend: () => api.resendVerification(id),
        textInstead: () => Promise.resolve(),
      }
    : {
        opening: () => api.phoneOpening(id),
        verify: (code) => api.verifyPhone(code, id),
        resend: () => api.resendPhoneCode(id),
        textInstead: () => api.textPhoneCodeInstead(id),
      };
}

/** A refused resend that says how long to wait, in seconds; null when it says nothing usable. */
export function retryAfter(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null;

  const seconds = Number(error.response?.headers.get('Retry-After'));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** One code check: its opening, the WhatsApp watch, verify, Send a new code one at a time, and Text it to me instead. */
export function useCodeCheck(kind: 'email' | 'phone', source: CodeSource) {
  const email = kind === 'email';
  const [status, setStatus] = useState<CodeStatus>({ kind: 'entering' });
  const [route, setRoute] = useState<PhoneCodeRoute | null>(null);
  const [textingFailed, setTextingFailed] = useState(false);
  const resending = useResendCountdown({
    resend: 'verifyEmail.resend',
    resendIn: 'verifyEmail.resendIn',
  });
  const { begin } = resending;
  const wording = codeWording(route);

  useEffect(() => {
    let live = true;

    source
      .opening()
      .then(({ cooldownSeconds, codeState, route: sent }) => {
        if (!live) return;
        begin(cooldownSeconds);
        setRoute(sent);
        setStatus((now) => openingStatus(now, codeState));
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [source, begin]);

  // While the code is on WhatsApp, the server may hand it to SMS: the line follows within a few seconds.
  useEffect(() => {
    if (email || !wording.watch) return;

    const watching = setInterval(() => {
      source
        .opening()
        .then((opening) => setRoute(opening.route))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(watching);
  }, [email, wording.watch, source]);

  async function verify(code: string): Promise<Checked> {
    setStatus({ kind: 'verifying' });
    try {
      const { primary } = await source.verify(code);
      setStatus({ kind: 'verified' });

      return { verified: true, primary };
    } catch (error) {
      const refusal = codeRefusal(error);
      setStatus(refusal);

      return { verified: false, refusal };
    }
  }

  /** Null while one is already on its way: a second press sends nothing. */
  async function resend(): Promise<Resent | null> {
    let resent = null as Resent | null;

    await resending.once(async () => {
      try {
        resending.countDown(await source.resend());
        setStatus({ kind: 'entering' });
        resent = 'sent';
      } catch (error) {
        const seconds = retryAfter(error);
        resent = seconds == null ? 'failed' : 'wait';
        if (seconds == null) return;
        resending.countDown(seconds);
        setStatus({ kind: 'entering' });
      }
    });

    if (resent === 'sent' && !email)
      void source
        .opening()
        .then((opening) => setRoute(opening.route))
        .catch(() => {});

    return resent;
  }

  async function textInstead(): Promise<void> {
    setTextingFailed(false);

    try {
      await source.textInstead();
      setRoute('sms_chosen');
    } catch {
      setTextingFailed(true);
    }
  }

  return { status, resending, wording, textingFailed, verify, resend, textInstead };
}

export type CodeCheck = ReturnType<typeof useCodeCheck>;
