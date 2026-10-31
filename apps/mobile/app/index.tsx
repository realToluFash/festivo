import { ApiUnreachableError, type Health, awaiting } from '@soirely/api-client';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../src/api.ts';
import { Home as SignedInHome } from '../src/components/Home.tsx';
import { PrimaryButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { cardFrame } from '../src/components/cardFrame.ts';
import { Notice } from '../src/components/Notice.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { GlyphMark, type Mark } from '../src/components/StatusMark.tsx';
import { Text } from '../src/components/Text.tsx';
import { Title } from '../src/components/Title.tsx';
import { config } from '../src/config.ts';
import { followAccount } from '../src/accountLanguage.ts';
import { landingFor } from '../src/landing.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { dropRegistration, heldRegistration } from '../src/pendingRegistration.ts';
import { launchRoute } from '../src/resumeSignUp.ts';
import { ruleRefusal, signInRoute } from '../src/kit/signInRules.ts';
import { launchSignedIn } from '../src/signedIn.ts';
import { tokens } from '../src/theme/tokens.ts';
import { unreachableFrom } from '../src/unreachable.ts';

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
        <ActivityIndicator color={tokens.colorAccent} />
      </View>
    );
  }

  return <SignedOut state={state} onRetry={retry} />;
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

function SignedOut({ state, onRetry }: { state: State; onRetry: () => void }) {
  const { t } = useTranslation();
  const { kind, width } = useLayout();
  const phone = kind === 'phone';
  const titleSize = phone ? (width < 390 ? 28 : 30) : 34;

  return (
    <Screen contentStyle={phone ? styles.phone : styles.tablet}>
      <View style={phone ? styles.stack : styles.column}>
        <View style={styles.heading}>
          <Title size={titleSize} accessibilityRole="header">
            {t('home.title')}
          </Title>
          <Text size={tokens.typeBodyPhone.size} muted>
            {t('home.subtitle')}
          </Text>
        </View>

        {/* Said out loud rather than left to be discovered on a device, where the
            symptom is a request that times out with no explanation. */}
        {config.usingFallbackApiUrl && (
          <Notice tone="attention" mark={ATTENTION.glyph} body={t('status.usingFallback')} />
        )}

        <View style={cardFrame(kind)}>
          <Text size={tokens.typeTitleSection.size} weight="bold">
            {t('status.title')}
          </Text>
          <HealthCheck state={state} onRetry={onRetry} />
        </View>

        {phone && <View style={styles.foot} />}

        <PrimaryButton
          label={t('home.openSignIn')}
          onPress={() => router.push('/sign-in')}
          testID="home.openSignIn"
        />
      </View>
    </Screen>
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
            <View style={styles.line}>
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

const TABLET_COLUMN_WIDTH = 520;

const styles = StyleSheet.create({
  deciding: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorPage,
  },
  phone: { flexGrow: 1 },
  tablet: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  stack: { flexGrow: 1, gap: tokens.spaceXl },
  column: { width: '100%', maxWidth: TABLET_COLUMN_WIDTH, gap: tokens.spaceXl },
  heading: { gap: tokens.spaceXs },
  foot: { flexGrow: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  checks: { gap: tokens.spaceXs },
  check: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  checkName: { color: tokens.colorInkSecondary },
  brokenInk: { color: tokens.colorBrokenText },
  okInk: { color: tokens.colorAccentText },
});
