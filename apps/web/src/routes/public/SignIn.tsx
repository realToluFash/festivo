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

/**
 * Sign in, drawn from `SignIn-*.dc.html`.
 *
 * The form posts to `/api/auth/login`, which answers with an access token for
 * memory and a refresh cookie this page cannot read, and then `GET
 * /api/auth/me` says who that is. Both failures the endpoint distinguishes are
 * shown as the design draws them, and no third one is invented: a wrong
 * address and a wrong password are one message, deliberately, because two
 * messages answer "is this address registered".
 *
 * Four sizes, one design. The desktop arrangement is the base and the phone one
 * is the media query in styles.css, because signing in is the one screen that
 * has to work in a phone browser: it is how somebody reaches the app at all,
 * so it cannot sit behind the handoff to the app.
 */
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
  // The one state that arrives rather than happens. Everything that fails to
  // renew a session sends somebody here with this, and the banner says the
  // same thing for all four reasons it could fail: which one it was tells
  // whoever holds a stolen token something, and tells the person who owns the
  // account nothing they can act on.
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
      // Sign-in answers with tokens and not with an account — the endpoint
      // hands out a session, not a profile — so who it belongs to is a second
      // call, and the shell is written against its answer.
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

/**
 * Which refusal this was, in the two cases the API distinguishes.
 *
 * Anything else is one message rather than a guess at the cause: a network
 * that dropped, a proxy answering HTML, a 500. None of those is something the
 * person can act on differently.
 */
function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  if (error.is('too_many_attempts')) {
    const seconds = Number(error.response?.headers.get('Retry-After'));

    // The time comes from the header or not at all. The server also writes it
    // into the problem's detail, in its own wording, and parsing a sentence
    // back into a time is how a locale change breaks a lock screen.
    if (Number.isFinite(seconds) && seconds > 0) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(new Date(Date.now() + seconds * 1000), currentLocale()),
      };
    }
  }

  return { kind: 'failed' };
}
