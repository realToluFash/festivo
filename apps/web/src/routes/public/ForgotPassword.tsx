import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { api } from '../../api.ts';
import type { AuthBackTo } from '../../components/AuthBack.tsx';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { emailMessage, useFormChecks } from '../../formChecks.ts';
import { dateLocale } from '../../i18n/index.ts';
import type { ForgotFrom } from '../../forgotFrom.ts';
import { useStepFocus } from '../../stepFocus.ts';
import { offField } from '../../offField.ts';

type Status =
  | { kind: 'asking' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'limited'; time: string; again: boolean }
  | { kind: 'failed'; again: boolean };

/** "Reset your password": an address in, and the same answer whether or not it has an account. */
export function ForgotPassword() {
  const { t } = useTranslation();
  const from = (useLocation().state as ForgotFrom)?.back;
  const [status, setStatus] = useState<Status>({ kind: 'asking' });
  const [typed, setTyped] = useState('');
  const [sentHeading, arriveAtSent] = useStepFocus();
  const [refusedNotice, arriveAtRefused] = useStepFocus<HTMLDivElement>();
  const checks = useFormChecks(
    ['email'] as const,
    (_field, value) => emailMessage(value, t),
    () => document.getElementById('email')?.focus(),
  );

  async function send(email: string, again: boolean): Promise<void> {
    setStatus({ kind: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email });
      arriveAtSent();
    } catch (error) {
      setStatus(refusalFrom(error, again));
      if (again) arriveAtRefused();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (status.kind === 'sending') return;

    const email = typed.trim();
    if (!checks.passes({ email })) return;

    void send(email, false);
  }

  const back: AuthBackTo =
    from == null
      ? { label: t('signIn.title'), heard: t('twoFactor.back'), fallback: '/sign-in' }
      : { label: t(BACK_TITLE[from]) };

  if (status.kind === 'sent') {
    return (
      <AuthPage even back={back}>
        <div className="auth-heading">
          <h1 ref={sentHeading} tabIndex={-1}>
            {t('recovery.sentTitle')}
          </h1>
          <p>{t('recovery.sentBody')}</p>
        </div>

        <div className="notice notice-plain">
          <div className="notice-body">
            <p className="notice-title">{t('recovery.nothingTitle')}</p>
            <p>{t('recovery.nothingBody')}</p>
            <p className="notice-action">
              <button
                className="link-button"
                type="button"
                onClick={() => void send(status.email, true)}
              >
                {t('recovery.sendAgain')}
              </button>
            </p>
          </div>
        </div>

        <p className="field-help">{t('recovery.providerNote')}</p>

        <div className="auth-footnote auth-footnote-plain auth-footnote-centred">
          <span>{t('recovery.gotIt')}</span>
          <Link className="link-button" to="/sign-in">
            {t('recovery.backToSignIn')}
          </Link>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage even back={back}>
      <div className="auth-heading">
        <h1>{t('recovery.title')}</h1>
        <p>{t('recovery.intro')}</p>
      </div>

      {status.kind === 'limited' && (
        <div
          className="notice notice-attention"
          role={status.again ? undefined : 'alert'}
          ref={refusedNotice}
          tabIndex={status.again ? -1 : undefined}
        >
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('recovery.limitedTitle')}</p>
            <p>{t('recovery.limitedBody', { time: status.time })}</p>
          </div>
        </div>
      )}

      {status.kind === 'failed' && (
        <div
          className="notice notice-broken"
          role={status.again ? undefined : 'alert'}
          ref={refusedNotice}
          tabIndex={status.again ? -1 : undefined}
        >
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('recovery.failedTitle')}</p>
            <p>{t('recovery.failedBody')}</p>
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">{t('recovery.email')}</label>
          <input
            className={checks.errors.email == null ? 'input' : 'input input-wrong'}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={typed}
            {...offField(status.kind === 'sending')}
            aria-invalid={checks.errors.email != null}
            aria-describedby={checks.errors.email == null ? undefined : 'email-error'}
            onBlur={(event) => checks.left('email', event.target.value)}
            onChange={(event) => {
              setTyped(event.target.value);
              checks.edited('email', event.target.value);
            }}
          />
          {checks.errors.email != null && (
            <FieldError id="email-error" message={checks.errors.email} />
          )}
        </div>

        <button
          className="button button-primary"
          type="submit"
          aria-busy={status.kind === 'sending'}
        >
          {status.kind === 'sending' ? t('recovery.sending') : t('recovery.send')}
        </button>
      </form>

      <div className="auth-footnote auth-footnote-plain auth-footnote-centred">
        <span>{t('recovery.remembered')}</span>
        <Link className="link-button" to="/sign-in">
          {t('recovery.signIn')}
        </Link>
      </div>
    </AuthPage>
  );
}

const BACK_TITLE = {
  code: 'twoFactor.title',
  used: 'recovery.usedTitle',
  expired: 'recovery.expiredTitle',
  invalid: 'recovery.invalidTitle',
  account: 'account.title',
  join: 'join.emailTakenTitle',
} as const;

function refusalFrom(error: unknown, again: boolean): Status {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return { kind: 'limited', time: formatTimeOfDay(liftsAt, dateLocale()), again };
    }
  }

  return { kind: 'failed', again };
}
