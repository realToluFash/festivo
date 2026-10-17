import {
  ApiError,
  type LinkedProvider,
  type ProviderSignInAttempt,
  proofRefusal,
} from '@soirely/api-client';
import { formatTimeOfDay } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { AppleMark, GoogleMark } from '../../../components/ProviderSignIn.tsx';
import { useFormChecks } from '../../../formChecks.ts';
import { currentLocale } from '../../../i18n/index.ts';
import {
  PROVIDER_NAMES,
  type ProviderReturn,
  startProviderSignIn,
} from '../../../providerSignIn.ts';

type Field = 'password' | 'code';

type Refusal =
  | { kind: 'field'; field: Field; message: string }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'failed'; message: string };

/** The devices card's check for sign out everywhere else (sc-115): prove it is you, then every other session ends. */
export function EverywhereElse({
  count,
  sessionId,
  hasPassword,
  providers,
  returned,
  onDone,
  onKeep,
}: {
  count: number;
  sessionId: string | null;
  hasPassword: boolean;
  providers: readonly LinkedProvider[];
  returned: ProviderReturn | null;
  onDone: (result: { signedOut: number; thisDevice: boolean }) => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const provider = hasPassword ? null : (providers[0]?.provider ?? null);
  const signIn: ProviderSignInAttempt | null =
    returned != null && 'signIn' in returned ? returned.signIn : null;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeAsked, setCodeAsked] = useState(false);
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(() =>
    returned != null && 'failed' in returned && returned.failed === 'failed'
      ? {
          kind: 'failed',
          message: t('devices.everywhereProviderFailed', {
            provider: PROVIDER_NAMES[returned.provider],
          }),
        }
      : null,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const askPassword = hasPassword && signIn == null;
  const keepsThisDevice = sessionId != null;

  const checks = useFormChecks<Field>(
    askPassword ? ['password', 'code'] : ['code'],
    (field, value) => {
      if (field === 'password') return value === '' ? t('devices.everywherePasswordBlank') : null;

      return codeAsked && value.trim() === '' ? t('devices.everywhereCodeBlank') : null;
    },
    (field) =>
      field === 'password'
        ? passwordInput.current?.focus()
        : document.getElementById('everywhere-code')?.focus(),
  );

  async function signOut(second: string | undefined): Promise<void> {
    setWorking(true);

    try {
      const { proof } = await api.prove(
        signIn != null && returned != null ? { provider: returned.provider, signIn } : { password },
        second,
      );
      onDone(await api.signOutEverywhereElse(proof, sessionId));
    } catch (error) {
      setWorking(false);

      if (error instanceof ApiError && error.is('two_factor_required')) {
        setCodeAsked(true);

        return;
      }

      setRefusal(refusalFor(error, signIn != null, t));
    }
  }

  useEffect(() => {
    heading.current?.focus();

    // Strict mode runs this twice, and a provider's code is spent on first use.
    if (started.current) return;
    started.current = true;

    void api
      .twoFactorStatus()
      .catch(() => ({ on: false, recoveryCodesLeft: 0 }))
      .then((status) => {
        setCodeAsked(status.on);
        if (signIn != null && !status.on) void signOut(undefined);
      });
    // Once, on arrival: what came back from the provider is taken then and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (working || refusal?.kind === 'limited' || !checks.passes({ password, code })) return;

    await signOut(codeAsked ? code.trim() : undefined);
  }

  const until =
    refusal?.kind === 'limited' && refusal.until != null
      ? formatTimeOfDay(refusal.until, currentLocale())
      : null;
  const passwordError =
    checks.errors.password ??
    (refusal?.kind === 'field' && refusal.field === 'password' ? refusal.message : null);
  const codeError =
    checks.errors.code ??
    (refusal?.kind === 'field' && refusal.field === 'code' ? refusal.message : null);
  const viaProvider = provider != null && signIn == null;

  return (
    <>
      <h2 id="devices-title" tabIndex={-1} ref={heading}>
        {t('devices.everywhereTitle')}
      </h2>
      <p>
        {keepsThisDevice
          ? t('devices.everywhereBody', { count })
          : t('devices.everywhereSelf', { count })}
      </p>

      {refusal?.kind === 'limited' && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('devices.everywhereLimitedTitle')}</p>
            <p>
              {until == null
                ? t('devices.everywhereLimitedSoon')
                : t('devices.everywhereLimitedBody', { time: until })}
            </p>
          </div>
        </div>
      )}

      {refusal?.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('devices.everywhereFailedTitle')}</p>
            <p>{refusal.message}</p>
          </div>
        </div>
      )}

      {signIn != null && returned != null && codeAsked && (
        <p className="muted">
          {t('devices.everywhereProviderConfirmed', {
            provider: PROVIDER_NAMES[returned.provider],
          })}
        </p>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        {askPassword && (
          <div className="field">
            <label htmlFor="everywhere-password">{t('devices.everywherePassword')}</label>
            <PasswordField
              id="everywhere-password"
              autoComplete="current-password"
              inputRef={passwordInput}
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (refusal?.kind === 'field' && refusal.field === 'password') setRefusal(null);
                checks.edited('password', value);
              }}
              onBlur={(value) => checks.left('password', value)}
              wrong={passwordError != null}
              disabled={working}
              submitting={working}
              describedBy={
                passwordError == null
                  ? 'everywhere-password-help'
                  : 'everywhere-password-error everywhere-password-help'
              }
            />
            {passwordError != null && (
              <FieldError id="everywhere-password-error" message={passwordError} />
            )}
            <p className="field-help" id="everywhere-password-help">
              {t('devices.everywhereWhy')}
            </p>
          </div>
        )}

        {viaProvider && (
          <p className="muted">
            {t('devices.everywhereProvider', { provider: PROVIDER_NAMES[provider] })}
          </p>
        )}

        {codeAsked && (askPassword || signIn != null) && (
          <div className="field">
            <label htmlFor="everywhere-code">{t('devices.everywhereCode')}</label>
            <input
              className={codeError == null ? 'input' : 'input input-wrong'}
              id="everywhere-code"
              type="text"
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
              value={code}
              disabled={working}
              aria-invalid={codeError != null}
              aria-describedby={
                codeError == null
                  ? 'everywhere-code-help'
                  : 'everywhere-code-error everywhere-code-help'
              }
              onChange={(event) => {
                setCode(event.target.value);
                if (refusal?.kind === 'field' && refusal.field === 'code') setRefusal(null);
                checks.edited('code', event.target.value);
              }}
              onBlur={(event) => checks.left('code', event.target.value)}
            />
            {codeError != null && <FieldError id="everywhere-code-error" message={codeError} />}
            <p className="field-help" id="everywhere-code-help">
              {t('devices.everywhereCodeHelp')}
            </p>
          </div>
        )}

        <div className="notice notice-attention">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('devices.everywhereWarning', { count })}</p>
            <p>{t('devices.everywhereWarningBody', { count })}</p>
          </div>
        </div>

        <div className="actions">
          {viaProvider ? (
            <button
              className={provider === 'google' ? 'button button-google' : 'button button-apple'}
              type="button"
              onClick={() => {
                void startProviderSignIn(provider, { kind: 'signOutOthers' }).catch(() =>
                  setRefusal({
                    kind: 'failed',
                    message: t('devices.everywhereProviderFailed', {
                      provider: PROVIDER_NAMES[provider],
                    }),
                  }),
                );
              }}
            >
              {provider === 'google' ? <GoogleMark /> : <AppleMark />}
              <span>
                {t('devices.everywhereContinueWith', { provider: PROVIDER_NAMES[provider] })}
              </span>
            </button>
          ) : (
            <button
              className="button button-dark"
              type="submit"
              aria-busy={working}
              disabled={refusal?.kind === 'limited'}
            >
              {refusal?.kind === 'limited'
                ? until == null
                  ? t('devices.everywhereRetrySoon')
                  : t('devices.everywhereRetryAt', { time: until })
                : working
                  ? t('devices.everywhereWorking')
                  : keepsThisDevice
                    ? t('devices.everywhereConfirm', { count })
                    : t('devices.everywhereConfirmAll', { count })}
            </button>
          )}
          <button className="button" type="button" onClick={onKeep} disabled={working}>
            {t('devices.everywhereKeep', { count })}
          </button>
        </div>
      </form>
    </>
  );
}

function refusalFor(error: unknown, viaProvider: boolean, t: TFunction): Refusal {
  const refusal = proofRefusal(error, !viaProvider);

  if (refusal.kind === 'limited') return refusal;
  if (refusal.kind === 'field')
    return {
      ...refusal,
      message:
        refusal.field === 'password'
          ? t('devices.everywherePasswordWrong')
          : t('devices.everywhereCodeWrong'),
    };

  return { kind: 'failed', message: t('devices.everywhereFailedBody') };
}
