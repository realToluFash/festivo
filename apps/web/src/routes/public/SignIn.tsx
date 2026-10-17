import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { ApiError, awaiting } from '@soirely/api-client';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { adoptAccount, landingFor } from '../../session.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { emailMessage, useFormChecks } from '../../formChecks.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'providerFailed'; provider: string }
  | { kind: 'failed' }
  | { kind: 'sessionEnded' };

export function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>(() => {
    const provider = params.get('provider-failed');

    if (provider != null) return { kind: 'providerFailed', provider };

    return params.has('signed-out') ? { kind: 'sessionEnded' } : { kind: 'ready' };
  });
  const form = useRef<HTMLFormElement>(null);
  const checks = useFormChecks(
    ['email', 'password'] as const,
    (field, value) =>
      field === 'email' ? emailMessage(value, t) : value === '' ? t('signIn.passwordBlank') : null,
    (field) => document.getElementById(field)?.focus(),
  );

  const busy = status.kind === 'signingIn';
  const locked = status.kind === 'rateLimited';
  const liftsAt = status.kind === 'rateLimited' ? status.liftsAt : null;

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(
      () => {
        const password = form.current?.elements.namedItem('password');
        if (password instanceof HTMLInputElement) password.value = '';

        setStatus({ kind: 'ready' });
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    // Busy looks busy rather than disabled, as on register; a second press while signing in does nothing.
    if (busy) return;

    const typed = new FormData(event.currentTarget);
    const values = {
      email: String(typed.get('email') ?? '').trim(),
      password: String(typed.get('password') ?? ''),
    };

    if (!checks.passes(values)) return;

    setStatus({ kind: 'signingIn' });

    try {
      const { account } = await api.signIn(values.email, values.password);

      await adoptAccount(account);

      navigate(landingFor(awaiting(account)), { replace: true });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  return (
    <AuthPage>
      <h1>{t('signIn.title')}</h1>

      {status.kind === 'sessionEnded' && (
        <div className="notice notice-quiet" role="status">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('signIn.endedTitle')}</p>
            <p>{t('signIn.endedBody')}</p>
          </div>
        </div>
      )}

      {status.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('signIn.failedTitle')}</p>
            <p>{t('signIn.failedBody')}</p>
          </div>
        </div>
      )}

      {status.kind === 'rateLimited' && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('signIn.lockedTitle')}</p>
            <p>{t('signIn.lockedBody', { time: status.retryAt })}</p>
            <Link className="link-button" to="/forgot-password">
              {t('signIn.lockedReset')}
            </Link>
          </div>
        </div>
      )}

      {status.kind === 'providerFailed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">
              {t('signIn.providerFailedTitle', { provider: status.provider })}
            </p>
            <p>{t('signIn.providerFailedBody', { provider: status.provider })}</p>
          </div>
        </div>
      )}

      <form ref={form} className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="email">{t('signIn.email')}</label>
          <input
            className={checks.errors.email == null ? 'input' : 'input input-wrong'}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            required
            aria-invalid={checks.errors.email != null}
            aria-describedby={checks.errors.email == null ? undefined : 'email-error'}
            onBlur={(event) => checks.left('email', event.target.value)}
            onChange={(event) => checks.edited('email', event.target.value)}
          />
          {checks.errors.email != null && (
            <FieldError id="email-error" message={checks.errors.email} />
          )}
        </div>

        <div className="field">
          <div className="field-heading">
            <label htmlFor="password">{t('signIn.password')}</label>
            <Link className="link-button" to="/forgot-password">
              {t('recovery.forgot')}
            </Link>
          </div>
          <PasswordField
            id="password"
            autoComplete="current-password"
            wrong={status.kind === 'refused' || checks.errors.password != null}
            disabled={busy}
            submitting={busy}
            describedBy={
              status.kind === 'refused' || checks.errors.password != null
                ? 'password-error'
                : undefined
            }
            onBlur={(value) => checks.left('password', value)}
            onChange={(value) => checks.edited('password', value)}
          />

          {/* One message for a wrong address and a wrong password, because
                  two messages answer "is this address registered". */}
          {checks.errors.password != null ? (
            <FieldError id="password-error" message={checks.errors.password} />
          ) : (
            status.kind === 'refused' && (
              <FieldError id="password-error" message={t('signIn.refused')} />
            )
          )}
        </div>

        <button className="button button-primary" type="submit" disabled={locked} aria-busy={busy}>
          {locked
            ? t('signIn.lockedUntil', { time: status.retryAt })
            : busy
              ? t('signIn.submitting')
              : t('signIn.submit')}
        </button>
      </form>

      <ProviderSignIn />

      <div className="auth-footnote">
        <span>{t('signIn.newHere')}</span>
        <Link className="link-button" to="/register">
          {t('signIn.createAccount')}
        </Link>
      </div>
    </AuthPage>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(liftsAt, currentLocale()),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  return { kind: 'failed' };
}
