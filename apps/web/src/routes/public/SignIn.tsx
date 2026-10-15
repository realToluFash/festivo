import { formatTimeOfDay } from '@soirely/domain';
import { ApiError } from '@soirely/api-client';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { LanguageChoice } from '../../components/LanguageChoice.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { adoptAccount } from '../../session.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string }
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

  const busy = status.kind === 'signingIn';
  const locked = status.kind === 'rateLimited';

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setStatus({ kind: 'signingIn' });

    try {
      await api.signIn(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
      adoptAccount(await api.me());
      navigate('/app', { replace: true });
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

          <form className="auth-form" onSubmit={(event) => void submit(event)}>
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
        </section>
      </main>
    </div>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  if (error.is('too_many_attempts')) {
    const seconds = Number(error.response?.headers.get('Retry-After'));

    if (Number.isFinite(seconds) && seconds > 0) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(new Date(Date.now() + seconds * 1000), currentLocale()),
      };
    }
  }

  return { kind: 'failed' };
}
