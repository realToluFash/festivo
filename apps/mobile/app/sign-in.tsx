import { ApiError, awaiting } from '@soirely/api-client';
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
import { tokens } from '../src/theme/tokens.ts';
import { landingFor } from '../src/landing.ts';

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
  const { signedOut } = useLocalSearchParams<{ signedOut?: string }>();
  const [status, setStatus] = useState<Status>(
    signedOut == null ? { kind: 'ready' } : { kind: 'sessionEnded' },
  );

  async function signIn(email: string, password: string): Promise<void> {
    setStatus({ kind: 'signingIn' });

    try {
      const { account } = await api.signIn(email, password);

      router.replace(landingFor(awaiting(account)));
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
      <Credentials status={status} onSubmit={signIn} onLockLifted={liftLock} />
    </AuthFrame>
  );
}

function Credentials({
  status,
  onSubmit,
  onLockLifted,
}: {
  status: Status;
  onSubmit: (email: string, password: string) => void;
  onLockLifted: () => void;
}) {
  const { t } = useTranslation();
  const password = useRef<TextInput>(null);

  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef({ email: '', password: '' });

  const submit = (): void => {
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

      <Field label={t('signIn.email')}>
        <TextField
          editable={!busy}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          onChangeText={(text) => {
            typed.current.email = text;
          }}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => password.current?.focus()}
          accessibilityLabel={t('signIn.email')}
          testID="signIn.email"
        />
      </Field>

      <Field
        label={t('signIn.password')}
        error={status.kind === 'refused' ? t('signIn.refused') : null}
      >
        <PasswordField
          ref={password}
          wrong={status.kind === 'refused'}
          submitting={busy}
          editable={!busy}
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            typed.current.password = text;
          }}
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

      <ProviderSignIn />

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
