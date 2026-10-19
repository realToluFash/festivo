import { ApiUnreachableError, type Health, awaiting } from '@soirely/api-client';
import { Link, router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../src/api.ts';
import { Home as SignedInHome } from '../src/components/Home.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { config } from '../src/config.ts';
import { followAccount } from '../src/accountLanguage.ts';
import { landingFor } from '../src/landing.ts';
import { dropRegistration, heldRegistration } from '../src/pendingRegistration.ts';
import { launchRoute } from '../src/resumeSignUp.ts';
import { ruleRefusal, signInRoute } from '../src/kit/signInRules.ts';
import { launchSignedIn } from '../src/signedIn.ts';

/**
 * Launch: the signed-in home once somebody is in (sc-722), else the health endpoint, rendered.
 *
 * Its job is to prove three things at once that otherwise only get proved in
 * production: the shared client package resolves and runs on this platform, the
 * configured base URL is reachable, and CORS permits it from web.
 */
type State = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'failed' };

/** Who is launching: nothing is drawn until that is known, so a signed-in person never sees the placeholder. */
type Launching = 'deciding' | 'signedIn' | 'signedOut';

export default function Home() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [launching, setLaunching] = useState<Launching>('deciding');
  const navigation = useNavigation();
  const left = useRef(false);

  // Once left, launch stays left: coming Back to it does not re-decide (sc-2096).
  useEffect(
    () =>
      navigation.addListener('blur', () => {
        left.current = true;
      }),
    [navigation],
  );

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

    void meAtLaunch().then((answer) => {
      if ('account' in answer) {
        if (!live) return;
        const signedIn = answer.account;

        void followAccount(signedIn);

        // Behind the onboarding gate, the gate's screen opens rather than the app.
        const landing = landingFor(awaiting(signedIn));
        if (landing !== '/') router.replace(landing);
        else
          void launchSignedIn().then((loaded) => {
            if (live && loaded) setLaunching('signedIn');
          });
        return;
      }

      // Still signed in, so the answer is not sign-in.
      if (answer.error instanceof ApiUnreachableError) {
        if (live) router.replace('/unreachable');
        return;
      }

      if (live) setLaunching('signedOut');
      else if (!answer.ended) return;

      // Mounted is not enough: a screen pushed over launch leaves it mounted underneath.
      const onLaunch = () => live && !left.current && navigation.isFocused();

      void launchRoute(
        answer.ended,
        {
          held: heldRegistration,
          open: (registration) => api.registrationOpening(registration),
          drop: dropRegistration,
        },
        onLaunch,
      ).then((route) => {
        if (route == null) return;
        // An organisation's rule that ended the session is named on sign-in (sc-69).
        router.replace(
          route === '/sign-in?signedOut=1' ? signInRoute(ruleRefusal(answer.why), true) : route,
        );
      });
    });

    return () => {
      live = false;
    };
  }, [attempt, navigation]);

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

  if (launching === 'signedIn') return <SignedInHome />;

  if (launching === 'deciding') {
    return (
      <View style={styles.deciding}>
        <ActivityIndicator />
      </View>
    );
  }

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

      <Link href="/sign-in" asChild>
        <Pressable style={styles.button} accessibilityRole="button" testID="home.openSignIn">
          <Text weight="medium">{t('home.openSignIn')}</Text>
        </Pressable>
      </Link>

      <Link href="/layouts" asChild>
        <Pressable style={styles.button} accessibilityRole="button">
          <Text weight="medium">{t('home.openLayouts')}</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  deciding: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
