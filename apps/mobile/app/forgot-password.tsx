import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { Field, TextField } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { Text } from '../src/components/Text.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { emailMessage, useFormChecks } from '../src/kit/formChecks.ts';
import { tokens } from '../src/theme/tokens.ts';

type Status =
  | { kind: 'asking' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'limited'; time: string }
  | { kind: 'failed' };

/** "Reset your password": an address in, and the same answer whether or not it has an account. */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'asking' });
  const [typed, setTyped] = useState('');
  const emailInput = useRef<TextInput>(null);
  const checks = useFormChecks(
    ['email'] as const,
    (_field, value) => emailMessage(value, t),
    () => emailInput.current?.focus(),
  );

  async function send(email: string): Promise<void> {
    setStatus({ kind: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email });
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  function submit(): void {
    if (status.kind === 'sending') return;

    const email = typed.trim();
    if (!checks.passes({ email })) return;

    void send(email);
  }

  if (status.kind === 'sent') {
    return (
      <AuthFrame
        saying={<AuthHeading title={t('recovery.sentTitle')} intro={t('recovery.sentBody')} />}
      >
        <Notice
          tone="quiet"
          mark="i"
          title={t('recovery.nothingTitle')}
          body={t('recovery.nothingBody')}
        />
        <SecondaryButton
          label={t('recovery.sendAgain')}
          onPress={() => void send(status.email)}
          testID="recovery.sendAgain"
        />
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('recovery.providerNote')}
        </Text>
        <Footnote
          question={t('recovery.gotIt')}
          action={t('recovery.backToSignIn')}
          onPress={() => router.replace('/sign-in')}
          role="link"
          testID="recovery.backToSignIn"
        />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame saying={<AuthHeading title={t('recovery.title')} intro={t('recovery.intro')} />}>
      <View style={styles.form}>
        {status.kind === 'limited' && (
          <Notice
            tone="attention"
            mark="!"
            title={t('recovery.limitedTitle')}
            body={t('recovery.limitedBody', { time: status.time })}
          />
        )}

        {status.kind === 'failed' && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('recovery.failedTitle')}
            body={t('recovery.failedBody')}
          />
        )}

        <Field label={t('recovery.email')} error={checks.errors.email}>
          <TextField
            ref={emailInput}
            wrong={checks.errors.email != null}
            editable={status.kind !== 'sending'}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            value={typed}
            onChangeText={(text) => {
              setTyped(text);
              checks.edited('email', text);
            }}
            onBlur={() => checks.left('email', typed)}
            returnKeyType="send"
            onSubmitEditing={submit}
            accessibilityLabel={t('recovery.email')}
            testID="recovery.email"
          />
        </Field>

        <PrimaryButton
          label={status.kind === 'sending' ? t('recovery.sending') : t('recovery.send')}
          onPress={submit}
          busy={status.kind === 'sending'}
          testID="recovery.send"
        />

        <Footnote
          question={t('recovery.remembered')}
          action={t('recovery.signIn')}
          onPress={() => router.replace('/sign-in')}
          role="link"
          testID="recovery.signIn"
        />
      </View>
    </AuthFrame>
  );
}

function refusalFrom(error: unknown): Status {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) return { kind: 'limited', time: formatTimeOfDay(liftsAt, dateLocale()) };
  }

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
  secondary: { color: tokens.colorInkSecondary },
});
