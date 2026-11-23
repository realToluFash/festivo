import {
  ApiError,
  type Provider,
  ProviderCancelled,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type ProvingField,
  codeBeforeTrip,
  firstFactor,
  keptOnceCodeAsked,
  keptProofRanOut,
  provingRefusal,
  type SignedIn,
  signedInWith,
  tripRefused,
} from '../kit/waysProof.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { holdProof } from '../recentProof.ts';
import { keysStayDown } from './Field.tsx';

export type ProofRefusal = { field: ProvingField | 'failed'; message: string; until?: Date | null };

export type ProofOutcome =
  | { kind: 'proved'; proof: string; codeSpent: boolean }
  | { kind: 'cancelled' | 'codeAsked' | 'expired' }
  | { kind: 'refused'; refusal: ProofRefusal };

/** Proving it is you with the password, or Google or Apple on the spot, then the code with two-factor on (sc-510). */
export function useProof(via: 'password' | Provider | null, twoFactorOn: boolean) {
  const { t } = useTranslation();
  // With a provider, the code is asked for when it returns, never before the trip (a code lapses in 30 seconds).
  const [codeAsked, setCodeAsked] = useState(codeBeforeTrip(via, twoFactorOn));
  const returned = useRef<ProviderSignInAttempt | null>(null);
  const kept = useRef<string | null>(null);
  const [expired, setExpired] = useState<object | null>(null);
  const [signedIn, setSignedIn] = useState<SignedIn | null>(null);
  const [checking, setChecking] = useState(false);
  const [refusal, setRefusal] = useState<ProofRefusal | null>(null);

  async function submit(password: string, code: string): Promise<ProofOutcome> {
    keysStayDown();
    setChecking(true);
    setRefusal(null);
    setExpired(null);
    const sentKept = kept.current != null;

    try {
      if (via !== 'password' && via != null && kept.current == null)
        returned.current ??= await confirmWithProvider(via, true);

      const first = firstFactor(via, kept.current, returned.current, password);
      const proved = await api.prove(first, codeAsked ? code.trim() : undefined);
      holdProof(proved);

      return { kind: 'proved', proof: proved.proof, codeSpent: codeAsked };
    } catch (error) {
      setChecking(false);

      if (error instanceof ProviderCancelled) return { kind: 'cancelled' };
      setSignedIn((now) => signedInWith(via, error, now));
      // The sign-in passed and waits for its code: the retry sends the API's kept proof, dated from the sign-in.
      if (error instanceof ApiError && error.is('two_factor_required')) {
        kept.current = keptOnceCodeAsked(via, error, kept.current);
        setCodeAsked(true);

        return { kind: 'codeAsked' };
      }

      if (via !== 'password' && keptProofRanOut(error, sentKept)) {
        kept.current = null;
        returned.current = null;
        setCodeAsked(codeBeforeTrip(via, twoFactorOn));
        setExpired({});

        return { kind: 'expired' };
      }

      const said = provingRefusal(
        error,
        t,
        via === 'password' || via == null ? null : PROVIDER_NAMES[via],
        dateLocale(),
      );
      // A refused trip, or one limited before the code step, is made again: after a wrong code the next Continue sends the API's kept proof.
      kept.current = keptOnceCodeAsked(via, error, kept.current);
      if (via !== 'password' && (tripRefused(error) || ('until' in said && !codeAsked)))
        returned.current = null;
      setRefusal(said);

      return { kind: 'refused', refusal: said };
    }
  }

  return { codeAsked, expired, signedIn, checking, refusal, setRefusal, submit };
}
