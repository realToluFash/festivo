import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt, meetsPasswordLength } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { PasswordRule } from '../../../components/PasswordRule.tsx';
import { useFormChecks } from '../../../formChecks.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { PROVIDER_NAMES } from '../../../providerSignIn.ts';
import { currentSessionId } from '../../../tokens.ts';

type Stage = { kind: 'at-rest'; signedOut: number | null } | { kind: 'changing' };

/** Settings > Security, the first card: change the password, knowing the current one (sc-116). */
export function PasswordCard({
  email,
  hasPassword,
  providers,
  onChanged,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly string[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'at-rest', signedOut: null });

  if (!hasPassword) {
    const provider = providers[0];

    return (
      <section className="card" aria-labelledby="password-title">
        <h2 id="password-title">{t('passwordCard.title')}</h2>
        <p>
          {t('passwordCard.none', {
            provider:
              provider === 'google' || provider === 'apple' ? PROVIDER_NAMES[provider] : provider,
          })}
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="password-title">
      {stage.kind === 'at-rest' ? (
        <>
          <h2 id="password-title">{t('passwordCard.title')}</h2>
          {stage.signedOut != null && (
            <p className="status-done" role="status">
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              {t('passwordCard.done', { count: stage.signedOut })}
            </p>
          )}
          <p>{t('passwordCard.intro')}</p>
          <div className="actions">
            <button className="button" type="button" onClick={() => setStage({ kind: 'changing' })}>
              {t('passwordCard.change')}
            </button>
          </div>
        </>
      ) : (
        <Changing
          email={email}
          onChanged={(signedOut) => {
            setStage({ kind: 'at-rest', signedOut });
            onChanged();
          }}
          onCancel={() => setStage({ kind: 'at-rest', signedOut: null })}
        />
      )}
    </section>
  );
}

type Refusal =
  | { field: 'currentPassword'; message: string }
  | { field: 'newPassword'; message: string }
  | { field: 'paused'; message: string }
  | { field: 'failed'; message: string };

function Changing({
  email,
  onChanged,
  onCancel,
}: {
  email: string;
  onChanged: (signedOut: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const currentInput = useRef<HTMLInputElement>(null);
  const nextInput = useRef<HTMLInputElement>(null);
  const checks = useFormChecks(
    ['currentPassword', 'newPassword'] as const,
    (field, value) =>
      value !== ''
        ? null
        : field === 'currentPassword'
          ? t('passwordCard.currentBlank')
          : t('passwordCard.newBlank'),
    (field) => (field === 'currentPassword' ? currentInput : nextInput).current?.focus(),
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;
    if (!checks.passes({ currentPassword: current, newPassword: next })) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(next)) {
      nextInput.current?.focus();
      return;
    }

    setSaving(true);
    setRefusal(null);

    try {
      const { signedOut } = await api.changePassword({
        currentPassword: current,
        newPassword: next,
        sessionId: currentSessionId(),
      });
      onChanged(signedOut);
    } catch (error) {
      setSaving(false);
      setRefusal(refusalFrom(error, t));
    }
  }

  const currentError =
    checks.errors.currentPassword ??
    (refusal?.field === 'currentPassword' ? refusal.message : null);
  const nextError =
    checks.errors.newPassword ?? (refusal?.field === 'newPassword' ? refusal.message : null);

  return (
    <>
      <h2 id="password-title">{t('passwordCard.formTitle')}</h2>

      {refusal?.field === 'paused' && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('passwordCard.pausedTitle')}</p>
            <p>{refusal.message}</p>
          </div>
        </div>
      )}

      {refusal?.field === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('passwordCard.failedTitle')}</p>
            <p>{refusal.message}</p>
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <div className="field-heading">
            <label htmlFor="current-password">{t('passwordCard.current')}</label>
            <Link className="link-button" to="/forgot-password">
              {t('passwordCard.forgot')}
            </Link>
          </div>
          <PasswordField
            id="current-password"
            autoComplete="current-password"
            inputRef={currentInput}
            value={current}
            onChange={(value) => {
              setCurrent(value);
              if (refusal?.field === 'currentPassword') setRefusal(null);
              checks.edited('currentPassword', value);
            }}
            onBlur={(value) => checks.left('currentPassword', value)}
            wrong={currentError != null}
            disabled={saving}
            submitting={saving}
            describedBy={currentError == null ? undefined : 'current-password-error'}
          />
          {currentError != null && (
            <FieldError id="current-password-error" message={currentError} />
          )}
        </div>

        <div className="field">
          <label htmlFor="new-password">{t('passwordCard.new')}</label>
          <PasswordField
            id="new-password"
            autoComplete="new-password"
            inputRef={nextInput}
            value={next}
            onChange={(value) => {
              setNext(value);
              if (refusal?.field === 'newPassword') setRefusal(null);
              checks.edited('newPassword', value);
            }}
            onBlur={(value) => checks.left('newPassword', value)}
            wrong={nextError != null}
            disabled={saving}
            submitting={saving}
            describedBy={
              nextError == null ? 'new-password-rule' : 'new-password-error new-password-rule'
            }
          />
          {nextError != null && <FieldError id="new-password-error" message={nextError} />}
        </div>

        <PasswordRule met={meetsPasswordLength(next)} id="new-password-rule" />

        <p className="muted">{t('passwordCard.signsOut')}</p>
        <p className="muted">{t('passwordCard.emailed', { email })}</p>

        <div className="actions">
          <button className="button button-primary" type="submit" aria-busy={saving}>
            {saving ? t('passwordCard.saving') : t('passwordCard.save')}
          </button>
          <button className="button" type="button" onClick={onCancel} disabled={saving}>
            {t('passwordCard.cancel')}
          </button>
        </div>
      </form>
    </>
  );
}

/** Each refusal under the field it is about; the pause states its time, in the reader's clock. */
function refusalFrom(error: unknown, t: TFunction): Refusal {
  if (!(error instanceof ApiError))
    return { field: 'failed', message: t('passwordCard.failedBody') };

  if (error.is('invalid_credentials')) {
    return { field: 'currentPassword', message: t('passwordCard.wrongCurrent') };
  }

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    return {
      field: 'paused',
      message:
        liftsAt == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(liftsAt, currentLocale()) }),
    };
  }

  const violation = error.is('validation_failed')
    ? error.problem.violations?.find((v) => v.propertyPath === 'newPassword')
    : undefined;

  if (violation != null) {
    return {
      field: 'newPassword',
      message:
        violation.code === 'password_breached'
          ? t('register.breached')
          : violation.code === 'password_unchanged'
            ? t('passwordCard.same')
            : violation.message,
    };
  }

  return { field: 'failed', message: t('passwordCard.failedBody') };
}
