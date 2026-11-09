import {
  ApiError,
  type Provider,
  type ProviderSignInAttempt,
  proofRefusal,
} from '@soirely/api-client';
import { formatTimeOfDay } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { dateLocale } from './i18n/index.ts';
import { PROVIDER_NAMES } from './providerSignIn.ts';

export type ProveWith =
  | { password: string }
  | { provider: Provider; signIn: ProviderSignInAttempt }
  | { pendingProof: string };

export type ProvingRefusal = { field: 'password' | 'code' | 'failed'; message: string };

/** What a try that did not prove left, for the drawing to move focus: the code now asked, the provider's sign-in run out, or a refusal. */
export type Unproved =
  | { kind: 'code'; afterProvider: boolean }
  | { kind: 'expired' }
  | { kind: 'refused'; refusal: ProvingRefusal };

/** "Confirm it's you": the password or Google's or Apple's sign-in, then the code, drawn by the card and by the desk's dialog. */
export function useProving({
  via,
  twoFactorOn,
  returned,
  prove,
  onProved,
  onSend,
}: {
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
  returned: ProviderSignInAttempt | null;
  prove: (first: ProveWith, code?: string) => Promise<string>;
  onProved: (proof: string) => void;
  /** Called as each try starts, so focus can be read before the answer; returns what to do once the answer is not a proof. */
  onSend: () => (outcome: Unproved) => void;
}) {
  const { t } = useTranslation();
  // Dropped when the five minutes from the provider's sign-in run out: back to step one, the change kept.
  const [signIn, setSignIn] = useState(returned);
  const [expired, setExpired] = useState(false);
  const [refusal, setRefusal] = useState<ProvingRefusal | null>(null);
  const [checking, setChecking] = useState(false);
  // Turned on in the two-factor card since this page loaded: the API says so, and the field appears.
  const [codeAsked, setCodeAsked] = useState(twoFactorOn);
  // Step two after Google or Apple: the sign-in passed and the code is asked for (sc-2197).
  const [vouched, setVouched] = useState<{ email: string | null } | null>(null);
  // The API's kept proof once a sign-in waits for its code: Google's or Apple's is single-use (RFC 6749 §4.1.2).
  const kept = useRef<string | null>(null);
  const provider = via === 'password' ? null : via;
  const askPassword = via === 'password' && signIn == null;

  async function send(password: string, second: string | undefined): Promise<void> {
    setChecking(true);
    const after = onSend();

    try {
      const proof = await prove(
        kept.current != null
          ? { pendingProof: kept.current }
          : signIn != null && provider != null
            ? { provider, signIn }
            : { password },
        second,
      );
      onProved(proof);
    } catch (error) {
      setChecking(false);

      if (error instanceof ApiError && error.is('two_factor_required')) {
        if (signIn != null) {
          kept.current = error.problem.pendingProof ?? kept.current;
          const email = error.problem.providerEmail ?? null;
          setVouched((now) => now ?? { email });
        }
        // The field the answer asks for, once it is there to take focus.
        flushSync(() => setCodeAsked(true));
        after({ kind: 'code', afterProvider: signIn != null });

        return;
      }

      if (signIn != null && error instanceof ApiError && error.is('proof_required')) {
        setSignIn(null);
        kept.current = null;
        setVouched(null);
        setRefusal(null);
        setExpired(true);
        after({ kind: 'expired' });

        return;
      }

      if (signIn != null && error instanceof ApiError)
        kept.current = error.problem.pendingProof ?? kept.current;
      const refused = provingRefusal(
        error,
        t,
        signIn != null && provider != null ? PROVIDER_NAMES[provider] : null,
      );
      setRefusal(refused);
      after({ kind: 'refused', refusal: refused });
    }
  }

  // Google's or Apple's sign-in is exchanged the moment it returns: the five minutes count from it, not the code.
  const exchanged = useRef(false);

  useEffect(() => {
    if (signIn == null || exchanged.current) return;
    exchanged.current = true;
    void send('', undefined);
    // Once, on arrival: what came back from the provider is taken then and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepTwo = vouched != null && signIn != null ? provider : null;

  return {
    signIn,
    expired,
    refusal,
    setRefusal,
    checking,
    codeAsked,
    vouched,
    provider,
    askPassword,
    stepTwo,
    send,
  };
}

function provingRefusal(error: unknown, t: TFunction, providerName: string | null): ProvingRefusal {
  const refusal = proofRefusal(error, providerName == null);

  if (refusal.kind === 'trip')
    return { field: 'failed', message: t('waysCard.providerRefused', { provider: providerName }) };
  if (refusal.kind === 'limited')
    return {
      field: 'failed',
      message:
        refusal.until == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(refusal.until, dateLocale()) }),
    };
  if (refusal.kind === 'field')
    return {
      field: refusal.field,
      message: refusal.field === 'password' ? t('waysCard.passwordWrong') : t('waysCard.codeWrong'),
    };

  return { field: 'failed', message: t('waysCard.failedBody') };
}
