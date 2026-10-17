import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { Field, TextField } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { PasswordField } from '../src/components/PasswordField.tsx';
import { ProviderSignIn } from '../src/components/ProviderSignIn.tsx';
import { currentLocale } from '../src/i18n/index.ts';
import { emailMessage, useFormChecks } from '../src/kit/formChecks.ts';
import { tokens } from '../src/theme/tokens.ts';
import { nextAfterSignIn } from '../src/challenge.ts';
import { useLayout } from '../src/layout/useLayout.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'providerFailed'; provider: string }
  | { kind: 'failed' }
  | { kind: 'sessionEnded' };

export default function SignIn() {
  const { t } = useTranslation();
  const { signedOut, providerFailed } = useLocalSearchParams<{
    signedOut?: string;
    providerFailed?: string;
  }>();
  const [status, setStatus] = useState<Status>(
    providerFailed != null
      ? { kind: 'providerFailed', provider: providerFailed }
      : signedOut == null
        ? { kind: 'ready' }
        : { kind: 'sessionEnded' },
  );

  async function signIn(email: string, password: string): Promise<void> {
    setStatus({ kind: 'signingIn' });

    try {
      router.replace(nextAfterSignIn(await api.signIn(email, password)));
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  const liftLock = useCallback(() => setStatus({ kind: 'ready' }), []);

  return (
    <AuthFrame
      saying={
        <AuthHeading title={t('signIn.title')} intro={t('signIn.landscapeIntro')} introBeside />
      }
    >
      <Credentials
        status={status}
        onSubmit={signIn}
        onLockLifted={liftLock}
        onProviderFailed={(provider) => setStatus({ kind: 'providerFailed', provider })}
      />
    </AuthFrame>
  );
}

function Credentials({
  status,
  onSubmit,
  onLockLifted,
  onProviderFailed,
}: {
  status: Status;
  onSubmit: (email: string, password: string) => void;
  onLockLifted: () => void;
  onProviderFailed: (provider: string) => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const email = useRef<TextInput>(null);
  const password = useRef<TextInput>(null);

  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef({ email: '', password: '' });
  const checks = useFormChecks(
    ['email', 'password'] as const,
    (field, value) =>
      field === 'email' ? emailMessage(value, t) : value === '' ? t('signIn.passwordBlank') : null,
    (field) => (field === 'email' ? email : password).current?.focus(),
  );

  const submit = (): void => {
    if (!checks.passes(typed.current)) return;

    onSubmit(typed.current.email.trim(), typed.current.password);
  };

  const busy = status.kind === 'signingIn';
  const locked = status.kind === 'rateLimited';
  const liftsAt = status.kind === 'rateLimited' ? status.liftsAt : null;

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(
      () => {
        password.current?.clear();
        typed.current.password = '';
        onLockLifted();
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => clearTimeout(lift);
  }, [liftsAt, onLockLifted]);

  return (
    <View style={styles.form}>
      {status.kind === 'sessionEnded' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('signIn.endedTitle')}
          body={t('signIn.endedBody')}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('signIn.failedTitle')}
          body={t('signIn.failedBody')}
        />
      )}

      {status.kind === 'rateLimited' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('signIn.lockedTitle')}
          body={t('signIn.lockedBody', { time: status.retryAt })}
          action={{
            label: t('signIn.lockedReset'),
            onPress: () => router.push('/forgot-password'),
            testID: 'signIn.locked.reset',
          }}
        />
      )}

      {status.kind === 'providerFailed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('signIn.providerFailedTitle', { provider: status.provider })}
          body={t('signIn.providerFailedBody', { provider: status.provider })}
        />
      )}

      <Field label={t('signIn.email')} error={checks.errors.email}>
        <TextField
          ref={email}
          wrong={checks.errors.email != null}
          editable={!busy}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          onChangeText={(text) => {
            typed.current.email = text;
            checks.edited('email', text);
          }}
          onBlur={() => checks.left('email', typed.current.email)}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => password.current?.focus()}
          accessibilityLabel={t('signIn.email')}
          testID="signIn.email"
        />
      </Field>

      <Field
        label={t('signIn.password')}
        labelAction={{
          label: kind === 'phone' ? t('recovery.forgotShort') : t('recovery.forgot'),
          onPress: () => router.push('/forgot-password'),
          testID: 'signIn.forgot',
        }}
        error={checks.errors.password ?? (status.kind === 'refused' ? t('signIn.refused') : null)}
        errorActions={
          checks.errors.password == null && status.kind === 'refused'
            ? [
                {
                  label: t('signIn.lockedReset'),
                  onPress: () => router.push('/forgot-password'),
                  testID: 'signIn.refused.reset',
                },
              ]
            : undefined
        }
      >
        <PasswordField
          ref={password}
          wrong={status.kind === 'refused' || checks.errors.password != null}
          submitting={busy}
          editable={!busy}
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            typed.current.password = text;
            checks.edited('password', text);
          }}
          onBlur={() => checks.left('password', typed.current.password)}
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel={t('signIn.password')}
          testID="signIn.password"
        />
      </Field>

      <PrimaryButton
        label={
          locked
            ? t('signIn.lockedUntil', { time: status.retryAt })
            : busy
              ? t('signIn.submitting')
              : t('signIn.submit')
        }
        onPress={submit}
        busy={busy}
        off={locked}
        testID="signIn.submit"
      />

      <ProviderSignIn onFailed={onProviderFailed} />

      <Footnote
        question={t('signIn.newHere')}
        action={t('signIn.createAccount')}
        onPress={() => router.push('/register')}
        role="link"
        testID="signIn.register"
      />
    </View>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(liftsAt, currentLocale()),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
});
