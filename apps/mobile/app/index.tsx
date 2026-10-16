import { type Account, ApiUnreachableError, type Health, awaiting } from '@soirely/api-client';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { config } from '../src/config.ts';
import { landingFor } from '../src/landing.ts';

/**
 * The health endpoint, rendered.
 *
 * Its job is to prove three things at once that otherwise only get proved in
 * production: the shared client package resolves and runs on this platform, the
 * configured base URL is reachable, and CORS permits it from web.
 */
type State = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'failed' };

export default function Home() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);

  // The loading state belongs to the event that causes the reload, not to the
  // effect. Setting it in the effect body made every attempt two renders
  // instead of one, and on mount it set a state that was already the initial
  // one.
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((signedIn) => {
        if (!live) return;

        // Behind the onboarding gate, the gate's screen opens rather than the app.
        const landing = landingFor(awaiting(signedIn));
        if (landing !== '/') router.replace(landing);
        else setAccount(signedIn);
      })
      .catch((error: unknown) => {
        if (!live) return;

        // Still signed in, so the answer is not sign-in.
        if (error instanceof ApiUnreachableError) router.replace('/unreachable');
        else setAccount(null);
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    let live = true;

    api
      .health()
      .then((health) => {
        if (live) setState({ kind: 'ok', health });
      })
      .catch(() => {
        // The thrown message names a host and a port, which is internal detail.
        if (live) setState({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <Screen>
      <Text size={28} weight="bold">
        {t('home.title')}
      </Text>
      <Text muted>{t('home.subtitle')}</Text>

      {/* Said out loud rather than left to be discovered on a device, where the
          symptom is a request that times out with no explanation. */}
      {config.usingFallbackApiUrl && (
        <View style={styles.notice}>
          <Text size={14}>{t('status.usingFallback')}</Text>
        </View>
      )}

      <Text size={20} weight="medium">
        {t('status.title')}
      </Text>

      {state.kind === 'loading' && <Text muted>{t('status.checking')}</Text>}

      {state.kind === 'failed' && (
        <View style={styles.notice}>
          <Text>{t('status.unreachable')}</Text>
          {/* A Pressable wrapping a Text, never a Text with onPress — see
              src/components/Text.tsx. */}
          <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
            <Text weight="medium">{t('status.retry')}</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'ok' && (
        <View style={styles.panel}>
          <Text weight="medium">
            {state.health.status === 'ok' ? t('status.healthy') : t('status.degraded')}
          </Text>
          {Object.entries(state.health.checks).map(([name, check]) => (
            <View key={name} style={styles.row}>
              <Text muted>{name}</Text>
              <Text>{check.status}</Text>
            </View>
          ))}
        </View>
      )}

      {account == null ? (
        <Link href="/sign-in" asChild>
          <Pressable style={styles.button} accessibilityRole="button" testID="home.openSignIn">
            <Text weight="medium">{t('home.openSignIn')}</Text>
          </Pressable>
        </Link>
      ) : (
        <View style={styles.panel}>
          <Text weight="medium">{t('home.signedInAs', { name: account.name })}</Text>
          <Pressable
            style={styles.button}
            accessibilityRole="button"
            testID="home.signOut"
            onPress={() => {
              void api.signOut().then(() => {
                setAccount(null);
                router.replace('/sign-in');
              });
            }}
          >
            <Text weight="medium">{t('home.signOut')}</Text>
          </Pressable>
        </View>
      )}

      <Link href="/layouts" asChild>
        <Pressable style={styles.button} accessibilityRole="button">
          <Text weight="medium">{t('home.openLayouts')}</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 16, gap: 8 },
  notice: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
