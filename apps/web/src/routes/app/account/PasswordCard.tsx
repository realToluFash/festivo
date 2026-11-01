import { ApiError, type LinkedProvider } from '@soirely/api-client';
import {
  cleanCode,
  codeProblem,
  formatTimeOfDay,
  lockLiftsAt,
  meetsPasswordLength,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import type { ForgotFrom } from '../../../forgotFrom.ts';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { PasswordRule } from '../../../components/PasswordRule.tsx';
import { useFormChecks } from '../../../formChecks.ts';
import { focusWhereSent } from '../../../offField.ts';
import { useResendCountdown } from '../../../resendCountdown.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { PROVIDER_NAMES } from '../../../providerSignIn.ts';
import { focusStep, useFocusOnceShown, useStepFocus } from '../../../stepFocus.ts';
import { currentSessionId } from '../../../tokens.ts';

type Stage =
  | { kind: 'at-rest'; signedOut: number | null; added: string | null }
  | { kind: 'changing' }
  | { kind: 'setting' };

/** Settings > Security, the first card: change the password (sc-116), or add one to a Google or Apple account (sc-391). */
export function PasswordCard({
  email,
  hasPassword,
  providers,
  onChanged,
  onAdded,
  setting = false,
  onSetting,
  returnTo,
}: {
  email: string;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  onChanged: () => void;
  onAdded: () => void | Promise<void>;
  /** Opened from elsewhere too: the ways-to-sign-in card offers Set a password for the last way in. */
  setting?: boolean;
  onSetting?: (on: boolean) => void;
  /** Where Cancel on Set a password goes back to when another card opened it. */
  returnTo?: () => HTMLElement | null;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'at-rest', signedOut: null, added: null });
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const said = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();
  const open = (next: Stage) => {
    setStage(next);
    onSetting?.(next.kind === 'setting');
  };
  const first = providers[0]?.provider;
  const provider = first == null ? '' : PROVIDER_NAMES[first];

  if (!hasPassword) {
    return (
      <section className="card" aria-labelledby="password-title">
        {stage.kind === 'setting' || setting ? (
          <Setting
            email={email}
            onAdded={async () => {
              await onAdded();
              open({ kind: 'at-rest', signedOut: null, added: provider });
              land(() => said.current);
            }}
            onCancel={() => {
              const back = stage.kind === 'setting' ? null : returnTo;
              open({ kind: 'at-rest', signedOut: null, added: null });
              land(() => back?.() ?? opener.current ?? heading.current);
            }}
          />
        ) : (
          <>
            <h2 id="password-title" ref={heading} tabIndex={-1}>
              {t('passwordCard.title')}
            </h2>
            <p>{t('passwordCard.setRest', { provider })}</p>
            <div className="actions">
              <button
                className="button"
                type="button"
                ref={opener}
                onClick={() => open({ kind: 'setting' })}
              >
                {t('passwordCard.set')}
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="password-title">
      {stage.kind === 'changing' ? (
        <Changing
          email={email}
          onChanged={(signedOut) => {
            setStage({ kind: 'at-rest', signedOut, added: null });
            onChanged();
            land(() => said.current);
          }}
          onCancel={() => {
            setStage({ kind: 'at-rest', signedOut: null, added: null });
            land(() => opener.current ?? heading.current);
          }}
        />
      ) : (
        <>
          <h2 id="password-title" ref={heading} tabIndex={-1}>
            {t('passwordCard.title')}
          </h2>
          {stage.kind === 'at-rest' && (stage.signedOut != null || stage.added != null) && (
            <p className="status-done" ref={said} tabIndex={-1}>
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              {stage.added != null
                ? t('passwordCard.added', { provider: stage.added })
                : t('passwordCard.done', { count: stage.signedOut ?? 0 })}
            </p>
          )}
          <p>{t('passwordCard.intro')}</p>
          <div className="actions">
            <button
              className="button"
              type="button"
              ref={opener}
              onClick={() => setStage({ kind: 'changing' })}
            >
              {t('passwordCard.change')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

type SetStep =
  | { kind: 'code'; refusal: string | null; paused: string | null; expired?: boolean }
  | { kind: 'password'; stepUp: string };

/** The code from the email first, then the password: the provider session alone may not add one. */
function Setting({
  email,
  onAdded,
  onCancel,
}: {
  email: string;
  onAdded: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetStep>({ kind: 'code', refusal: null, paused: null });
  const resending = useResendCountdown({
    resend: 'passwordCard.resend',
    resendIn: 'passwordCard.resendIn',
  });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRefusal, setPasswordRefusal] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [stepHeading, arriveAtStep] = useStepFocus();
  const expiredLine = useRef<HTMLDivElement>(null);
  const land = useFocusOnceShown();
  const codeChecks = useFormChecks(
    ['code'] as const,
    (_field, value) => {
      const problem = codeProblem(value);
      if (problem == null) return null;

      return problem === 'blank' ? t('passwordCard.setCodeBlank') : t('passwordCard.setCodeShort');
    },
    () => codeInput.current?.focus(),
  );
  const passwordChecks = useFormChecks(
    ['password'] as const,
    (_field, value) => (value === '' ? t('passwordCard.setNewBlank') : null),
    () => passwordInput.current?.focus(),
  );

  const send = (clicked: boolean): Promise<void> => resending.once(() => sendOnce(clicked));

  async function sendOnce(clicked: boolean): Promise<void> {
    setFailed(false);

    const countDown = clicked ? resending.countDown : resending.begin;

    try {
      countDown(await api.startSettingPassword());
    } catch (error) {
      const seconds =
        error instanceof ApiError ? Number(error.response?.headers.get('Retry-After')) : NaN;

      if (Number.isFinite(seconds) && seconds > 0) countDown(seconds);
      else setFailed(true);
    }
  }

  // Only ever opened by a click, so focus goes with it.
  useLayoutEffect(() => focusStep(stepHeading.current), [stepHeading]);

  // Sent once, when the step opens; Send a new code sends again.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void send(false);
  });

  async function passCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || !codeChecks.passes({ code })) return;

    setBusy(true);
    const land = focusWhereSent();

    try {
      setStep({ kind: 'password', stepUp: await api.passPasswordCode(cleanCode(code)) });
      arriveAtStep();
    } catch (error) {
      const refused = codeRefusal(error, t);
      setStep({ kind: 'code', ...refused });
      if (refused.refusal != null) land('set-code');
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (step.kind !== 'password' || busy || !passwordChecks.passes({ password })) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(password)) {
      passwordInput.current?.focus();
      return;
    }

    setBusy(true);
    const landWhereSent = focusWhereSent();

    try {
      await api.setPassword(password, step.stepUp);
      await onAdded();
    } catch (error) {
      setBusy(false);

      if (error instanceof ApiError && error.is('verification_code_expired')) {
        setCode('');
        setStep({
          kind: 'code',
          refusal: t('passwordCard.setCodeExpired'),
          paused: null,
          expired: true,
        });
        land(() => expiredLine.current);
        return;
      }

      const violation =
        error instanceof ApiError
          ? error.problem.violations?.find((v) => v.propertyPath === 'newPassword')
          : undefined;
      setPasswordRefusal(
        violation?.code === 'password_breached'
          ? t('register.breached')
          : (violation?.message ?? t('passwordCard.failedBody')),
      );
      landWhereSent('set-password');
    }
  }

  if (step.kind === 'password') {
    const error = passwordChecks.errors.password ?? passwordRefusal;

    return (
      <>
        <h2 id="password-title" ref={stepHeading} tabIndex={-1}>
          {t('passwordCard.setNewTitle')}
        </h2>
        <form className="auth-form" noValidate onSubmit={(event) => void save(event)}>
          <div className="field">
            <label htmlFor="set-password">{t('passwordCard.setNewLabel')}</label>
            <PasswordField
              id="set-password"
              autoComplete="new-password"
              inputRef={passwordInput}
              value={password}
              onChange={(value) => {
                setPassword(value);
                setPasswordRefusal(null);
                passwordChecks.edited('password', value);
              }}
              onBlur={(value) => passwordChecks.left('password', value)}
              wrong={error != null}
              disabled={busy}
              submitting={busy}
              describedBy={
                error == null ? 'set-password-rule' : 'set-password-error set-password-rule'
              }
            />
            {error != null && <FieldError id="set-password-error" message={error} />}
          </div>

          <PasswordRule met={meetsPasswordLength(password)} id="set-password-rule" />

          <p className="muted">{t('passwordCard.setEmailed', { email })}</p>

          <div className="actions">
            <button className="button" type="button" onClick={onCancel} disabled={busy}>
              {t('passwordCard.cancel')}
            </button>
            <button className="button button-primary" type="submit" aria-busy={busy}>
              {busy ? t('passwordCard.saving') : t('passwordCard.setSave')}
            </button>
          </div>
        </form>
      </>
    );
  }

  const codeError = codeChecks.errors.code ?? step.refusal;

  return (
    <>
      <h2 id="password-title" ref={stepHeading} tabIndex={-1}>
        {t('passwordCard.setCodeTitle')}
      </h2>

      {step.paused != null && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('passwordCard.pausedTitle')}</p>
            <p>{step.paused}</p>
          </div>
        </div>
      )}

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('passwordCard.failedTitle')}</p>
            <p>{t('passwordCard.setSendFailed')}</p>
          </div>
        </div>
      )}

      <p className="muted">{t('passwordCard.setCodeIntro', { email })}</p>

      <form className="auth-form" noValidate onSubmit={(event) => void passCode(event)}>
        <div className="field">
          <label htmlFor="set-code">{t('passwordCard.setCodeLabel')}</label>
          <input
            ref={codeInput}
            className={codeError == null ? 'code-input' : 'code-input input-wrong'}
            id="set-code"
            name="set-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            aria-invalid={codeError != null}
            aria-describedby={codeError == null ? undefined : 'set-code-error'}
            onChange={(event) => {
              setCode(event.target.value);
              if (step.refusal != null)
                setStep({ kind: 'code', refusal: null, paused: step.paused });
              codeChecks.edited('code', event.target.value);
            }}
            onBlur={(event) => codeChecks.left('code', event.target.value)}
          />
          {codeError != null &&
            (step.expired === true && codeChecks.errors.code == null ? (
              <div ref={expiredLine} tabIndex={-1}>
                <FieldError id="set-code-error" message={codeError} quiet />
              </div>
            ) : (
              <FieldError id="set-code-error" message={codeError} />
            ))}
        </div>

        <p className="muted">{t('passwordCard.setCodeNote')}</p>

        <div className="actions">
          <button className="button" type="button" onClick={onCancel}>
            {t('passwordCard.cancel')}
          </button>
          <button
            className="button"
            type="button"
            {...resending.button}
            onClick={() => void send(true)}
          >
            {resending.label}
          </button>
          <button className="button button-primary" type="submit" aria-busy={busy}>
            {t('passwordCard.continue')}
          </button>
        </div>
        <span className="visually-hidden" role="status">
          {resending.status}
        </span>
      </form>
    </>
  );
}

/** A refused code, in the card's words: a pause states its time, in the reader's clock. */
function codeRefusal(
  error: unknown,
  t: TFunction,
): { refusal: string | null; paused: string | null } {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    return {
      refusal: null,
      paused:
        liftsAt == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(liftsAt, dateLocale()) }),
    };
  }

  if (error instanceof ApiError && error.is('verification_code_expired')) {
    return { refusal: t('passwordCard.setCodeExpired'), paused: null };
  }

  if (error instanceof ApiError && error.is('verification_code_exhausted')) {
    return { refusal: t('passwordCard.setCodeSpent'), paused: null };
  }

  if (
    error instanceof ApiError &&
    (error.is('verification_code_invalid') || error.is('validation_failed'))
  ) {
    return { refusal: t('passwordCard.setCodeWrong'), paused: null };
  }

  return { refusal: t('passwordCard.failedBody'), paused: null };
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
  const heading = useRef<HTMLHeadingElement>(null);
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

  useLayoutEffect(() => focusStep(heading.current), []);

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
    const land = focusWhereSent();

    try {
      const { signedOut } = await api.changePassword({
        currentPassword: current,
        newPassword: next,
        sessionId: currentSessionId(),
      });
      onChanged(signedOut);
    } catch (error) {
      setSaving(false);

      const refused = refusalFrom(error, t);
      setRefusal(refused);
      if (refused.field === 'currentPassword') land('current-password');
      if (refused.field === 'newPassword') land('new-password');
    }
  }

  const currentError =
    checks.errors.currentPassword ??
    (refusal?.field === 'currentPassword' ? refusal.message : null);
  const nextError =
    checks.errors.newPassword ?? (refusal?.field === 'newPassword' ? refusal.message : null);

  return (
    <>
      <h2 id="password-title" ref={heading} tabIndex={-1}>
        {t('passwordCard.formTitle')}
      </h2>

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
            <Link
              className="link-button"
              to="/forgot-password"
              state={{ back: 'account' } satisfies ForgotFrom}
            >
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
          <button className="button" type="button" onClick={onCancel} disabled={saving}>
            {t('passwordCard.cancel')}
          </button>
          <button className="button button-primary" type="submit" aria-busy={saving}>
            {saving ? t('passwordCard.saving') : t('passwordCard.save')}
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
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(liftsAt, dateLocale()) }),
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
