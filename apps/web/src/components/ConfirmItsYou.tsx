import {
  ApiError,
  type Provider,
  type ProviderSignInAttempt,
  proofRefusal,
} from '@soirely/api-client';
import { PROOF_MINUTES, formatTimeOfDay } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useFormChecks } from '../formChecks.ts';
import { currentLocale } from '../i18n/index.ts';
import { PROVIDER_NAMES, type ReturnPurpose, startProviderSignIn } from '../providerSignIn.ts';
import { dropProof, holdProof } from '../recentProof.ts';
import { FieldError } from './FieldError.tsx';
import { PasswordField } from './PasswordField.tsx';
import { AppleMark, GoogleMark } from './ProviderSignIn.tsx';

type ProvingField = 'password' | 'code';

/** "Confirm it's you" for every change to how an account signs in: the password or a provider, then the code. */
export function ConfirmItsYou({
  idPrefix,
  intro,
  via,
  twoFactorOn,
  returned,
  purpose,
  note,
  onProved,
  onCodeSpent,
  onCancel,
}: {
  idPrefix: string;
  intro: string;
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
  returned: ProviderSignInAttempt | null;
  /** Where Google or Apple brings the person back to, and for what. */
  purpose: ReturnPurpose;
  note?: ReactNode;
  onProved: (proof: string) => void;
  /** A two-factor or recovery code was accepted, so a count of unused codes may be stale. */
  onCodeSpent?: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  // Dropped when the five minutes from the provider's sign-in run out: back to step one, the change kept.
  const [signIn, setSignIn] = useState(returned);
  const [expired, setExpired] = useState(false);
  const askPassword = via === 'password' && signIn == null;
  const viaProvider = via === 'password' ? null : via;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [refusal, setRefusal] = useState<{
    field: ProvingField | 'failed';
    message: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  // The API's kept proof once a sign-in waits for its code: Google's or Apple's is single-use (RFC 6749 §4.1.2).
  const kept = useRef<string | null>(null);
  // Turned on in the two-factor card since this page loaded: the API says so, and the field appears.
  const [codeAsked, setCodeAsked] = useState(twoFactorOn);
  // Step two after Google or Apple: the sign-in passed and the code is asked for (sc-2197).
  const [vouched, setVouched] = useState<{ email: string | null } | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const checks = useFormChecks<ProvingField>(
    askPassword ? ['password', 'code'] : ['code'],
    (field, value) => {
      if (field === 'password') return value === '' ? t('waysCard.passwordBlank') : null;

      return codeAsked && value.trim() === '' ? t('waysCard.codeBlank') : null;
    },
    (field) =>
      field === 'password'
        ? passwordInput.current?.focus()
        : document.getElementById(`${idPrefix}-code`)?.focus(),
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking || !checks.passes({ password, code })) return;

    await send(codeAsked ? code.trim() : undefined);
  }

  async function send(second: string | undefined): Promise<void> {
    setChecking(true);

    try {
      const proof = await api.prove(
        kept.current != null
          ? { pendingProof: kept.current }
          : signIn != null && viaProvider != null
            ? { provider: viaProvider, signIn }
            : { password },
        second,
      );
      holdProof(proof);
      if (second != null) onCodeSpent?.();
      onProved(proof.proof);
    } catch (error) {
      setChecking(false);
      dropProof();

      if (error instanceof ApiError && error.is('two_factor_required')) {
        if (signIn != null) {
          kept.current = error.problem.pendingProof ?? kept.current;
          const email = error.problem.providerEmail ?? null;
          setVouched((now) => now ?? { email });
        }
        setCodeAsked(true);

        return;
      }

      if (signIn != null && error instanceof ApiError && error.is('proof_required')) {
        setSignIn(null);
        kept.current = null;
        setVouched(null);
        setCode('');
        setRefusal(null);
        setExpired(true);
        heading.current?.focus();

        return;
      }

      if (signIn != null && error instanceof ApiError)
        kept.current = error.problem.pendingProof ?? kept.current;
      setRefusal(
        provingRefusal(
          error,
          t,
          signIn != null && viaProvider != null ? PROVIDER_NAMES[viaProvider] : null,
        ),
      );
    }
  }

  // Google's or Apple's sign-in is exchanged the moment it returns: the five minutes count from it, not the code.
  const exchanged = useRef(false);

  useEffect(() => {
    heading.current?.focus();
    if (signIn == null || exchanged.current) return;
    exchanged.current = true;
    void send(undefined);
    // Once, on arrival: what came back from the provider is taken then and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passwordError =
    checks.errors.password ?? (refusal?.field === 'password' ? refusal.message : null);
  const codeError = checks.errors.code ?? (refusal?.field === 'code' ? refusal.message : null);
  const stepTwo = vouched != null && signIn != null && viaProvider != null ? viaProvider : null;
  const codeHelp =
    stepTwo == null ? `${idPrefix}-code-help` : `${idPrefix}-code-help ${idPrefix}-code-kept`;

  return (
    <>
      <h2 id={`${idPrefix}-title`} tabIndex={-1} ref={heading}>
        {t('waysCard.proveTitle')}
      </h2>
      <p>{intro}</p>

      {refusal?.field === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('waysCard.failedTitle')}</p>
            <p>{refusal.message}</p>
          </div>
        </div>
      )}

      {expired && viaProvider != null && (
        <div className="notice notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <p>
            {t('waysCard.proofExpired', {
              provider: PROVIDER_NAMES[viaProvider],
              count: PROOF_MINUTES,
            })}
          </p>
        </div>
      )}

      {stepTwo != null && (
        <div className="notice notice-quiet signed-in" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <div className="notice-body">
            <p className="notice-title">
              {t('waysCard.signedInWith', { provider: PROVIDER_NAMES[stepTwo] })}
            </p>
            {vouched?.email != null && <p className="signed-in-address">{vouched.email}</p>}
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        {askPassword && (
          <div className="field">
            <label htmlFor={`${idPrefix}-password`}>{t('waysCard.yourPassword')}</label>
            <PasswordField
              id={`${idPrefix}-password`}
              autoComplete="current-password"
              inputRef={passwordInput}
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (refusal?.field === 'password') setRefusal(null);
                checks.edited('password', value);
              }}
              onBlur={(value) => checks.left('password', value)}
              wrong={passwordError != null}
              disabled={checking}
              submitting={checking}
              describedBy={passwordError == null ? undefined : `${idPrefix}-password-error`}
            />
            {passwordError != null && (
              <FieldError id={`${idPrefix}-password-error`} message={passwordError} />
            )}
          </div>
        )}

        {codeAsked && (askPassword || signIn != null) && (
          <div className="field">
            <label htmlFor={`${idPrefix}-code`}>{t('waysCard.code')}</label>
            <input
              className={codeError == null ? 'input' : 'input input-wrong'}
              id={`${idPrefix}-code`}
              type="text"
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
              value={code}
              disabled={checking}
              aria-invalid={codeError != null}
              aria-describedby={codeError == null ? codeHelp : `${idPrefix}-code-error ${codeHelp}`}
              onChange={(event) => {
                setCode(event.target.value);
                if (refusal?.field === 'code') setRefusal(null);
                checks.edited('code', event.target.value);
              }}
              onBlur={(event) => checks.left('code', event.target.value)}
            />
            {codeError != null && <FieldError id={`${idPrefix}-code-error`} message={codeError} />}
            <p className="field-help" id={`${idPrefix}-code-help`}>
              {t('waysCard.codeHelp')}
            </p>
            {stepTwo != null && (
              <p className="field-help" id={`${idPrefix}-code-kept`}>
                {t('waysCard.codeKeepsSignIn', {
                  provider: PROVIDER_NAMES[stepTwo],
                  count: PROOF_MINUTES,
                })}
              </p>
            )}
          </div>
        )}

        {note}

        {askPassword || signIn != null ? (
          <div className="actions">
            <button className="button button-primary" type="submit" aria-busy={checking}>
              {checking ? t('waysCard.checking') : t('waysCard.continue')}
            </button>
            <button className="button" type="button" onClick={onCancel} disabled={checking}>
              {t('waysCard.cancel')}
            </button>
          </div>
        ) : (
          viaProvider != null && (
            <>
              <p className="muted">
                {t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[viaProvider] })}
              </p>
              <div className="actions">
                <button
                  className={
                    viaProvider === 'google' ? 'button button-google' : 'button button-apple'
                  }
                  type="button"
                  onClick={() => {
                    void startProviderSignIn(viaProvider, purpose).catch(() =>
                      setRefusal({
                        field: 'failed',
                        message: t('waysCard.providerFailed', {
                          provider: PROVIDER_NAMES[viaProvider],
                        }),
                      }),
                    );
                  }}
                >
                  {viaProvider === 'google' ? <GoogleMark /> : <AppleMark />}
                  <span>
                    {t('waysCard.continueWith', { provider: PROVIDER_NAMES[viaProvider] })}
                  </span>
                </button>
                <button className="button" type="button" onClick={onCancel}>
                  {t('waysCard.cancel')}
                </button>
              </div>
            </>
          )
        )}
      </form>
    </>
  );
}

function provingRefusal(
  error: unknown,
  t: TFunction,
  providerName: string | null,
): { field: ProvingField | 'failed'; message: string } {
  const refusal = proofRefusal(error, providerName == null);

  if (refusal.kind === 'trip')
    return { field: 'failed', message: t('waysCard.providerRefused', { provider: providerName }) };

  if (refusal.kind === 'limited')
    return {
      field: 'failed',
      message:
        refusal.until == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(refusal.until, currentLocale()) }),
    };
  if (refusal.kind === 'field')
    return {
      field: refusal.field,
      message: refusal.field === 'password' ? t('waysCard.passwordWrong') : t('waysCard.codeWrong'),
    };

  return { field: 'failed', message: t('waysCard.failedBody') };
}
