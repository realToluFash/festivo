import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type TFunction } from 'i18next';

export interface PasswordRefusal {
  field: 'currentPassword' | 'newPassword' | 'paused' | 'failed';
  message: string;
}

/** Each refusal under the field it is about; the pause states its time, in the reader's clock. */
export function passwordRefusal(error: unknown, t: TFunction, locale: string): PasswordRefusal {
  if (!(error instanceof ApiError))
    return { field: 'failed', message: t('passwordCard.failedBody') };

  if (error.is('invalid_credentials')) {
    return { field: 'currentPassword', message: t('passwordCard.wrongCurrent') };
  }

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    return {
      field: 'paused',
      message:
        liftsAt == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(liftsAt, locale) }),
    };
  }

  const violation = error.is('validation_failed')
    ? error.problem.violations?.find((v) => v.propertyPath === 'newPassword')
    : undefined;

  if (violation != null) {
    return {
      field: 'newPassword',
      message:
        violation.code === 'password_breached'
          ? t('register.breached')
          : violation.code === 'password_unchanged'
            ? t('passwordCard.same')
            : violation.message,
    };
  }

  return { field: 'failed', message: t('passwordCard.failedBody') };
}
