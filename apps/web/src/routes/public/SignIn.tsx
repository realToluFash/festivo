import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { LanguageChoice } from '../../components/LanguageChoice.tsx';

/**
 * Sign in, drawn from `SignIn-*.dc.html` and NOT yet wired to the API.
 *
 * Pressing the button moves this screen into its own waiting state and nothing
 * else: `api.signIn()` and the token store arrive in the next pass. Everything
 * else here is finished — the four layouts, the states, and the copy in all
 * four languages.
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
  | { kind: 'sessionEnded' };

export function SignIn() {
  const { t } = useTranslation();
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

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              setStatus({ kind: 'signingIn' });
            }}
          >
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
        </section>
      </main>
    </div>
  );
}
