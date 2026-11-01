import { type Account, ApiError, awaiting } from '@soirely/api-client';
import { meetsPasswordLength } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { followAccount } from '../src/accountLanguage.ts';
import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { Field, focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { PasswordField } from '../src/components/PasswordField.tsx';
import { Pending } from '../src/components/Pending.tsx';
import { PasswordRule } from '../src/components/PasswordRule.tsx';
import { SecondFactorStep } from '../src/components/SecondFactorStep.tsx';
import { useFormChecks } from '../src/kit/formChecks.ts';
import { ruleRefusal, signInRoute } from '../src/kit/signInRules.ts';
import { landingFor } from '../src/landing.ts';
import { tokens } from '../src/theme/tokens.ts';

type Status =
  | { kind: 'checking' }
  | { kind: 'ready'; email: string; tapped?: boolean }
  | { kind: 'saving'; email: string }
  | { kind: 'failed'; email: string }
  | { kind: 'done'; email: string; account: Account }
  | { kind: 'code'; email: string }
  | { kind: 'used'; tapped: boolean }
  | { kind: 'expired'; tapped: boolean }
  | { kind: 'invalid'; tapped: boolean };

/** "Set a new password", from the emailed link. */
export default function ResetPassword() {
  const { t } = useTranslation();
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [lengthMet, setLengthMet] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const typed = useRef('');
  const passwordInput = useRef<TextInputInstance>(null);
  const checks = useFormChecks(
    ['password'] as const,
    (_field, value) => (value === '' ? t('recovery.passwordBlank') : null),
    () => focusChecked(passwordInput),
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
        if (live) setStatus({ kind: deadFrom(error) ?? 'invalid', tapped: false });
      });

    return () => {
      live = false;
    };
  }, [token]);

  async function submit(): Promise<void> {
    if (status.kind !== 'ready' && status.kind !== 'failed') return;
    if (!checks.passes({ password: typed.current })) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(typed.current)) {
      focusChecked(passwordInput);
      return;
    }

    const email = status.email;
    keysStayDown();
    setStatus({ kind: 'saving', email });

    try {
      const { account } = await api.resetPassword(token, typed.current);
      await followAccount(account);
      setStatus({ kind: 'done', email, account });
    } catch (error) {
      const dead = deadFrom(error);
      const refusal = error instanceof ApiError ? ruleRefusal(error.problem) : null;

      // The password is set, but signs in only where a password sign-in would (sc-69).
      if (refusal != null) {
        router.replace(signInRoute(refusal, false));
      } else if (dead != null) {
        setStatus({ kind: dead, tapped: true });
      } else if (error instanceof ApiError && error.is('validation_failed')) {
        const violation = error.problem.violations?.find((v) => v.propertyPath === 'password');
        setRefusal(
          violation?.code === 'password_breached'
            ? t('register.breached')
            : (violation?.message ?? null),
        );
        setStatus({ kind: 'ready', email });
      } else {
        setStatus({ kind: 'failed', email });
      }
    }
  }

  if (status.kind === 'checking') {
    return (
      <AuthFrame>
        <Pending />
      </AuthFrame>
    );
  }

  if (status.kind === 'used' || status.kind === 'expired' || status.kind === 'invalid') {
    return (
      <AuthFrame
        saying={
          <AuthHeading
            apart
            title={t(`recovery.${status.kind}Title`)}
            intro={t(`recovery.${status.kind}Body`)}
            answer={status.tapped ? status : undefined}
          />
        }
      >
        <PrimaryButton
          label={t('recovery.sendNew')}
          onPress={() => router.replace('/forgot-password?from=link')}
          testID="recovery.sendNew"
        />
        <Footnote
          {...(status.kind === 'expired' ? { question: t('recovery.rememberedAfterAll') } : {})}
          action={t('recovery.signIn')}
          onPress={() => router.replace('/sign-in')}
          role="link"
          testID="recovery.signIn"
          centred
        />
      </AuthFrame>
    );
  }

  if (status.kind === 'code') {
    const email = status.email;

    return (
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
            setStatus({ kind: dead, tapped: true });
            return;
          }
          setStatus({ kind: 'ready', email, tapped: true });
        }}
        onExpired={() => setStatus({ kind: 'expired', tapped: false })}
      />
    );
  }

  if (status.kind === 'done') {
    return (
      <AuthFrame
        atFoot
        saying={
          <AuthHeading
            apart
            done
            title={t('recovery.doneTitle')}
            intro={t('recovery.doneBody', { email: status.email })}
            answer={status}
          />
        }
      >
        <PrimaryButton
          label={t('recovery.continue')}
          onPress={() => router.replace(landingFor(awaiting(status.account)))}
          testID="recovery.continue"
        />
      </AuthFrame>
    );
  }

  const saving = status.kind === 'saving';
  const error = checks.errors.password ?? refusal;

  return (
    <AuthFrame
      saying={
        <AuthHeading
          apart
          title={t('recovery.newTitle')}
          intro={t('recovery.newFor', { email: status.email })}
          answer={status.kind === 'ready' && status.tapped === true ? status : undefined}
        />
      }
    >
      <View style={styles.form}>
        {status.kind === 'failed' && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('recovery.failedTitle')}
            body={t('recovery.failedBody')}
            answer={status}
          />
        )}

        <Field label={t('recovery.newPassword')} error={error}>
          <PasswordField
            ref={passwordInput}
            wrong={error != null}
            submitting={saving}
            autoComplete="new-password"
            textContentType="newPassword"
            onChangeText={(text) => {
              typed.current = text;
              setLengthMet(meetsPasswordLength(text));
              setRefusal(null);
              checks.edited('password', text);
            }}
            onBlur={() => checks.left('password', typed.current)}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => void submit()}
            accessibilityLabel={t('recovery.newPassword')}
            testID="recovery.password"
          />
        </Field>

        <PasswordRule met={lengthMet} testID="recovery" />

        <Notice tone="plain" mark="i" body={t('recovery.signsOut')} />

        <PrimaryButton
          label={saving ? t('recovery.saving') : t('recovery.save')}
          onPress={() => void submit()}
          busy={saving}
          testID="recovery.save"
        />
      </View>
    </AuthFrame>
  );
}

function deadFrom(error: unknown): 'used' | 'expired' | 'invalid' | null {
  if (!(error instanceof ApiError)) return null;
  if (error.is('reset_link_used')) return 'used';
  if (error.is('reset_link_expired')) return 'expired';
  if (error.is('reset_link_invalid')) return 'invalid';

  return null;
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXxl },
});
