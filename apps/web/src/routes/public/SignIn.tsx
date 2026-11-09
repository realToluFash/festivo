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
import { currentLocale, dateLocale } from '../../i18n/index.ts';
import { type ProviderOnly, type TimedOut, providerOnlyBy } from '../../session.ts';
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
  | ({ kind: 'providerOnly' } & ProviderOnly);

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
    } | null;
  };
  const [status, setStatus] = useState<Status>(() => {
    const provider = params.get('provider-failed');

    if (provider != null) return { kind: 'providerFailed', provider };
    if (carried?.timedOut != null) return { kind: 'timedOut', rule: carried.timedOut };
    if (carried?.providerOnly != null) return { kind: 'providerOnly', ...carried.providerOnly };
    if (carried?.codeTimedOut === true) return { kind: 'codeTimedOut' };

    return params.has('signed-out') ? { kind: 'sessionEnded' } : { kind: 'ready' };
  });
  const form = useRef<HTMLFormElement>(null);
  const [typedEmail, setTypedEmail] = useState(
    status.kind === 'timedOut' ? status.rule.email : (carried?.email ?? ''),
  );
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
            <p>{notice.body}</p>
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
                  onBlur={(event) => checks.left('email', event.target.value)}
                  onChange={(event) => {
                    setTypedEmail(event.target.value);
                    checks.edited('email', event.target.value);
                  }}
                />
                {checks.errors.email != null && (
                  <FieldError id="email-error" message={checks.errors.email} />
                )}
              </div>

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
            </div>

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
          </form>
          <ProviderSignIn pair />
        </>
      )}
    </AuthPage>
  );
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

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', apple: 'Apple' };

/** "Google or Apple", in the reader's language; the names are the providers' own. */
function providerList(providers: string[]): string {
  const names = (providers.length > 0 ? providers : ['google', 'apple']).map(
    (provider) => PROVIDER_NAMES[provider] ?? provider,
  );

  return new Intl.ListFormat(currentLocale(), { type: 'disjunction' }).format(names);
}
