import {
  ApiError,
  type Provider,
  type ProviderSignInAttempt,
  proofRefusal,
} from '@soirely/api-client';
import { PROOF_MINUTES, formatTimeOfDay, type proveWith } from '@soirely/domain';
import { type TFunction } from 'i18next';

export type ProvingField = 'password' | 'code';

/** Step one's lead line, which counts the proof window rather than naming a number (sc-2197). */
export function proveIntro(t: TFunction, action: 'link' | 'unlink', provider: string): string {
  return action === 'link'
    ? t('waysCard.proveLink', { provider, count: PROOF_MINUTES })
    : t('waysCard.proveUnlink', { provider, count: PROOF_MINUTES });
}

/** Under the code field; on step two after a provider, the line that says a wrong code keeps the sign-in too. */
export function codeHelp(t: TFunction, stepTwo: string | null): string | string[] {
  return stepTwo == null
    ? t('waysCard.codeHelp')
    : [
        t('waysCard.codeHelp'),
        t('waysCard.codeKeepsSignIn', { provider: stepTwo, count: PROOF_MINUTES }),
      ];
}

/** Only beside a password: with Google or Apple, the code is asked for when it returns, never before the trip (sc-510). */
export function codeBeforeTrip(via: ReturnType<typeof proveWith>, twoFactorOn: boolean): boolean {
  return twoFactorOn && via === 'password';
}

/** A refusal of the trip itself (the wrong account, a sign-in too old, or a kept one lapsed): only then is it made again. */
export function tripRefused(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.is('invalid_credentials') || error.is('proof_required'))
  );
}

/** What the next Continue sends first: the API's kept proof once it has one, as a provider's sign-in is single-use. */
export function keptProof(error: unknown, kept: string | null): string | null {
  if (tripRefused(error)) return null;

  return error instanceof ApiError ? (error.problem.pendingProof ?? kept) : kept;
}

/** The kept proof once the sign-in waits for its code: a password is sent again, a provider's sign-in never is. */
export function keptOnceCodeAsked(
  via: ReturnType<typeof proveWith>,
  error: unknown,
  kept: string | null,
): string | null {
  return via === 'password' ? null : keptProof(error, kept);
}

/** What Continue sends as the first factor: the kept proof, else the provider's sign-in, else the password. */
export function firstFactor(
  via: ReturnType<typeof proveWith>,
  kept: string | null,
  signIn: ProviderSignInAttempt | null,
  password: string,
):
  | { pendingProof: string }
  | { provider: Provider; signIn: ProviderSignInAttempt }
  | { password: string } {
  if (kept != null) return { pendingProof: kept };
  if (via === 'password' || via == null || signIn == null) return { password };

  return { provider: via, signIn };
}

export interface SignedIn {
  email: string | null;
}

/** Step two's status box (sc-2197): kept across a wrong code, gone once the trip has to be made again. */
export function signedInWith(
  via: ReturnType<typeof proveWith>,
  error: unknown,
  now: SignedIn | null,
): SignedIn | null {
  if (via === 'password' || via == null || tripRefused(error)) return null;
  if (error instanceof ApiError && error.is('two_factor_required'))
    return now ?? { email: error.problem.providerEmail ?? null };

  return now;
}

/** The five minutes from the provider's sign-in ran out at step two: back to step one, the change kept (sc-510). */
export function keptProofRanOut(error: unknown, sentKept: boolean): boolean {
  return sentKept && error instanceof ApiError && error.is('proof_required');
}

/** Where a refused proof is said: a provider's refusal is the trip's, never a password field the screen doesn't show. */
export function provingRefusal(
  error: unknown,
  t: TFunction,
  providerName: string | null,
  locale: string,
): { field: ProvingField | 'failed'; message: string } {
  const refusal = proofRefusal(error, providerName == null);

  if (refusal.kind === 'limited')
    return {
      field: 'failed',
      message:
        refusal.until == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(refusal.until, locale) }),
    };
  if (refusal.kind === 'field')
    return {
      field: refusal.field,
      message: refusal.field === 'password' ? t('waysCard.passwordWrong') : t('waysCard.codeWrong'),
    };
  if (refusal.kind === 'trip')
    return { field: 'failed', message: t('waysCard.providerRefused', { provider: providerName }) };

  return { field: 'failed', message: t('waysCard.failedBody') };
}
