import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { Notice } from '../src/components/Notice.tsx';
import { ProviderSignIn } from '../src/components/ProviderSignIn.tsx';
import { SignInFrame } from '../src/components/SignInFrame.tsx';
import { Text } from '../src/components/Text.tsx';
import { currentLocale } from '../src/i18n/index.ts';
import { tokens } from '../src/theme/tokens.ts';

/** 16 is the smallest size iOS Safari will not zoom into on focus. */
const CONTROL_TEXT_SIZE = 16;

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

      router.replace(account.verified ? '/' : '/verify-email');
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  const liftLock = useCallback(() => setStatus({ kind: 'ready' }), []);

  return (
    <SignInFrame title={t('signIn.title')} intro={t('signIn.landscapeIntro')}>
      <Credentials status={status} onSubmit={signIn} onLockLifted={liftLock} />
    </SignInFrame>
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
  const [revealed, setRevealed] = useState(false);
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

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('signIn.email')}
        </Text>
        <TextInput
          style={styles.input}
          editable={!busy}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          onChangeText={(text) => {
            typed.current.email = text;
          }}
          returnKeyType="next"
          onSubmitEditing={() => password.current?.focus()}
          placeholderTextColor={tokens.colorInkTertiary}
          cursorColor={tokens.colorInk}
          selectionColor={tokens.colorInk}
          accessibilityLabel={t('signIn.email')}
          testID="signIn.email"
        />
      </View>

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('signIn.password')}
        </Text>
        <View style={styles.revealWrap}>
          <TextInput
            ref={password}
            style={[
              styles.input,
              styles.inputWithReveal,
              status.kind === 'refused' && styles.inputWrong,
            ]}
            editable={!busy}
            secureTextEntry={!revealed}
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            onChangeText={(text) => {
              typed.current.password = text;
            }}
            returnKeyType="go"
            onSubmitEditing={submit}
            placeholderTextColor={tokens.colorInkTertiary}
            cursorColor={tokens.colorInk}
            selectionColor={tokens.colorInk}
            accessibilityLabel={t('signIn.password')}
            testID="signIn.password"
          />
          <Pressable
            style={styles.reveal}
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            testID="signIn.reveal"
            accessibilityState={{ selected: revealed }}
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accentText}>
              {revealed ? t('signIn.conceal') : t('signIn.reveal')}
            </Text>
          </Pressable>
        </View>

        {status.kind === 'refused' && (
          <View style={styles.fieldError}>
            <View style={styles.mark}>
              <Text size={tokens.typePill.size} weight="bold" style={styles.brokenText}>
                ✕
              </Text>
            </View>
            <Text size={tokens.typeBodyPhone.size} style={styles.brokenText}>
              {t('signIn.refused')}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.cta, (busy || locked) && styles.ctaOff]}
        onPress={submit}
        disabled={busy || locked}
        accessibilityRole="button"
        testID="signIn.submit"
        accessibilityState={{ disabled: busy || locked }}
      >
        <Text
          size={CONTROL_TEXT_SIZE}
          weight="semibold"
          style={busy || locked ? styles.ctaOffText : styles.ctaText}
        >
          {locked
            ? t('signIn.lockedUntil', { time: status.retryAt })
            : busy
              ? t('signIn.submitting')
              : t('signIn.submit')}
        </Text>
      </Pressable>

      <ProviderSignIn />

      <View style={styles.footnote}>
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
          {t('signIn.newHere')}
        </Text>
        <Pressable
          style={styles.footnoteAction}
          onPress={() => router.push('/register')}
          accessibilityRole="link"
          testID="signIn.register"
        >
          <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accentText}>
            {t('signIn.createAccount')}
          </Text>
        </Pressable>
      </View>
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
  field: { gap: tokens.spaceXs },

  input: {
    height: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
  inputWithReveal: { paddingRight: 72 },
  inputWrong: { borderColor: tokens.colorBroken },

  revealWrap: { position: 'relative' },
  reveal: {
    position: 'absolute',
    top: 0,
    right: tokens.spaceHair,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  accentText: { color: tokens.colorAccentText },

  cta: {
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  ctaOff: { backgroundColor: tokens.colorBorder },
  ctaText: { color: tokens.colorInkOnDark },
  ctaOffText: { color: tokens.colorInkSecondary },

  brokenText: { color: tokens.colorBrokenText },

  mark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.marks.broken.ring,
    backgroundColor: tokens.marks.broken.fill,
  },
  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },

  secondary: { color: tokens.colorInkSecondary },
  footnote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  footnoteAction: { minHeight: tokens.sizeHit, justifyContent: 'center' },
});
