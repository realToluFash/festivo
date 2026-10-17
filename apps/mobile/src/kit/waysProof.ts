import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt, type proveWith } from '@soirely/domain';
import { type TFunction } from 'i18next';

export type ProvingField = 'password' | 'code';

/** Only beside a password: with Google or Apple, the code is asked for when it returns, never before the trip (sc-510). */
export function codeBeforeTrip(via: ReturnType<typeof proveWith>, twoFactorOn: boolean): boolean {
  return twoFactorOn && via === 'password';
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

  if (error instanceof ApiError && error.is('invalid_credentials')) {
    return providerName == null
      ? { field: 'password', message: t('waysCard.passwordWrong') }
      : { field: 'failed', message: t('waysCard.providerFailed', { provider: providerName }) };
  }

  if (
    error instanceof ApiError &&
    (error.is('two_factor_code_invalid') || error.is('recovery_code_used'))
  )
    return { field: 'code', message: t('waysCard.codeWrong') };

  return { field: 'failed', message: t('waysCard.failedBody') };
}
