import type { PhoneCodeRoute } from '@soirely/api-client';
import { codeWording } from '@soirely/domain';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api.ts';
import { type CodeStatus, codeRefusal, openingStatus, retryAfter } from '../kit/code.ts';
import { useCountdown } from './useCountdown.ts';

export type CheckStatus = CodeStatus | { kind: 'verified'; tapped?: boolean };

export type Checked =
  { verified: true; primary: boolean } | { verified: false; refusal: CodeStatus };

/** What a resend leaves: a new code on its way, a wait the server named, or nothing sent. */
export type Resent = 'sent' | 'wait' | 'failed';

/** One code check on an address or a number: its opening, the WhatsApp watch, verify, resend and Text it to me instead. */
export function useCodeCheck(kind: 'email' | 'phone', id: string | undefined) {
  const email = kind === 'email';
  const [status, setStatus] = useState<CheckStatus>({ kind: 'entering' });
  const [route, setRoute] = useState<PhoneCodeRoute | null>(null);
  const { left: cooldown, restart } = useCountdown(0);
  // A new one with each failed tap, so the same words are read out again.
  const [textingFailed, setTextingFailed] = useState<object | null>(null);
  const [textedByTap, setTextedByTap] = useState<object | undefined>(undefined);
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
        setStatus((now) => (now.kind === 'verified' ? now : openingStatus(now, codeState)));
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
      try {
        const { primary } = await (email ? api.verifyEmail(code, id) : api.verifyPhone(code, id));
        setStatus({ kind: 'verified', tapped: true });

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

      if (seconds == null) {
        setStatus({ kind: 'failed' });

        return 'failed';
      }

      restart(seconds);
      setStatus({ kind: 'entering' });

      return 'wait';
    }
  }, [email, id, restart]);

  const textInstead = useCallback(async (): Promise<void> => {
    setTextingFailed(null);
    setTextedByTap({});

    try {
      await api.textPhoneCodeInstead(id);
      setRoute('sms_chosen');
    } catch {
      setTextedByTap(undefined);
      setTextingFailed({});
    }
  }, [id]);

  return {
    status,
    setStatus,
    cooldown,
    wording,
    textingFailed,
    textedByTap,
    verify,
    resend,
    textInstead,
  };
}
