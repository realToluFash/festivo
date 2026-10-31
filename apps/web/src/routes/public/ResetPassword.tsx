import { type Account, ApiError, awaiting } from '@soirely/api-client';
import { meetsPasswordLength } from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { PasswordRule } from '../../components/PasswordRule.tsx';
import { Pending } from '../../components/Pending.tsx';
import { SecondFactorStep } from '../../components/SecondFactorStep.tsx';
import { useFormChecks } from '../../formChecks.ts';
import type { ForgotFrom } from '../../forgotFrom.ts';
import { focusWhereSent } from '../../offField.ts';
import { adoptAccount, landingFor, providerOnlyBy } from '../../session.ts';
import { useStepFocus } from '../../stepFocus.ts';

type Dead = 'used' | 'expired' | 'invalid';

type Status =
  | { kind: 'checking' }
  | { kind: 'ready'; email: string }
  | { kind: 'saving'; email: string }
  | { kind: 'failed'; email: string }
  | { kind: 'done'; email: string; account: Account }
  | { kind: 'code'; email: string }
  | { kind: 'used' }
  | { kind: 'expired' }
  | { kind: 'invalid' };

/** "Set a new password", from the emailed link, which can be opened on any device. */
export function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [stepHeading, arriveAtStep] = useStepFocus();
  const checks = useFormChecks(
    ['password'] as const,
    (_field, value) => (value === '' ? t('recovery.passwordBlank') : null),
    () => passwordInput.current?.focus(),
  );

  useEffect(() => {
    let live = true;

    api
      .checkResetLink(token)
      .then(({ email, twoFactor }) => {
        // With two-factor on the code comes first, and nothing changes until it passes.
        if (live) setStatus({ kind: twoFactor ? 'code' : 'ready', email });
      })
      .catch((error: unknown) => {
        if (live) setStatus({ kind: deadFrom(error) ?? 'invalid' });
      });

    return () => {
      live = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status.kind !== 'ready' && status.kind !== 'failed') return;

    if (!checks.passes({ password })) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(password)) {
      passwordInput.current?.focus();
      return;
    }

    const email = status.email;
    setStatus({ kind: 'saving', email });
    const land = focusWhereSent();

    try {
      const { account } = await api.resetPassword(token, password);
      await adoptAccount(account);
      setStatus({ kind: 'done', email, account });
      arriveAtStep();
    } catch (error) {
      const dead = deadFrom(error);
      const providerOnly = error instanceof ApiError ? providerOnlyBy(error.problem) : undefined;

      // The password is set, but signs in only where a password sign-in would (sc-69).
      if (providerOnly != null) {
        navigate('/sign-in', { replace: true, state: { providerOnly } });
      } else if (dead != null) {
        setStatus({ kind: dead });
        arriveAtStep();
      } else if (error instanceof ApiError && error.is('validation_failed')) {
        const violation = error.problem.violations?.find((v) => v.propertyPath === 'password');
        const refusal =
          violation?.code === 'password_breached'
            ? t('register.breached')
            : (violation?.message ?? null);
        setRefusal(refusal);
        setStatus({ kind: 'ready', email });
        if (refusal != null) land('password');
      } else {
        setStatus({ kind: 'failed', email });
      }
    }
  }

  if (status.kind === 'checking') return <Pending />;

  if (status.kind === 'used' || status.kind === 'expired' || status.kind === 'invalid') {
    return (
      <AuthPage>
        <div className="auth-heading">
          <h1 ref={stepHeading} tabIndex={-1}>
            {t(`recovery.${status.kind}Title`)}
          </h1>
          <p>{t(`recovery.${status.kind}Body`)}</p>
        </div>
        <Link
          className="button button-primary"
          to="/forgot-password"
          state={{ back: status.kind } satisfies ForgotFrom}
        >
          {t('recovery.sendNew')}
        </Link>
        <div className="auth-footnote">
          {status.kind === 'expired' && <span>{t('recovery.rememberedAfterAll')}</span>}
          <Link className="link-button" to="/sign-in">
            {t('recovery.signIn')}
          </Link>
        </div>
      </AuthPage>
    );
  }

  if (status.kind === 'code') {
    const email = status.email;

    return (
      <AuthPage>
        <SecondFactorStep
          intro={t('recovery.codeIntro', { email })}
          recoveryIntro={t('recovery.codeRecoveryIntro')}
          submitLabel={t('recovery.continueToPassword')}
          pausedNote={t('recovery.nothingChanged')}
          failedTitle={t('recovery.failedTitle')}
          failedBody={t('recovery.failedBody')}
          onVerify={async (factor) => {
            try {
              await api.passResetCode(token, factor);
            } catch (error) {
              const dead = deadFrom(error);
              if (dead == null) throw error;
              setStatus({ kind: dead });
              arriveAtStep();
              return;
            }
            setStatus({ kind: 'ready', email });
            arriveAtStep();
          }}
          onExpired={() => {
            setStatus({ kind: 'expired' });
            arriveAtStep();
          }}
        />
      </AuthPage>
    );
  }

  if (status.kind === 'done') {
    return (
      <AuthPage>
        <span className="verified-mark" aria-hidden="true">
          ✓
        </span>
        <div className="auth-heading">
          <h1 ref={stepHeading} tabIndex={-1}>
            {t('recovery.doneTitle')}
          </h1>
          <p>{t('recovery.doneBody', { email: status.email })}</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => navigate(landingFor(awaiting(status.account)), { replace: true })}
        >
          {t('recovery.continue')}
        </button>
      </AuthPage>
    );
  }

  const saving = status.kind === 'saving';
  const error = checks.errors.password ?? refusal;

  return (
    <AuthPage>
      <div className="auth-heading">
        <h1 ref={stepHeading} tabIndex={-1}>
          {t('recovery.newTitle')}
        </h1>
        <p>{t('recovery.newFor', { email: status.email })}</p>
      </div>

      {status.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('recovery.failedTitle')}</p>
            <p>{t('recovery.failedBody')}</p>
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="password">{t('recovery.newPassword')}</label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            inputRef={passwordInput}
            value={password}
            onChange={(value) => {
              setPassword(value);
              setRefusal(null);
              checks.edited('password', value);
            }}
            onBlur={(value) => checks.left('password', value)}
            wrong={error != null}
            disabled={saving}
            submitting={saving}
            describedBy={error == null ? 'password-rule' : 'password-error password-rule'}
          />
          {error != null && <FieldError id="password-error" message={error} />}
        </div>

        <PasswordRule met={meetsPasswordLength(password)} id="password-rule" />

        <div className="notice notice-quiet">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <p>{t('recovery.signsOut')}</p>
        </div>

        <button className="button button-primary" type="submit" aria-busy={saving}>
          {saving ? t('recovery.saving') : t('recovery.save')}
        </button>
      </form>
    </AuthPage>
  );
}

function deadFrom(error: unknown): Dead | null {
  if (!(error instanceof ApiError)) return null;
  if (error.is('reset_link_used')) return 'used';
  if (error.is('reset_link_expired')) return 'expired';
  if (error.is('reset_link_invalid')) return 'invalid';

  return null;
}
