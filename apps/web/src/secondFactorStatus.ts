import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';

import { dateLocale } from './i18n/index.ts';

export type Mode = 'passkey' | 'app' | 'recovery';

export type SecondFactorStatus =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'wrong'; message: string }
  | { kind: 'waiting' }
  | { kind: 'refused' }
  | { kind: 'paused'; time: string; liftsAt: number }
  | { kind: 'failed' };

/** What a refused second factor leaves the step showing: paused, wrong, or failed. */
export function statusFrom(
  refusal: unknown,
  mode: Mode,
  t: (key: string) => string,
): SecondFactorStatus {
  if (!(refusal instanceof ApiError)) return { kind: 'failed' };

  if (refusal.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'paused',
        time: formatTimeOfDay(liftsAt, dateLocale()),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  if (refusal.is('recovery_code_used'))
    return { kind: 'wrong', message: t('twoFactor.recoveryUsed') };

  if (refusal.is('two_factor_code_invalid')) {
    return {
      kind: 'wrong',
      message: mode === 'app' ? t('twoFactor.codeWrong') : t('twoFactor.recoveryWrong'),
    };
  }

  return { kind: 'failed' };
}
