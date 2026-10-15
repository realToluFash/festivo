import { ApiError } from '@soirely/api-client';
import { formatCountdown } from '@soirely/domain';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { LanguageChoice } from '../../components/LanguageChoice.tsx';
import { Pending } from '../../components/Pending.tsx';
import { forgetSession, restoreSession, useSessionState } from '../../session.ts';

type Status =
  | { kind: 'entering' }
  | { kind: 'verifying' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'failed' }
  | { kind: 'verified' };

export function VerifyEmail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useSessionState();

  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status !== 'signedIn') return <Pending />;

  const address = state.session.email;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();

    setStatus({ kind: 'verifying' });

    try {
      await api.verifyEmail(code);
      setStatus({ kind: 'verified' });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendVerification());
      setStatus({ kind: 'entering' });
    } catch (error) {
      const seconds =
        error instanceof ApiError ? Number(error.response?.headers.get('Retry-After')) : NaN;

      if (Number.isFinite(seconds) && seconds > 0) {
        setCooldown(seconds);
        setStatus({ kind: 'entering' });

        return;
      }

      setStatus({ kind: 'failed' });
    }
  }

  async function signOut(): Promise<void> {
    await api.signOut();
    forgetSession();
    navigate('/sign-in');
  }

  const verified = status.kind === 'verified';
  const entering = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">
          <ol className="steps" aria-label={t('verifyEmail.stepsLabel')}>
            <li className={verified ? 'step step-done' : 'step step-now'}>
              <span className="step-mark" aria-hidden="true">
                {verified ? '✓' : '1'}
              </span>
              {verified ? t('verifyEmail.step1Done') : t('verifyEmail.step1')}
            </li>
            <li className="step step-later">
              <span className="step-mark" aria-hidden="true">
                2
              </span>
              {t('verifyEmail.step2')}
            </li>
          </ol>

          {verified ? (
            <>
              <span className="verified-mark" aria-hidden="true">
                ✓
              </span>
              <div>
                <h1>{t('verifyEmail.doneTitle')}</h1>
                <p className="muted">{t('verifyEmail.doneBody', { address })}</p>
              </div>
              <Link className="button button-primary" to="/app">
                {t('verifyEmail.continue')}
              </Link>
            </>
          ) : (
            <>
              <div>
                <h1>{t('verifyEmail.title')}</h1>
                <p className="muted">{t('verifyEmail.intro', { address })}</p>
              </div>

              {status.kind === 'expired' && (
                <Banner
                  title={t('verifyEmail.expiredTitle')}
                  body={t('verifyEmail.expiredBody')}
                  action={t('verifyEmail.resend')}
                  onAction={() => void resend()}
                />
              )}

              {status.kind === 'exhausted' && (
                <Banner
                  title={t('verifyEmail.exhaustedTitle')}
                  body={t('verifyEmail.exhaustedBody')}
                  action={t('verifyEmail.resend')}
                  onAction={() => void resend()}
                />
              )}

              {status.kind === 'failed' && (
                <div className="notice notice-broken" role="alert">
                  <span className="mark mark-broken" aria-hidden="true">
                    ✕
                  </span>
                  <div className="notice-body">
                    <p className="notice-title">{t('verifyEmail.failedTitle')}</p>
                    <p>{t('verifyEmail.failedBody')}</p>
                  </div>
                </div>
              )}

              {entering && (
                <form className="auth-form" onSubmit={(event) => void submit(event)}>
                  <div className="field">
                    <label htmlFor="code">{t('verifyEmail.codeLabel')}</label>
                    <input
                      className={status.kind === 'wrong' ? 'code-input input-wrong' : 'code-input'}
                      id="code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      aria-describedby={status.kind === 'wrong' ? 'code-error' : undefined}
                    />
                    {status.kind === 'wrong' && (
                      <div className="field-error" id="code-error" role="alert">
                        <span className="mark mark-broken" aria-hidden="true">
                          ✕
                        </span>
                        <p>{t('verifyEmail.wrong')}</p>
                      </div>
                    )}
                  </div>

                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={status.kind === 'verifying'}
                  >
                    {status.kind === 'verifying'
                      ? t('verifyEmail.submitting')
                      : t('verifyEmail.submit')}
                  </button>

                  <div className="resend">
                    <button
                      className="button"
                      type="button"
                      disabled={cooldown > 0}
                      onClick={() => void resend()}
                    >
                      {cooldown > 0
                        ? t('verifyEmail.resendIn', { time: formatCountdown(cooldown) })
                        : t('verifyEmail.resend')}
                    </button>
                    <p>{t('verifyEmail.resendNote')}</p>
                  </div>
                </form>
              )}

              <div className="auth-footnote">
                <span>{t('verifyEmail.wrongAddress')}</span>
                <button className="link-button" type="button" onClick={() => void signOut()}>
                  {t('verifyEmail.signOut')}
                </button>
                <p>{t('verifyEmail.wrongAddressBody')}</p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Banner({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <>
      <div className="notice notice-attention" role="alert">
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <div className="notice-body">
          <p className="notice-title">{title}</p>
          <p>{body}</p>
        </div>
      </div>
      <button className="button button-primary" type="button" onClick={onAction}>
        {action}
      </button>
    </>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('verification_code_expired')) return { kind: 'expired' };
  if (error.is('verification_code_exhausted')) return { kind: 'exhausted' };
  if (error.is('verification_code_invalid')) return { kind: 'wrong' };

  return { kind: 'failed' };
}
