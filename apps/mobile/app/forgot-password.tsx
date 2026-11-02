import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { type AuthBack, AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { Field, focusChecked, keysStayDown, TextField } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { Text } from '../src/components/Text.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { emailMessage, useFormChecks } from '../src/kit/formChecks.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/** The step that pushed this one, when it is not Sign in; `link`, a dead reset link, replaced itself with it. */
export type ForgotFrom = 'code' | 'recovery' | 'security' | 'link';

type Status =
  | { kind: 'asking' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'limited'; time: string; again: boolean }
  | { kind: 'failed'; again: boolean };

/** "Reset your password": an address in, and the same answer whether or not it has an account. */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const { from } = useLocalSearchParams<{ from?: ForgotFrom }>();
  const { kind } = useLayout();
  const [status, setStatus] = useState<Status>({ kind: 'asking' });
  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef('');
  // What the field remounts with after Check your email, as it was typed.
  const [kept, setKept] = useState('');
  const emailInput = useRef<TextInputInstance>(null);
  const checks = useFormChecks(
    ['email'] as const,
    (_field, value) => emailMessage(value, t),
    () => focusChecked(emailInput),
  );

  async function send(email: string, again: boolean): Promise<void> {
    setStatus({ kind: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email });
    } catch (error) {
      setStatus(refusalFrom(error, again));
    }
  }

  function submit(): void {
    if (status.kind === 'sending') return;

    const email = typed.current.trim();
    if (!checks.passes({ email })) return;

    setKept(typed.current);
    keysStayDown();
    void send(email, false);
  }

  const back = backTo(from, kind === 'phone', t);

  if (status.kind === 'sent') {
    return (
      <AuthFrame
        back={back}
        saying={
          <AuthHeading
            title={t('recovery.sentTitle')}
            intro={t('recovery.sentBody')}
            answer={status}
          />
        }
      >
        <Notice
          tone="quiet"
          mark="i"
          title={t('recovery.nothingTitle')}
          body={t('recovery.nothingBody')}
        />
        <SecondaryButton
          label={t('recovery.sendAgain')}
          onPress={() => void send(status.email, true)}
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
    <AuthFrame
      back={back}
      saying={<AuthHeading title={t('recovery.title')} intro={t('recovery.intro')} />}
    >
      <View style={styles.form}>
        {status.kind === 'limited' && (
          <Notice
            tone="attention"
            mark="!"
            title={t('recovery.limitedTitle')}
            body={t('recovery.limitedBody', { time: status.time })}
            answer={status}
            takesFocus={status.again}
          />
        )}

        {status.kind === 'failed' && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('recovery.failedTitle')}
            body={t('recovery.failedBody')}
            answer={status}
            takesFocus={status.again}
          />
        )}

        <Field label={t('recovery.email')} error={checks.errors.email}>
          <TextField
            ref={emailInput}
            wrong={checks.errors.email != null}
            submitting={status.kind === 'sending'}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            defaultValue={kept}
            onChangeText={(text) => {
              typed.current = text;
              checks.edited('email', text);
            }}
            onBlur={() => checks.left('email', typed.current)}
            returnKeyType="send"
            submitBehavior="submit"
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

function backTo(from: ForgotFrom | undefined, phone: boolean, t: TFunction): AuthBack | null {
  if (from === 'link') return null;

  if (from == null) {
    return {
      label: t('signIn.title'),
      heard: t('twoFactor.back'),
      onPress: () => (router.canGoBack() ? router.back() : router.replace('/sign-in')),
      testID: 'recovery.back',
    };
  }

  const title =
    from === 'code'
      ? t('twoFactor.title')
      : from === 'recovery'
        ? t('twoFactor.recoveryTitle')
        : phone
          ? t('security.title')
          : t('settings.title');

  return { label: title, onPress: () => router.back(), testID: 'recovery.back' };
}

function refusalFrom(error: unknown, again: boolean): Status {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null)
      return { kind: 'limited', time: formatTimeOfDay(liftsAt, dateLocale()), again };
  }

  return { kind: 'failed', again };
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
  secondary: { color: tokens.colorInkSecondary },
});
