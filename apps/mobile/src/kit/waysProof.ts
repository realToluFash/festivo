import { ApiError, proofRefusal } from '@soirely/api-client';
import { formatTimeOfDay, type proveWith } from '@soirely/domain';
import { type TFunction } from 'i18next';

export type ProvingField = 'password' | 'code';

/** Only beside a password: with Google or Apple, the code is asked for when it returns, never before the trip (sc-510). */
export function codeBeforeTrip(via: ReturnType<typeof proveWith>, twoFactorOn: boolean): boolean {
  return twoFactorOn && via === 'password';
}

/** A refusal of the trip itself (the wrong account, or a sign-in too old): only then is it made again. */
export function tripRefused(error: unknown): boolean {
  return error instanceof ApiError && error.is('invalid_credentials');
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
  if (providerName != null && error instanceof ApiError && error.is('invalid_credentials'))
    return { field: 'failed', message: t('waysCard.providerRefused', { provider: providerName }) };

  return { field: 'failed', message: t('waysCard.failedBody') };
}
