import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { ApiError } from '@soirely/api-client';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { LanguageChoice } from '../../components/LanguageChoice.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { adoptAccount } from '../../session.ts';

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
  const [status, setStatus] = useState<Status>(
    params.has('signed-out') ? { kind: 'sessionEnded' } : { kind: 'ready' },
  );
  const [revealed, setRevealed] = useState(false);
  const form = useRef<HTMLFormElement>(null);

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

    const typed = new FormData(event.currentTarget);

    setStatus({ kind: 'signingIn' });

    try {
      const { account } = await api.signIn(
        String(typed.get('email') ?? ''),
        String(typed.get('password') ?? ''),
      );

      await adoptAccount(account);

      navigate(account.verified ? '/app' : '/verify-email', { replace: true });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">
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

          <form ref={form} className="auth-form" onSubmit={(event) => void submit(event)}>
            <div className="field">
              <label htmlFor="email">{t('signIn.email')}</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
                required
              />
            </div>

            <div className="field">
              <div className="field-heading">
                <label htmlFor="password">{t('signIn.password')}</label>
              </div>
              <div className="field-reveal">
                <input
                  className={status.kind === 'refused' ? 'input input-wrong' : 'input'}
                  id="password"
                  name="password"
                  type={revealed ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={busy}
                  required
                  aria-describedby={status.kind === 'refused' ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  aria-pressed={revealed}
                  aria-controls="password"
                  onClick={() => setRevealed((shown) => !shown)}
                >
                  {revealed ? t('signIn.conceal') : t('signIn.reveal')}
                </button>
              </div>

              {/* One message for a wrong address and a wrong password, because
                  two messages answer "is this address registered". */}
              {status.kind === 'refused' && (
                <div className="field-error" id="password-error" role="alert">
                  <span className="mark mark-broken" aria-hidden="true">
                    ✕
                  </span>
                  <p>{t('signIn.refused')}</p>
                </div>
              )}
            </div>

            <button className="button button-primary" type="submit" disabled={busy || locked}>
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
        </section>
      </main>
    </div>
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
