import { ApiError } from '@soirely/api-client';
import {
  formatTimeOfDay,
  lockLiftsAt,
  meetsPasswordLength,
  PASSWORD_MINIMUM_LENGTH,
} from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { LanguageChoice } from '../../components/LanguageChoice.tsx';
import { ProviderSignIn } from '../../components/ProviderSignIn.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { adoptAccount } from '../../session.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'refused'; fields: FieldErrors }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'failed' };

/** A field's refusal: one of the two the design words, or the API's own translated message. */
type FieldError = 'taken' | 'breached' | { message: string };
type FieldErrors = Partial<Record<'name' | 'email' | 'password', FieldError>>;

export function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'ready' });
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  const busy = status.kind === 'submitting';
  const locked = status.kind === 'rateLimited';
  const liftsAt = status.kind === 'rateLimited' ? status.liftsAt : null;
  const fields = status.kind === 'refused' ? status.fields : {};
  const lengthMet = meetsPasswordLength(password);

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

    // The rule is stated before submit, so a short password is never sent.
    if (!lengthMet) {
      passwordInput.current?.focus();
      return;
    }

    const typed = new FormData(event.currentTarget);

    setStatus({ kind: 'submitting' });

    try {
      const { account } = await api.register(
        String(typed.get('email') ?? '').trim(),
        String(typed.get('name') ?? '').trim(),
        password,
      );

      adoptAccount(account);

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
              />
              {fields.email && <FieldRefusal id="email-error" error={fields.email} />}
            </div>

            <div className="field">
              <label htmlFor="password">{t('register.password')}</label>
              <div className="field-reveal">
                <input
                  ref={passwordInput}
                  className={fields.password ? 'input input-wrong' : 'input'}
                  id="password"
                  name="password"
                  type={revealed ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={fields.password != null}
                  aria-describedby={
                    fields.password ? 'password-error password-rule' : 'password-rule'
                  }
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
              {fields.password && <FieldRefusal id="password-error" error={fields.password} />}
            </div>

            <div className="rule-inset" id="password-rule">
              <p className="rule-heading">{t('register.ruleHeading')}</p>
              <div className="rule">
                <span
                  className={lengthMet ? 'rule-mark rule-mark-met' : 'rule-mark'}
                  aria-hidden="true"
                >
                  {lengthMet ? '✓' : ''}
                </span>
                <span className="rule-text">
                  {t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
                </span>
                <span className={lengthMet ? 'rule-state rule-state-met' : 'rule-state'}>
                  {lengthMet ? t('register.ruleMet') : t('register.ruleNotYet')}
                </span>
              </div>
              <p className="rule-note">{t('register.ruleNote')}</p>
            </div>

            <button
              className="button button-primary"
              type="submit"
              disabled={locked}
              aria-busy={busy}
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
        </section>
      </main>
    </div>
  );
}

function FieldRefusal({ id, error }: { id: string; error: FieldError }) {
  const { t } = useTranslation();

  return (
    <div className="field-error" id={id} role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      {error === 'taken' ? (
        <div className="field-error-body">
          <p>{t('register.taken')}</p>
          <div className="field-error-actions">
            <Link className="link-button" to="/sign-in">
              {t('register.signIn')}
            </Link>
            {/* Recovery is sc-61; until it exists this opens sign-in, where it will start. */}
            <Link className="link-button" to="/sign-in">
              {t('register.resetPassword')}
            </Link>
          </div>
        </div>
      ) : (
        <p>{error === 'breached' ? t('register.breached') : error.message}</p>
      )}
    </div>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('email_taken')) return { kind: 'refused', fields: { email: 'taken' } };

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
