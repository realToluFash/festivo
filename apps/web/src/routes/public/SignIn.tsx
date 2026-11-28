import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { ApiError } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { providerList } from '../../providerList.ts';
import { dateLocale } from '../../i18n/index.ts';
import {
  type ProviderOnly,
  type SsoRequired,
  type TimedOut,
  providerOnlyBy,
  ssoRequiredBy,
} from '../../session.ts';
import { leaveForSingleSignOn, singleSignOnAt } from '../../ssoSignIn.ts';
import { landAfterSignIn } from '../../signedIn.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { offButton } from '../../offButton.ts';
import { focusWhereSent, offField } from '../../offField.ts';
import { emailMessage, useFormChecks } from '../../formChecks.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'providerFailed'; provider: string }
  | { kind: 'failed' }
  | { kind: 'sessionEnded' }
  | { kind: 'codeTimedOut' }
  | { kind: 'timedOut'; rule: TimedOut }
  | ({ kind: 'providerOnly' } & ProviderOnly)
  | ({ kind: 'ssoRequired' } & SsoRequired);

export function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { state: carried } = useLocation() as {
    state: {
      timedOut?: TimedOut;
      providerOnly?: ProviderOnly;
      email?: string;
      codeTimedOut?: boolean;
      ssoRequired?: SsoRequired;
      ssoFailed?: boolean;
    } | null;
  };
  const [status, setStatus] = useState<Status>(() => {
    const provider = params.get('provider-failed');

    if (provider != null) return { kind: 'providerFailed', provider };
    if (carried?.timedOut != null) return { kind: 'timedOut', rule: carried.timedOut };
    if (carried?.ssoRequired != null) return { kind: 'ssoRequired', ...carried.ssoRequired };
    if (carried?.ssoFailed === true) return { kind: 'failed' };
    if (carried?.providerOnly != null) return { kind: 'providerOnly', ...carried.providerOnly };
    if (carried?.codeTimedOut === true) return { kind: 'codeTimedOut' };

    return params.has('signed-out') ? { kind: 'sessionEnded' } : { kind: 'ready' };
  });
  const form = useRef<HTMLFormElement>(null);
  const [typedEmail, setTypedEmail] = useState(
    status.kind === 'timedOut' ? status.rule.email : (carried?.email ?? ''),
  );
  const [sso, setSso] = useState<{ domain: string; organisation: string; provider: string }>();
  const [anotherWay, setAnotherWay] = useState(false);
  const handoff = !anotherWay && sso != null && sso.domain === domainOf(typedEmail) ? sso : null;
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

  /** Asked once the address is typed: a domain with single sign-on goes to its provider instead of a password. */
  function discover(typed: string): void {
    const email = typed.trim();
    if (emailMessage(email, t) != null || sso?.domain === domainOf(email)) return;

    singleSignOnAt(email)
      .then((start) => {
        if (start != null) setSso({ ...start, domain: domainOf(email) });
      })
      // Left on the password form: required sign-on's own refusal still sends them on.
      .catch(() => undefined);
  }

  const prefilled = useRef(typedEmail);
  useEffect(() => {
    const email = prefilled.current.trim();
    if (!email.includes('@')) return;

    singleSignOnAt(email)
      .then((start) => {
        if (start != null) setSso({ ...start, domain: domainOf(email) });
      })
      .catch(() => undefined);
  }, []);

  async function leave(email: string): Promise<void> {
    try {
      if (await leaveForSingleSignOn(email.trim())) return;
    } catch (error) {
      setStatus(refusalFrom(error, email));
      return;
    }

    setStatus({ kind: 'failed' });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    // Busy looks busy rather than disabled, as on register; a second press while signing in does nothing.
    if (busy) return;

    if (handoff != null) {
      await leave(typedEmail);
      return;
    }

    const typed = new FormData(event.currentTarget);
    const values = {
      email: String(typed.get('email') ?? '').trim(),
      password: String(typed.get('password') ?? ''),
    };

    if (!checks.passes(values)) return;

    setStatus({ kind: 'signingIn' });
    const land = focusWhereSent();

    try {
      await landAfterSignIn(await api.signIn(values.email, values.password), navigate);
    } catch (error) {
      const refusal = refusalFrom(error, values.email);
      setStatus(refusal);
      if (refusal.kind === 'refused') {
        land('password');
        const password = document.getElementById('password');
        if (password instanceof HTMLInputElement && document.activeElement === password)
          password.select();
      }
    }
  }

  const notice = noticeFor(status, t);

  return (
    <AuthPage bare>
      <div className="auth-heading">
        <h1>{t('signIn.title')}</h1>
        {notice != null && (
          <div className="auth-notice" role={notice.alert ? 'alert' : 'status'}>
            <p className="auth-notice-title">{notice.title}</p>
            {notice.body !== '' && <p>{notice.body}</p>}
            {status.kind === 'rateLimited' && (
              <Link
                className="link-button"
                to="/forgot-password"
                state={{ email: typedEmail.trim() }}
              >
                {t('signIn.lockedReset')}
              </Link>
            )}
          </div>
        )}
      </div>

      {status.kind === 'ssoRequired' && (
        <button
          className="button button-primary"
          type="button"
          onClick={() => void leave(status.email || typedEmail)}
        >
          {t('signIn.ssoContinue', { provider: status.provider })}
        </button>
      )}

      {/* A password cannot sign this account in, so the form gives way to the buttons it has linked. */}
      {status.kind === 'providerOnly' ? (
        <>
          {status.email !== '' && (
            <div className="field">
              <label htmlFor="email">{t('signIn.email')}</label>
              <input className="input" id="email" type="email" value={status.email} readOnly />
            </div>
          )}

          <ProviderSignIn only={status.providers} pair />

          <p className="muted">
            {t('signIn.providerOnlyFootnote', { organisation: status.organisation })}
          </p>

          <button
            className="link-button"
            type="button"
            onClick={() => setStatus({ kind: 'ready' })}
          >
            {t('signIn.anotherAccount')}
          </button>
        </>
      ) : (
        <>
          <form
            ref={form}
            className="auth-form"
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            <div className="auth-fields">
              <div className={checks.errors.email == null ? 'field' : 'field field-wrong'}>
                <label htmlFor="email">{t('signIn.email')}</label>
                <input
                  className={checks.errors.email == null ? 'input' : 'input input-wrong'}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCorrect="off"
                  spellCheck={false}
                  defaultValue={status.kind === 'timedOut' ? status.rule.email : carried?.email}
                  {...offField(busy)}
                  required
                  aria-invalid={checks.errors.email != null}
                  aria-describedby={checks.errors.email == null ? undefined : 'email-error'}
                  onBlur={(event) => {
                    checks.left('email', event.target.value);
                    discover(event.target.value);
                  }}
                  onChange={(event) => {
                    setTypedEmail(event.target.value);
                    setAnotherWay(false);
                    checks.edited('email', event.target.value);
                  }}
                />
                {checks.errors.email != null && (
                  <FieldError id="email-error" message={checks.errors.email} />
                )}
              </div>

              {handoff == null && (
                <div className={checks.errors.password == null ? 'field' : 'field field-wrong'}>
                  <div className="field-heading">
                    <label htmlFor="password">{t('signIn.password')}</label>
                    <Link
                      className="link-button"
                      to="/forgot-password"
                      state={{ email: typedEmail.trim() }}
                    >
                      {t('recovery.forgot')}
                    </Link>
                  </div>
                  {/* A refusal turns no field red: it does not say which of the two is wrong. */}
                  <PasswordField
                    id="password"
                    autoComplete="current-password"
                    wrong={checks.errors.password != null}
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
                      <FieldError id="password-error" message={t('signIn.noMatch')} />
                    )
                  )}
                </div>
              )}
            </div>

            {handoff != null ? (
              <>
                <p>{t('signIn.ssoLine', handoff)}</p>
                <button className="button button-primary" type="submit">
                  {t('signIn.ssoContinue', handoff)}
                </button>
                <button className="link-button" type="button" onClick={() => setAnotherWay(true)}>
                  {t('signIn.ssoAnother')}
                </button>
              </>
            ) : (
              <button
                className="button button-primary"
                type="submit"
                aria-busy={busy}
                {...offButton(locked)}
              >
                {locked
                  ? t('signIn.lockedUntil', { time: status.retryAt })
                  : busy
                    ? t('signIn.submitting')
                    : t('signIn.submit')}
              </button>
            )}
          </form>
          {handoff == null && <ProviderSignIn pair />}
        </>
      )}
    </AuthPage>
  );
}

function domainOf(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

/** The line under the title, in the words each state has always had. */
function noticeFor(
  status: Status,
  t: TFunction,
): { title: string; body: string; alert: boolean } | null {
  switch (status.kind) {
    case 'sessionEnded':
      return { title: t('signIn.endedTitle'), body: t('signIn.endedBody'), alert: false };
    case 'codeTimedOut':
      return { title: t('signIn.codeTimedOutTitle'), body: t('signIn.endedBody'), alert: false };
    case 'timedOut':
      return {
        title: t('signIn.timedOutTitle', { organisation: status.rule.organisation }),
        body: t('signIn.timedOutBody', {
          organisation: status.rule.organisation,
          count: status.rule.days,
        }),
        alert: false,
      };
    case 'ssoRequired':
      return {
        title: t('signIn.ssoNotice', {
          organisation: status.organisation,
          provider: status.provider,
        }),
        body: '',
        alert: true,
      };
    case 'providerOnly':
      return {
        title: t('signIn.providerOnlyTitle', { organisation: status.organisation }),
        body: t('signIn.providerOnlyBody', {
          organisation: status.organisation,
          providers: providerList(status.providers),
        }),
        alert: true,
      };
    case 'failed':
      return { title: t('signIn.failedTitle'), body: t('signIn.failedBody'), alert: true };
    case 'rateLimited':
      return {
        title: t('signIn.lockedTitle'),
        body: t('signIn.lockedBody', { time: status.retryAt }),
        alert: true,
      };
    case 'providerFailed':
      return {
        title: t('signIn.providerFailedTitle', { provider: status.provider }),
        body: t('signIn.providerFailedBody', { provider: status.provider }),
        alert: true,
      };
    default:
      return null;
  }
}

function refusalFrom(error: unknown, typed: string): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  const ssoRequired = ssoRequiredBy(error.problem);
  if (ssoRequired != null) return { kind: 'ssoRequired', ...ssoRequired };

  const providerOnly = providerOnlyBy(error.problem);
  if (providerOnly != null)
    return { kind: 'providerOnly', ...providerOnly, email: providerOnly.email || typed };

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(liftsAt, dateLocale()),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  return { kind: 'failed' };
}
