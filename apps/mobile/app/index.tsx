import { ApiUnreachableError, awaiting } from '@soirely/api-client';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, meAtLaunch } from '../src/api.ts';
import { Home as SignedInHome } from '../src/components/Home.tsx';
import { Pending } from '../src/components/Pending.tsx';
import { DevTools } from '../src/components/DevTools.tsx';
import { Welcome } from '../src/components/Welcome.tsx';
import { followAccount } from '../src/accountLanguage.ts';
import { landingAfterRestart } from '../src/colourScheme.ts';
import { landingFor } from '../src/landing.ts';
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
            if (!live || !loaded) return;
            // A restart into new colours comes back where it was asked from (sc-30441).
            setLaunching('signedIn');
            for (const screen of landingAfterRestart()) router.push(screen);
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

/** Signed out: welcome, with the service check and the design demo in development and QA builds only. */
function SignedOut() {
  return <Welcome devTools={<DevTools />} />;
}

const styles = StyleSheet.create({
  deciding: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorPage,
  },
});
