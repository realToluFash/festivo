import { ApiUnreachableError, type Health, awaiting } from '@soirely/api-client';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../src/api.ts';
import { Home as SignedInHome } from '../src/components/Home.tsx';
import { SecondaryButton } from '../src/components/Buttons.tsx';
import { cardFrame } from '../src/components/cardFrame.ts';
import { Notice } from '../src/components/Notice.tsx';
import { Pending } from '../src/components/Pending.tsx';
import { GlyphMark, type Mark } from '../src/components/StatusMark.tsx';
import { Text } from '../src/components/Text.tsx';
import { config } from '../src/config.ts';
import { Welcome } from '../src/components/Welcome.tsx';
import { DemoButton, demoHere } from '../src/demo/DemoEntry.tsx';
import { followAccount } from '../src/accountLanguage.ts';
import { landingFor } from '../src/landing.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { dropRegistration, heldRegistration } from '../src/pendingRegistration.ts';
import { launchRoute } from '../src/resumeSignUp.ts';
import { ruleRefusal, signInRoute } from '../src/kit/signInRules.ts';
import { SKELETON_AFTER_MS } from '../src/kit/skeleton.ts';
import { launchSignedIn, resumesSession } from '../src/signedIn.ts';
import { tokens } from '../src/theme/tokens.ts';
import { unreachableFrom } from '../src/unreachable.ts';

/**
 * Launch: the signed-in home once somebody is in (sc-722), else welcome (sc-29076).
 */
type State = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'failed' };

/** Who is launching: nothing is drawn until that is known, so a signed-in person never sees the placeholder. */
type Launching = 'deciding' | 'signedIn' | 'signedOut';

export default function Home() {
  const { tapped } = useLocalSearchParams<{ tapped?: string }>();
  const [resumed] = useState(() => resumesSession(tapped));
  const [launching, setLaunching] = useState<Launching>(resumed ? 'signedIn' : 'deciding');
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

  useEffect(() => {
    if (resumed) return;
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

      // Unreachable is not a sign-out (sc-55), so the answer is not sign-in.
      if (answer.error instanceof ApiUnreachableError) {
        if (live) router.replace(unreachableFrom());
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
  }, [navigation, resumed]);

  if (launching === 'signedIn') return <SignedInHome />;

  // The page colour alone for a second, then the spinner over its loading words (sc-26325).
  if (launching === 'deciding')
    return (
      <View style={styles.deciding} accessibilityState={{ busy: true }} testID="launch.deciding">
        <Pending after={SKELETON_AFTER_MS} stacked />
      </View>
    );

  return <SignedOut />;
}

const ATTENTION: Mark = {
  glyph: '!',
  fill: tokens.colorAttentionWash,
  ring: tokens.colorAttention,
  ink: tokens.colorAttentionText,
};

const BROKEN: Mark = {
  glyph: '!',
  fill: tokens.colorBrokenTint,
  ring: tokens.colorBroken,
  ink: tokens.colorBrokenText,
};

/** Signed out: welcome, with the service check and the design demo in development and QA builds only. */
function SignedOut() {
  return <Welcome devTools={<DevTools />} />;
}

/** For developers: whether the API answers, and the design demo beside it (sc-29076). */
export function DevTools() {
  const { kind } = useLayout();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const { t } = useTranslation();

  useEffect(() => {
    if (!demoHere()) return;
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

  if (!demoHere()) return null;

  return (
    <View style={styles.devTools}>
      {/* Said out loud rather than left to be discovered on a device, where the
          symptom is a request that times out with no explanation. */}
      {config.usingFallbackApiUrl && (
        <Notice tone="attention" mark={ATTENTION.glyph} body={t('status.usingFallback')} />
      )}
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeTitleSection.size} weight="bold">
          {t('status.title')}
        </Text>
        <HealthCheck state={state} onRetry={retry} />
      </View>
      <DemoButton />
    </View>
  );
}

function HealthCheck({ state, onRetry }: { state: State; onRetry: () => void }) {
  const { t } = useTranslation();

  if (state.kind === 'loading') {
    return (
      <View style={styles.line}>
        <ActivityIndicator color={tokens.colorAccent} />
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('status.checking')}
        </Text>
      </View>
    );
  }

  if (state.kind === 'failed') {
    return (
      <Notice
        tone="broken"
        mark={BROKEN.glyph}
        body={t('status.unreachable')}
        announce
        interrupts
        button={<SecondaryButton label={t('status.retry')} onPress={onRetry} testID="home.retry" />}
      />
    );
  }

  const healthy = state.health.status === 'ok';

  return (
    <View style={styles.checks}>
      <View style={styles.line}>
        <GlyphMark mark={healthy ? tokens.marks.done : ATTENTION} />
        <Text size={tokens.typeBodyPhone.size} weight="semibold">
          {healthy ? t('status.healthy') : t('status.degraded')}
        </Text>
      </View>
      {/* Names and statuses are the API's own words, untranslated; a check's error text is never shown. */}
      {Object.entries(state.health.checks).map(([name, check]) => {
        const ok = check.status === 'ok';

        return (
          <View key={name} style={styles.check}>
            <Text size={tokens.typeSmall.size} family="mono" style={styles.checkName}>
              {name}
            </Text>
            <View style={[styles.line, styles.checkStatus]}>
              <GlyphMark mark={ok ? tokens.marks.done : BROKEN} />
              <Text
                size={tokens.typeSmall.size}
                weight="semibold"
                style={ok ? styles.okInk : styles.brokenInk}
              >
                {check.status}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  deciding: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorPage,
  },
  devTools: { marginTop: tokens.spaceXl, gap: tokens.spaceLg },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  checks: { gap: tokens.spaceXs },
  check: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  checkName: { flexShrink: 1, color: tokens.colorInkSecondary },
  checkStatus: { flexShrink: 0 },
  brokenInk: { color: tokens.colorBrokenText },
  okInk: { color: tokens.colorAccentText },
});
