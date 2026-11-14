import { type Provider, type ProviderSignInAttempt } from '@soirely/api-client';
import { PROOF_MINUTES } from '@soirely/domain';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useFormChecks } from '../formChecks.ts';
import { focusWhereSent, offField } from '../offField.ts';
import { PROVIDER_NAMES, type ReturnPurpose, startProviderSignIn } from '../providerSignIn.ts';
import { useProving } from '../proving.ts';
import { dropProof, holdProof } from '../recentProof.ts';
import { FieldError } from './FieldError.tsx';
import { PasswordField } from './PasswordField.tsx';
import { AppleMark, GoogleMark } from './ProviderSignIn.tsx';
import { ActionPair } from './ActionPair.tsx';

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
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const passwordInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Before the hook's own arrival exchange, so a refusal on arrival lands from the heading.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const proving = useProving({
    via,
    twoFactorOn,
    returned,
    prove: async (first, second) => {
      try {
        const proof = await api.prove(first, second);
        holdProof(proof);
        if (second != null) onCodeSpent?.();

        return proof.proof;
      } catch (error) {
        dropProof();
        throw error;
      }
    },
    onProved,
    onSend: () => {
      const land = focusWhereSent();

      return (outcome) => {
        if (outcome.kind === 'code' && !outcome.afterProvider) land(`${idPrefix}-code`);
        if (outcome.kind === 'expired') {
          setCode('');
          heading.current?.focus();
        }
        if (outcome.kind === 'refused' && outcome.refusal.field !== 'failed')
          land(`${idPrefix}-${outcome.refusal.field}`);
      };
    },
  });
  const { signIn, expired, refusal, setRefusal, checking, codeAsked, vouched, askPassword } =
    proving;
  const viaProvider = proving.provider;

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

    await proving.send(password, codeAsked ? code.trim() : undefined);
  }

  const passwordError =
    checks.errors.password ?? (refusal?.field === 'password' ? refusal.message : null);
  const codeError = checks.errors.code ?? (refusal?.field === 'code' ? refusal.message : null);
  const stepTwo = proving.stepTwo;
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
              {...offField(checking)}
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
          <ActionPair
            dismiss={
              <button className="button" type="button" onClick={onCancel} disabled={checking}>
                {t('waysCard.cancel')}
              </button>
            }
            confirm={
              <button className="button button-primary" type="submit" aria-busy={checking}>
                {checking ? t('waysCard.checking') : t('waysCard.continue')}
              </button>
            }
          />
        ) : (
          viaProvider != null && (
            <>
              <p className="muted">
                {t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[viaProvider] })}
              </p>
              <ActionPair
                dismiss={
                  <button className="button" type="button" onClick={onCancel}>
                    {t('waysCard.cancel')}
                  </button>
                }
                confirm={
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
                }
              />
            </>
          )
        )}
      </form>
    </>
  );
}
