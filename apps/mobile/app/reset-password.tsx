import { type Account, ApiError, awaiting } from '@soirely/api-client';
import { meetsPasswordLength } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { Field } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { PasswordField } from '../src/components/PasswordField.tsx';
import { PasswordRule } from '../src/components/PasswordRule.tsx';
import { useFormChecks } from '../src/kit/formChecks.ts';
import { landingFor } from '../src/landing.ts';
import { tokens } from '../src/theme/tokens.ts';

type Status =
  | { kind: 'checking' }
  | { kind: 'ready'; email: string }
  | { kind: 'saving'; email: string }
  | { kind: 'failed'; email: string }
  | { kind: 'done'; email: string; account: Account }
  | { kind: 'used' }
  | { kind: 'expired' }
  | { kind: 'invalid' };

/** "Set a new password", from the emailed link. */
export default function ResetPassword() {
  const { t } = useTranslation();
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [lengthMet, setLengthMet] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const typed = useRef('');
  const passwordInput = useRef<TextInput>(null);
  const checks = useFormChecks(
    ['password'] as const,
    (_field, value) => (value === '' ? t('recovery.passwordBlank') : null),
    () => passwordInput.current?.focus(),
  );

  useEffect(() => {
    let live = true;

    api
      .checkResetLink(token)
      .then(({ email }) => {
        if (live) setStatus({ kind: 'ready', email });
      })
      .catch((error: unknown) => {
        if (live) setStatus({ kind: deadFrom(error) ?? 'invalid' });
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
      passwordInput.current?.focus();
      return;
    }

    const email = status.email;
    setStatus({ kind: 'saving', email });

    try {
      const { account } = await api.resetPassword(token, typed.current);
      setStatus({ kind: 'done', email, account });
    } catch (error) {
      const dead = deadFrom(error);

      if (dead != null) {
        setStatus({ kind: dead });
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

  if (status.kind === 'checking') return null;

  if (status.kind === 'used' || status.kind === 'expired' || status.kind === 'invalid') {
    return (
      <AuthFrame
        saying={
          <AuthHeading
            title={t(`recovery.${status.kind}Title`)}
            intro={t(`recovery.${status.kind}Body`)}
          />
        }
      >
        <PrimaryButton
          label={t('recovery.sendNew')}
          onPress={() => router.replace('/forgot-password')}
          testID="recovery.sendNew"
        />
        <Footnote
          {...(status.kind === 'expired' ? { question: t('recovery.rememberedAfterAll') } : {})}
          action={t('recovery.signIn')}
          onPress={() => router.replace('/sign-in')}
          role="link"
          testID="recovery.signIn"
        />
      </AuthFrame>
    );
  }

  if (status.kind === 'done') {
    return (
      <AuthFrame
        atFoot
        saying={
          <AuthHeading
            done
            title={t('recovery.doneTitle')}
            intro={t('recovery.doneBody', { email: status.email })}
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
          title={t('recovery.newTitle')}
          intro={t('recovery.newFor', { email: status.email })}
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
          />
        )}

        <Field label={t('recovery.newPassword')} error={error}>
          <PasswordField
            ref={passwordInput}
            wrong={error != null}
            submitting={saving}
            editable={!saving}
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
            onSubmitEditing={() => void submit()}
            accessibilityLabel={t('recovery.newPassword')}
            testID="recovery.password"
          />
        </Field>

        <PasswordRule met={lengthMet} testID="recovery" />

        <Notice tone="quiet" mark="i" body={t('recovery.signsOut')} />

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
  form: { gap: tokens.spaceXl },
});
