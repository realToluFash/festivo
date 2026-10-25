import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { emailMessage, useFormChecks } from '../../formChecks.ts';
import { dateLocale } from '../../i18n/index.ts';

type Status =
  | { kind: 'asking' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'limited'; time: string }
  | { kind: 'failed' };

/** "Reset your password": an address in, and the same answer whether or not it has an account. */
export function ForgotPassword() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'asking' });
  const checks = useFormChecks(
    ['email'] as const,
    (_field, value) => emailMessage(value, t),
    () => document.getElementById('email')?.focus(),
  );

  async function send(email: string): Promise<void> {
    setStatus({ kind: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (status.kind === 'sending') return;

    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!checks.passes({ email })) return;

    void send(email);
  }

  if (status.kind === 'sent') {
    return (
      <AuthPage>
        <div className="auth-heading">
          <h1>{t('recovery.sentTitle')}</h1>
          <p>{t('recovery.sentBody')}</p>
        </div>

        <div className="notice notice-quiet">
          <div className="notice-body">
            <p className="notice-title">{t('recovery.nothingTitle')}</p>
            <p>{t('recovery.nothingBody')}</p>
            <p className="notice-action">
              <button className="link-button" type="button" onClick={() => void send(status.email)}>
                {t('recovery.sendAgain')}
              </button>
            </p>
          </div>
        </div>

        <p className="field-help">{t('recovery.providerNote')}</p>

        <div className="auth-footnote">
          <span>{t('recovery.gotIt')}</span>
          <Link className="link-button" to="/sign-in">
            {t('recovery.backToSignIn')}
          </Link>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <div className="auth-heading">
        <h1>{t('recovery.title')}</h1>
        <p>{t('recovery.intro')}</p>
      </div>

      {status.kind === 'limited' && (
        <div className="notice notice-attention" role="alert">
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
        <div className="notice notice-broken" role="alert">
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
            disabled={status.kind === 'sending'}
            aria-invalid={checks.errors.email != null}
            aria-describedby={checks.errors.email == null ? undefined : 'email-error'}
            onBlur={(event) => checks.left('email', event.target.value)}
            onChange={(event) => checks.edited('email', event.target.value)}
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

      <div className="auth-footnote">
        <span>{t('recovery.remembered')}</span>
        <Link className="link-button" to="/sign-in">
          {t('recovery.signIn')}
        </Link>
      </div>
    </AuthPage>
  );
}

function refusalFrom(error: unknown): Status {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) return { kind: 'limited', time: formatTimeOfDay(liftsAt, dateLocale()) };
  }

  return { kind: 'failed' };
}
