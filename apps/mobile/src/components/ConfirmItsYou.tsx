import {
  ApiError,
  type Provider,
  ProviderCancelled,
  type ProviderSignInAttempt,
} from '@soirely/api-client';
import { PROOF_MINUTES } from '@soirely/domain';
import { type ReactNode, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { useFormChecks } from '../kit/formChecks.ts';
import {
  type ProvingField,
  codeBeforeTrip,
  codeHelp,
  firstFactor,
  keptOnceCodeAsked,
  keptProofRanOut,
  provingRefusal,
  type SignedIn,
  signedInWith,
  tripRefused,
} from '../kit/waysProof.ts';
import { PROVIDER_NAMES, confirmWithProvider } from '../providerSignIn.ts';
import { holdProof } from '../recentProof.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { CodeField, Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { useAboveKeyboard } from './Screen.tsx';
import { Text } from './Text.tsx';

/** "Confirm it's you" in the app (sc-510): the password, or Google or Apple on the spot, then the code with two-factor on. */
export function ConfirmItsYou({
  idPrefix,
  intro,
  via,
  twoFactorOn,
  note,
  onProved,
  onCodeSpent,
  onCancel,
}: {
  idPrefix: string;
  intro: string;
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
  note?: ReactNode;
  onProved: (proof: string) => void;
  /** A two-factor or recovery code was accepted, so a count of unused codes may be stale. */
  onCodeSpent?: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const password = useRef('');
  const code = useRef('');
  const passwordInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
  // With a provider, the code is asked for when it returns, never before the trip (a code lapses in 30 seconds).
  const [codeAsked, setCodeAsked] = useState(codeBeforeTrip(via, twoFactorOn));
  const returned = useRef<ProviderSignInAttempt | null>(null);
  const kept = useRef<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [signedIn, setSignedIn] = useState<SignedIn | null>(null);
  const [checking, setChecking] = useState(false);
  const [refusal, setRefusal] = useState<{
    field: ProvingField | 'failed';
    message: string;
  } | null>(null);
  const aboveKeyboard = useAboveKeyboard();
  const checks = useFormChecks(
    (via === 'password' ? ['password', 'code'] : ['code']) as readonly ProvingField[],
    (field, value) =>
      field === 'password'
        ? value === ''
          ? t('waysCard.passwordBlank')
          : null
        : codeAsked && value.trim() === ''
          ? t('waysCard.codeBlank')
          : null,
    (field) => (field === 'password' ? passwordInput : codeInput).current?.focus(),
  );

  async function submit(): Promise<void> {
    if (checking || !checks.passes({ password: password.current, code: code.current })) return;

    setChecking(true);
    setRefusal(null);
    setExpired(false);
    const sentKept = kept.current != null;

    try {
      if (via !== 'password' && via != null && kept.current == null)
        returned.current ??= await confirmWithProvider(via, true);

      const first = firstFactor(via, kept.current, returned.current, password.current);
      const proved = await api.prove(first, codeAsked ? code.current.trim() : undefined);
      holdProof(proved);
      if (codeAsked) onCodeSpent?.();
      onProved(proved.proof);
    } catch (error) {
      setChecking(false);

      if (error instanceof ProviderCancelled) return;
      setSignedIn((now) => signedInWith(via, error, now));
      // The sign-in passed and waits for its code: the retry sends the API's kept proof, dated from the sign-in.
      if (error instanceof ApiError && error.is('two_factor_required')) {
        kept.current = keptOnceCodeAsked(via, error, kept.current);
        setCodeAsked(true);

        return;
      }

      if (via !== 'password' && keptProofRanOut(error, sentKept)) {
        kept.current = null;
        returned.current = null;
        code.current = '';
        setCodeAsked(codeBeforeTrip(via, twoFactorOn));
        setExpired(true);

        return;
      }

      // Only a refused trip is made again: after a wrong code the next Continue sends the API's kept proof.
      kept.current = keptOnceCodeAsked(via, error, kept.current);
      if (via !== 'password' && tripRefused(error)) returned.current = null;
      setRefusal(
        provingRefusal(
          error,
          t,
          via === 'password' || via == null ? null : PROVIDER_NAMES[via],
          currentLocale(),
        ),
      );
    }
  }

  const passwordError =
    checks.errors.password ?? (refusal?.field === 'password' ? refusal.message : null);
  const codeError = checks.errors.code ?? (refusal?.field === 'code' ? refusal.message : null);
  const stepTwo = signedIn != null && via !== 'password' && via != null ? via : null;

  return (
    <>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('waysCard.proveTitle')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {intro}
      </Text>

      {expired && via !== 'password' && via != null && (
        <Notice
          tone="attention"
          mark="!"
          body={t('waysCard.proofExpired', { provider: PROVIDER_NAMES[via], count: PROOF_MINUTES })}
        />
      )}

      {stepTwo != null && (
        <Notice
          tone="quiet"
          mark={tokens.marks.done.glyph}
          markTone="done"
          title={t('waysCard.signedInWith', { provider: PROVIDER_NAMES[stepTwo] })}
          accentTitle
          detail={signedIn?.email ?? null}
          announce
        />
      )}

      {refusal?.field === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('waysCard.failedTitle')}
          body={refusal.message}
        />
      )}

      {via === 'password' && (
        <Field label={t('waysCard.yourPassword')} error={passwordError}>
          <PasswordField
            ref={passwordInput}
            wrong={passwordError != null}
            submitting={checking}
            editable={!checking}
            autoComplete="current-password"
            textContentType="password"
            onChangeText={(text) => {
              password.current = text;
              if (refusal?.field === 'password') setRefusal(null);
              checks.edited('password', text);
            }}
            onBlur={() => checks.left('password', password.current)}
            returnKeyType={codeAsked ? 'next' : 'done'}
            onSubmitEditing={() => (codeAsked ? codeInput.current?.focus() : void submit())}
            accessibilityLabel={t('waysCard.yourPassword')}
            testID={`${idPrefix}.password`}
          />
        </Field>
      )}

      <View {...aboveKeyboard} style={styles.group}>
        {codeAsked && (
          <Field
            label={t('waysCard.code')}
            error={codeError}
            help={codeHelp(t, stepTwo == null ? null : PROVIDER_NAMES[stepTwo])}
          >
            <CodeField
              ref={codeInput}
              takesRecoveryCode
              wrong={codeError != null}
              editable={!checking}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onChangeText={(text) => {
                code.current = text;
                if (refusal?.field === 'code') setRefusal(null);
                checks.edited('code', text);
              }}
              onBlur={() => checks.left('code', code.current)}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              accessibilityLabel={t('waysCard.code')}
              testID={`${idPrefix}.code`}
            />
          </Field>
        )}

        {note}

        {via !== 'password' && via != null && stepTwo == null && (
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {t('waysCard.proveWithProvider', { provider: PROVIDER_NAMES[via] })}
          </Text>
        )}

        <PrimaryButton
          label={
            checking
              ? t('waysCard.checking')
              : via === 'password' || via == null || codeAsked
                ? t('waysCard.continue')
                : t('waysCard.continueWith', { provider: PROVIDER_NAMES[via] })
          }
          onPress={() => void submit()}
          busy={checking}
          testID={`${idPrefix}.continue`}
        />
      </View>
      <QuietButton label={t('waysCard.cancel')} onPress={onCancel} testID={`${idPrefix}.cancel`} />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
});
