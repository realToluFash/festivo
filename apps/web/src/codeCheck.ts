import { ApiError, type PhoneCodeRoute } from '@soirely/api-client';
import { codeWording } from '@soirely/domain';
import { useCallback, useEffect, useState } from 'react';

import { api } from './api.ts';
import { type CodeStatus, codeRefusal, openingStatus } from './codeScreen.ts';

export type Checked =
  { verified: true; primary: boolean } | { verified: false; refusal: CodeStatus };

/** What a resend leaves: a new code on its way, a wait the server named, or nothing sent. */
export type Resent = 'sent' | 'wait' | 'failed';

/** A refused resend that says how long to wait, in seconds; null when it says nothing usable. */
export function retryAfter(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null;

  const seconds = Number(error.response?.headers.get('Retry-After'));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function useCountdown(): { left: number; restart: (seconds: number) => void } {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const tick = setTimeout(() => setLeft((now) => now - 1), 1000);

    return () => clearTimeout(tick);
  }, [left]);

  return { left, restart: setLeft };
}

/** One code check on an address or a number of your own: its opening, the WhatsApp watch, verify, resend and Text it to me instead. */
export function useCodeCheck(kind: 'email' | 'phone', id: string) {
  const email = kind === 'email';
  const [status, setStatus] = useState<CodeStatus>({ kind: 'entering' });
  const [route, setRoute] = useState<PhoneCodeRoute | null>(null);
  const { left: cooldown, restart } = useCountdown();
  const [textingFailed, setTextingFailed] = useState(false);
  const wording = codeWording(route);

  useEffect(() => {
    let live = true;
    const opening = email
      ? api.verificationOpening(id).then((answer) => ({ ...answer, route: null }))
      : api.phoneOpening(id);

    opening
      .then(({ cooldownSeconds, codeState, route: sent }) => {
        if (!live) return;
        restart(cooldownSeconds);
        setRoute(sent);
        setStatus((now) => openingStatus(now, codeState));
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [email, id, restart]);

  // While the code is on WhatsApp, the server may hand it to SMS: the line follows within a few seconds.
  useEffect(() => {
    if (email || !wording.watch) return;

    const watching = setInterval(() => {
      api
        .phoneOpening(id)
        .then((opening) => setRoute(opening.route))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(watching);
  }, [email, wording.watch, id]);

  const verify = useCallback(
    async (code: string): Promise<Checked> => {
      setStatus({ kind: 'verifying' });
      try {
        const { primary } = await (email ? api.verifyEmail(code, id) : api.verifyPhone(code, id));
        setStatus({ kind: 'verified' });

        return { verified: true, primary };
      } catch (error) {
        const refusal = codeRefusal(error);
        setStatus(refusal);

        return { verified: false, refusal };
      }
    },
    [email, id],
  );

  const resend = useCallback(async (): Promise<Resent> => {
    try {
      restart(await (email ? api.resendVerification(id) : api.resendPhoneCode(id)));
      setStatus({ kind: 'entering' });
      if (!email) setRoute((await api.phoneOpening(id)).route);

      return 'sent';
    } catch (error) {
      const seconds = retryAfter(error);

      if (seconds == null) return 'failed';

      restart(seconds);
      setStatus({ kind: 'entering' });

      return 'wait';
    }
  }, [email, id, restart]);

  const textInstead = useCallback(async (): Promise<void> => {
    setTextingFailed(false);

    try {
      await api.textPhoneCodeInstead(id);
      setRoute('sms_chosen');
    } catch {
      setTextingFailed(true);
    }
  }, [id]);

  return { status, cooldown, wording, textingFailed, verify, resend, textInstead };
}
