import { ApiError, type Provider } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type TFunction } from 'i18next';

import { dateLocale } from './i18n/index.ts';
import { PROVIDER_NAMES } from './providerSignIn.ts';

export type ChangeRefusal =
  | { field: 'currentPassword'; message: string }
  | { field: 'newPassword'; message: string }
  | { field: 'paused'; message: string }
  | { field: 'failed'; message: string };

function liftsAt(error: ApiError): Date | null {
  return lockLiftsAt(Number(error.response?.headers.get('Retry-After')));
}

function pausedWords(error: ApiError, t: TFunction): string {
  const until = liftsAt(error);

  return until == null
    ? t('passwordCard.pausedSoon')
    : t('passwordCard.pausedBody', { time: formatTimeOfDay(until, dateLocale()) });
}

/** Change password's refusal, on the field it is about, or with none. */
export function changeRefusal(error: unknown, t: TFunction): ChangeRefusal {
  if (!(error instanceof ApiError))
    return { field: 'failed', message: t('passwordCard.failedBody') };
  if (error.is('invalid_credentials'))
    return { field: 'currentPassword', message: t('passwordCard.wrongCurrent') };
  if (error.is('too_many_attempts')) return { field: 'paused', message: pausedWords(error, t) };

  const violation = error.is('validation_failed')
    ? error.problem.violations?.find((v) => v.propertyPath === 'newPassword')
    : undefined;

  if (violation != null)
    return {
      field: 'newPassword',
      message:
        violation.code === 'password_breached'
          ? t('register.breached')
          : violation.code === 'password_unchanged'
            ? t('passwordCard.same')
            : violation.message,
    };

  return { field: 'failed', message: t('passwordCard.failedBody') };
}

/** Set a password's emailed code, refused: a pause states its time, in the reader's clock. */
export function emailedCodeRefusal(
  error: unknown,
  t: TFunction,
): { refusal: string | null; paused: string | null } {
  if (error instanceof ApiError && error.is('too_many_attempts'))
    return { refusal: null, paused: pausedWords(error, t) };
  if (error instanceof ApiError && error.is('verification_code_expired'))
    return { refusal: t('passwordCard.setCodeExpired'), paused: null };
  if (error instanceof ApiError && error.is('verification_code_exhausted'))
    return { refusal: t('passwordCard.setCodeSpent'), paused: null };
  if (
    error instanceof ApiError &&
    (error.is('verification_code_invalid') || error.is('validation_failed'))
  )
    return { refusal: t('passwordCard.setCodeWrong'), paused: null };

  return { refusal: t('passwordCard.failedBody'), paused: null };
}

/** Choose a password's refusal: a breach or the server's own words, else that it did not save. */
export function chosenRefusal(error: unknown, t: TFunction): string {
  const violation =
    error instanceof ApiError
      ? error.problem.violations?.find((v) => v.propertyPath === 'newPassword')
      : undefined;

  return violation?.code === 'password_breached'
    ? t('register.breached')
    : (violation?.message ?? t('passwordCard.failedBody'));
}

/** The lockout on a two-factor code, in the reader's own clock: the time comes from Retry-After. */
function twoFactorPaused(error: ApiError, t: TFunction): string {
  const until = liftsAt(error);

  return until == null
    ? t('twoFactorCard.failedBody')
    : t('twoFactor.pausedBody', { time: formatTimeOfDay(until, dateLocale()) });
}

/** A code that turns two-factor off or makes new recovery codes, refused. */
export function factorRefusal(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.is('too_many_attempts')) return twoFactorPaused(error, t);
  if (error instanceof ApiError && error.is('recovery_code_used'))
    return t('twoFactor.recoveryUsed');
  if (error instanceof ApiError && error.is('two_factor_code_invalid'))
    return t('twoFactorCard.offWrong');

  return t('twoFactorCard.failedBody');
}

/** Reset your password, refused: a limit states when it lifts, anything else that it did not go. */
export function forgotRefusal(error: unknown, t: TFunction): string {
  const until = error instanceof ApiError && error.is('too_many_attempts') ? liftsAt(error) : null;

  return until == null
    ? t('recovery.failedBody')
    : t('recovery.limitedBody', { time: formatTimeOfDay(until, dateLocale()) });
}

/** Set up two-factor's first code, refused. */
export function setupRefusal(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.is('too_many_attempts')) return twoFactorPaused(error, t);
  if (error instanceof ApiError && error.is('two_factor_code_invalid'))
    return t('twoFactorCard.setupWrong');

  return t('twoFactorCard.failedBody');
}

export type WayRefusal =
  | { kind: 'taken' | 'last'; provider: Provider }
  | { kind: 'keptByRule'; provider: Provider; organisation: string }
  | { kind: 'failed' };

/** Linking or unlinking a way in, refused. */
export function wayRefusal(error: unknown, provider: Provider): WayRefusal {
  if (error instanceof ApiError && error.is('provider_taken')) return { kind: 'taken', provider };
  if (error instanceof ApiError && error.is('last_sign_in_method'))
    return { kind: 'last', provider };
  if (error instanceof ApiError && error.is('provider_kept_by_rule'))
    return { kind: 'keptByRule', provider, organisation: error.problem.organisation ?? '' };

  return { kind: 'failed' };
}

/** A way in's refusal as its notice reads it: what happened, then what to do next. */
export function wayRefusalWords(
  refusal: WayRefusal,
  t: TFunction,
): { title: string; next: string | null } {
  if (refusal.kind === 'failed')
    return { title: t('waysCard.failedTitle'), next: t('waysCard.failedBody') };
  const provider = PROVIDER_NAMES[refusal.provider];
  if (refusal.kind === 'taken')
    return {
      title: t('waysCard.taken', { provider }),
      next: t('waysCard.takenNext', { provider }),
    };
  if (refusal.kind === 'last') return { title: t('waysCard.lastRefused'), next: null };
  const other = PROVIDER_NAMES[refusal.provider === 'google' ? 'apple' : 'google'];

  return {
    title: t('waysCard.keptByRule', { organisation: refusal.organisation }),
    next: t('waysCard.keptByRuleNext', { provider, other }),
  };
}

/** The same refusal as one line under its row; a failure says only that it did not go through. */
export function wayRefusalLine(refusal: WayRefusal, t: TFunction): string {
  const { title, next } = wayRefusalWords(refusal, t);
  if (next == null) return title;

  return refusal.kind === 'failed' ? next : `${title} ${next}`;
}
