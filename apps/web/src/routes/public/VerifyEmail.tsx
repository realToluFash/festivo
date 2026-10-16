import { ApiError } from '@soirely/api-client';
import { cleanCode, codeProblem, formatCountdown } from '@soirely/domain';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { Pending } from '../../components/Pending.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { forgetSession, refreshAccount, restoreSession, useSessionState } from '../../session.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { useFormChecks } from '../../formChecks.ts';

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
  const checks = useFormChecks(
    ['code'] as const,
    (_field, value) => {
      const problem = codeProblem(value);

      if (problem == null) return null;

      return problem === 'blank' ? t('verifyEmail.codeBlank') : t('verifyEmail.codeShort');
    },
    () => document.getElementById('code')?.focus(),
  );

  useEffect(() => {
    void restoreSession();
  }, []);

  const unverified = state.status === 'signedIn' && !state.session.verified;

  useEffect(() => {
    if (!unverified) return;

    let live = true;

    // A failed read leaves the button enabled; a press then learns the time from the 429.
    api
      .verificationCooldown()
      .then((seconds) => {
        if (live) setCooldown(seconds);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [unverified]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status === 'unreachable') return <Unreachable />;
  if (state.status !== 'signedIn') return <Pending />;

  const address = state.session.email;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = String(new FormData(event.currentTarget).get('code') ?? '');

    // Neither an empty code nor a short one is sent, so neither costs an attempt.
    if (!checks.passes({ code: typed })) return;

    const code = cleanCode(typed);

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

  /** The account is read again, so the next gate, or the product, opens rather than this screen. */
  async function carryOn(): Promise<void> {
    await refreshAccount();
    navigate('/app');
  }

  async function signOut(): Promise<void> {
    await api.signOut();
    forgetSession();
    navigate('/sign-in');
  }

  const verified = status.kind === 'verified' || state.session.verified;
  const entering = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);

  const codeError = checks.errors.code ?? (status.kind === 'wrong' ? t('verifyEmail.wrong') : null);

  return (
    <AuthPage>
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
          <button className="button button-primary" type="button" onClick={() => void carryOn()}>
            {t('verifyEmail.continue')}
          </button>
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
            <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
              <div className="field">
                <label htmlFor="code">{t('verifyEmail.codeLabel')}</label>
                <input
                  className={codeError == null ? 'code-input' : 'code-input input-wrong'}
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  aria-invalid={codeError != null}
                  aria-describedby={codeError == null ? undefined : 'code-error'}
                  onBlur={(event) => checks.left('code', event.target.value)}
                  onChange={(event) => checks.edited('code', event.target.value)}
                />
                {codeError != null && <FieldError id="code-error" message={codeError} />}
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
            <span>{t('verifyEmail.wrongAddressBody')}</span>
          </div>
        </>
      )}
    </AuthPage>
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
