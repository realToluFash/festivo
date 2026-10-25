import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt, meetsPasswordLength } from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { PasswordRule } from '../../components/PasswordRule.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { offButton } from '../../offButton.ts';
import { dateLocale } from '../../i18n/index.ts';
import { emailMessage, useFormChecks } from '../../formChecks.ts';
import { holdRegistration } from '../../pendingRegistration.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'refused'; fields: FieldErrors }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'failed' };

/** A field's refusal: one of the two the design words, or the API's own translated message. */
type FieldError = 'breached' | { message: string };
type FieldErrors = Partial<Record<'name' | 'email' | 'password', FieldError>>;

export function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'ready' });
  const [password, setPassword] = useState('');
  const passwordInput = useRef<HTMLInputElement>(null);

  const busy = status.kind === 'submitting';
  const locked = status.kind === 'rateLimited';
  const liftsAt = status.kind === 'rateLimited' ? status.liftsAt : null;
  const lengthMet = meetsPasswordLength(password);
  const checks = useFormChecks(
    ['name', 'email', 'password'] as const,
    (field, value) => {
      if (field === 'email') return emailMessage(value, t);
      if (value.trim() !== '') return null;

      return field === 'name' ? t('register.nameBlank') : t('register.passwordBlank');
    },
    (field) => document.getElementById(field)?.focus(),
  );
  // The client's message, where it has one, stands in for the server's.
  const fields: FieldErrors = {
    ...(status.kind === 'refused' ? status.fields : {}),
    ...Object.fromEntries(
      Object.entries(checks.errors).map(([field, message]) => [field, { message }]),
    ),
  };

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(
      () => setStatus({ kind: 'ready' }),
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = new FormData(event.currentTarget);
    const values = {
      name: String(typed.get('name') ?? ''),
      email: String(typed.get('email') ?? ''),
      password,
    };

    if (!checks.passes(values)) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!lengthMet) {
      passwordInput.current?.focus();
      return;
    }

    setStatus({ kind: 'submitting' });

    try {
      // Every address gets this same answer, so where it goes next says nothing either.
      holdRegistration(await api.register(values.email.trim(), values.name.trim(), password));
      navigate('/verify-email');
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  return (
    <AuthPage>
      <div className="auth-heading">
        <h1>{t('register.title')}</h1>
        <p>{t('register.intro')}</p>
      </div>

      {status.kind === 'rateLimited' && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('register.limitedTitle')}</p>
            <p>{t('register.limitedBody', { time: status.retryAt })}</p>
          </div>
        </div>
      )}

      {status.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('register.failedTitle')}</p>
            <p>{t('register.failedBody')}</p>
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="name">{t('register.name')}</label>
          <input
            className={fields.name ? 'input input-wrong' : 'input'}
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={fields.name != null}
            aria-describedby={fields.name ? 'name-error' : undefined}
            onBlur={(event) => checks.left('name', event.target.value)}
            onChange={(event) => checks.edited('name', event.target.value)}
          />
          {fields.name && <FieldRefusal id="name-error" error={fields.name} />}
        </div>

        <div className="field">
          <label htmlFor="email">{t('register.email')}</label>
          <input
            className={fields.email ? 'input input-wrong' : 'input'}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={fields.email != null}
            aria-describedby={fields.email ? 'email-error' : undefined}
            onBlur={(event) => checks.left('email', event.target.value)}
            onChange={(event) => checks.edited('email', event.target.value)}
          />
          {fields.email && <FieldRefusal id="email-error" error={fields.email} />}
        </div>

        <div className="field">
          <label htmlFor="password">{t('register.password')}</label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            inputRef={passwordInput}
            value={password}
            onChange={(value) => {
              setPassword(value);
              checks.edited('password', value);
            }}
            onBlur={(value) => checks.left('password', value)}
            wrong={fields.password != null}
            disabled={busy}
            submitting={busy}
            describedBy={fields.password ? 'password-error password-rule' : 'password-rule'}
          />
          {fields.password && <FieldRefusal id="password-error" error={fields.password} />}
        </div>

        <PasswordRule met={lengthMet} id="password-rule" />

        <button
          className="button button-primary"
          type="submit"
          aria-busy={busy}
          {...offButton(locked)}
        >
          {busy ? t('register.submitting') : t('register.submit')}
        </button>
      </form>

      <ProviderSignIn />

      <div className="auth-footnote">
        <span>{t('register.haveAccount')}</span>
        <Link className="link-button" to="/sign-in">
          {t('register.signIn')}
        </Link>
      </div>
    </AuthPage>
  );
}

function FieldRefusal({ id, error }: { id: string; error: FieldError }) {
  const { t } = useTranslation();

  return (
    <div className="field-error" id={id} role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <p>{error === 'breached' ? t('register.breached') : error.message}</p>
    </div>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

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

  if (error.is('validation_failed')) return { kind: 'refused', fields: fieldsFrom(error) };

  return { kind: 'failed' };
}

/** A breached password is the design's own sentence; every other refusal is the API's, already translated. */
function fieldsFrom(error: ApiError): FieldErrors {
  const fields: FieldErrors = {};

  for (const violation of error.problem.violations ?? []) {
    const path = violation.propertyPath;

    if (path !== 'name' && path !== 'email' && path !== 'password') continue;

    fields[path] ??=
      violation.code === 'password_breached' ? 'breached' : { message: violation.message };
  }

  return fields;
}
