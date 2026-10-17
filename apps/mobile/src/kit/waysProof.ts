import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt, type proveWith } from '@soirely/domain';
import { type TFunction } from 'i18next';

export type ProvingField = 'password' | 'code';

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
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    return {
      field: 'failed',
      message:
        liftsAt == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(liftsAt, locale) }),
    };
  }

  if (
    error instanceof ApiError &&
    (error.is('invalid_credentials') || error.is('proof_required'))
  ) {
    return providerName == null
      ? { field: 'password', message: t('waysCard.passwordWrong') }
      : { field: 'failed', message: t('waysCard.providerRefused', { provider: providerName }) };
  }

  if (
    error instanceof ApiError &&
    (error.is('two_factor_code_invalid') || error.is('recovery_code_used'))
  )
    return { field: 'code', message: t('waysCard.codeWrong') };

  return { field: 'failed', message: t('waysCard.failedBody') };
}
