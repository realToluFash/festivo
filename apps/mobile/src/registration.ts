import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';

export type RegistrationStatus =
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'refused'; fields: RegistrationFieldErrors }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'failed' };

/** The refusal the design words, or the API's own translated message. */
export type RegistrationFieldError = 'breached' | { message: string };
export type RegistrationFieldErrors = Partial<
  Record<'name' | 'email' | 'password', RegistrationFieldError>
>;

export function registrationRefusal(error: unknown, locale: string): RegistrationStatus {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(liftsAt, locale),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  if (error.is('validation_failed')) {
    const fields: RegistrationFieldErrors = {};

    for (const { propertyPath, code, message } of error.problem.violations ?? []) {
      if (propertyPath !== 'name' && propertyPath !== 'email' && propertyPath !== 'password') {
        continue;
      }

      fields[propertyPath] ??= code === 'password_breached' ? 'breached' : { message };
    }

    return { kind: 'refused', fields };
  }

  return { kind: 'failed' };
}
