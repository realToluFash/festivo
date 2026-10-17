import {
  type Account,
  ApiError,
  type PhoneCodeRoute,
  phoneAwaitingCode,
} from '@soirely/api-client';
import { cleanCode, codeProblem, codeWording, formatCountdown, formatPhone } from '@soirely/domain';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { Pending } from '../../components/Pending.tsx';
import { refreshAccount } from '../../session.ts';
import { FieldError } from '../../components/FieldError.tsx';

type Status =
  | { kind: 'entering' }
  | { kind: 'verifying' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'failed' }
  | { kind: 'verified' };

/** "Check your messages": the code texted to the primary phone, under email's rules and with its parts. */
export function VerifyPhone() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onboarding = params.get('from') === 'onboarding';
  const [account, setAccount] = useState<Account | 'none' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [route, setRoute] = useState<PhoneCodeRoute | null>(null);
  const [textingFailed, setTextingFailed] = useState(false);
  const wording = codeWording(route);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) setAccount('none');
      });

    api
      .phoneOpening()
      .then(({ cooldownSeconds, codeState, route: sent }) => {
        if (!live) return;
        setCooldown(cooldownSeconds);
        setRoute(sent);
        // A spent code opens on its banner, so the screen never invites a try it knows is refused.
        if (codeState !== 'live') {
          setStatus((now) => (now.kind === 'entering' ? { kind: codeState } : now));
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  // While the code is on WhatsApp, the server may hand it to SMS: the line follows within a few seconds.
  useEffect(() => {
    if (!wording.watch) return;

    const watching = setInterval(() => {
      api
        .phoneOpening()
        .then((opening) => setRoute(opening.route))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(watching);
  }, [wording.watch]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  if (account === 'none') return <Navigate to="/sign-in" replace />;
  if (account == null) return <Pending />;

  const phone = phoneAwaitingCode(account);
  if (phone == null)
    return <Navigate to={onboarding ? '/phone?from=onboarding' : '/phone'} replace />;

  const number = formatPhone(phone.number);
  const verified = status.kind === 'verified' || phone.verified;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = String(new FormData(event.currentTarget).get('code') ?? '');
    const problem = codeProblem(typed);

    if (problem != null) {
      setCodeError(
        problem === 'short'
          ? t('verifyPhone.codeShort')
          : wording.fromWhatsApp
            ? t('verifyPhone.codeBlankWhatsApp')
            : t('verifyPhone.codeBlank'),
      );
      return;
    }

    const code = cleanCode(typed);

    setCodeError(null);
    setStatus({ kind: 'verifying' });

    try {
      await api.verifyPhone(code);
      setStatus({ kind: 'verified' });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendPhoneCode());
      setStatus({ kind: 'entering' });
      setRoute((await api.phoneOpening()).route);
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

  async function carryOn(): Promise<void> {
    await refreshAccount();
    navigate('/app');
  }

  // Saving the details with no number removes the phone, so the gate rests on the email again.
  async function withoutPhone(name: string): Promise<void> {
    try {
      await api.completeProfile({ name });
      await carryOn();
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  async function textInstead(): Promise<void> {
    setTextingFailed(false);

    try {
      await api.textPhoneCodeInstead();
      setRoute('sms_chosen');
    } catch {
      setTextingFailed(true);
    }
  }

  const entering = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);
  const wrong = wording.fromWhatsApp ? t('verifyPhone.wrongWhatsApp') : t('verifyPhone.wrong');
  const fieldError = codeError ?? (status.kind === 'wrong' ? wrong : null);
  const line = {
    whatsapp: t('verifyPhone.introWhatsApp', { number }),
    fallback: t('verifyPhone.introFallback', { number }),
    chosen: t('verifyPhone.introChosen', { number }),
    texted: t('verifyPhone.intro', { number }),
  }[wording.line];

  return (
    <AuthPage>
      {onboarding && (
        <ol className="steps" aria-label={t('verifyEmail.stepsLabel')}>
          <li className="step step-done">
            <span className="step-mark" aria-hidden="true">
              ✓
            </span>
            {t('verifyEmail.step1Done')}
          </li>
          <li className="step step-now">
            <span className="step-mark" aria-hidden="true">
              2
            </span>
            {t('verifyEmail.step2')}
          </li>
        </ol>
      )}

      {verified ? (
        <>
          <span className="verified-mark" aria-hidden="true">
            ✓
          </span>
          <div className="auth-heading">
            <h1>{t('verifyPhone.doneTitle')}</h1>
            <p>{t('verifyPhone.doneBody', { number })}</p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void carryOn()}>
            {t('verifyPhone.continue')}
          </button>
        </>
      ) : (
        <>
          <div className="auth-heading">
            <h1>{t('verifyPhone.title')}</h1>
            {/* One live element whose text changes, so a fallback is announced without moving focus. */}
            <p aria-live="polite">{line}</p>
          </div>

          {status.kind === 'expired' && (
            <Banner
              title={t('verifyPhone.expiredTitle')}
              body={t('verifyPhone.expiredBody')}
              action={t('verifyPhone.resend')}
              onAction={() => void resend()}
            />
          )}

          {status.kind === 'exhausted' && (
            <Banner
              title={t('verifyPhone.exhaustedTitle')}
              body={t('verifyPhone.exhaustedBody')}
              action={t('verifyPhone.resend')}
              onAction={() => void resend()}
            />
          )}

          {status.kind === 'failed' && (
            <div className="notice notice-broken" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <div className="notice-body">
                <p className="notice-title">{t('verifyPhone.failedTitle')}</p>
                <p>{t('verifyPhone.failedBody')}</p>
              </div>
            </div>
          )}

          {entering && (
            <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
              <div className="field">
                <label htmlFor="code">
                  {wording.fromWhatsApp
                    ? t('verifyPhone.codeLabelWhatsApp')
                    : t('verifyPhone.codeLabel')}
                </label>
                <input
                  className={fieldError == null ? 'code-input' : 'code-input input-wrong'}
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={fieldError != null}
                  aria-describedby={fieldError == null ? undefined : 'code-error'}
                  onChange={() => setCodeError(null)}
                />
                {fieldError != null && <FieldError id="code-error" message={fieldError} />}
              </div>

              <button
                className="button button-primary"
                type="submit"
                aria-busy={status.kind === 'verifying'}
              >
                {status.kind === 'verifying'
                  ? t('verifyPhone.submitting')
                  : t('verifyPhone.submit')}
              </button>

              <div className="resend">
                <button
                  className="button"
                  type="button"
                  disabled={cooldown > 0}
                  onClick={() => void resend()}
                >
                  {cooldown > 0
                    ? t('verifyPhone.resendIn', { time: formatCountdown(cooldown) })
                    : t('verifyPhone.resend')}
                </button>
                <p>{t('verifyPhone.resendNote')}</p>
              </div>

              {wording.offerText && (
                <button className="button" type="button" onClick={() => void textInstead()}>
                  {t('verifyPhone.textInstead')}
                </button>
              )}
              {textingFailed && (
                <FieldError id="text-instead-error" message={t('verifyPhone.textInsteadFailed')} />
              )}
            </form>
          )}

          <div className="auth-footnote">
            <span>{t('verifyPhone.wrongNumber')}</span>
            <Link className="link-button" to={onboarding ? '/phone?from=onboarding' : '/phone'}>
              {t('verifyPhone.changeIt')}
            </Link>
          </div>

          {onboarding && (
            <div className="auth-footnote">
              <span>{t('verifyPhone.cantGetTexts')}</span>
              <button
                className="link-button"
                type="button"
                onClick={() => void withoutPhone(account.name)}
              >
                {t('verifyPhone.carryOnWithout')}
              </button>
            </div>
          )}
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
    <div className="notice notice-attention" role="alert">
      <span className="mark mark-attention" aria-hidden="true">
        !
      </span>
      <div className="notice-body">
        <p className="notice-title">{title}</p>
        <p>{body}</p>
        <button className="link-button" type="button" onClick={onAction}>
          {action}
        </button>
      </div>
    </div>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  if (error.is('verification_code_invalid')) return { kind: 'wrong' };
  if (error.is('verification_code_expired')) return { kind: 'expired' };
  if (error.is('verification_code_exhausted')) return { kind: 'exhausted' };

  return { kind: 'failed' };
}
