import '../src/intl.ts';
import { loadAsync } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { WindowOrigin } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { initI18n } from '../src/i18n/index.ts';
import { loadInstallId } from '../src/installId.ts';
import { FONT_FACES, facesLoaded } from '../src/theme/fonts.ts';
import { tokens } from '../src/theme/tokens.ts';

void SplashScreen.preventAutoHideAsync();

/**
 * The root. Localisation, the bundled faces, and the install identifier every sign-in carries, are awaited before anything renders, behind the splash.
 *
 * Rendering first and translating afterwards shows a French reader a flash of
 * English, which is brief and reads as a broken product rather than as loading.
 * So this gate is deliberate, and the thing behind it is a spinner rather than
 * a half-translated screen. A face that fails to load leaves the platform font.
 */
export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;

    Promise.all([initI18n(), loadInstallId(), loadAsync(FONT_FACES).then(facesLoaded, () => {})])
      .then(() => {
        if (live) setState('ready');
      })
      .catch((error: unknown) => {
        // In English, deliberately: this is the one failure that happens before
        // there is a translator to render it with.
        if (live) {
          setMessage(error instanceof Error ? error.message : String(error));
          setState('failed');
        }
      });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (state !== 'loading') void SplashScreen.hideAsync();
  }, [state]);

  if (state === 'loading') {
    return (
      <View style={styles.page}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state === 'failed') {
    return (
      <View style={[styles.page, styles.failed]}>
        <Text weight="medium">Soirely could not start</Text>
        <Text muted>{message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="dark" />
      {/* No header: every screen is built on `Screen`, which owns its own
          insets. A native header plus a safe-area wrapper double-pads the top,
          and the result is a gap nobody can find the source of. */}
      <WindowOrigin>
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }} />
      </WindowOrigin>
    </SafeAreaProvider>
  );
}

// The splash, these views and every screen's card share the page colour, so no navigator grey shows between them (sc-13257).
const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorPage,
  },
  failed: { padding: 24 },
  root: { flex: 1, backgroundColor: tokens.colorPage },
  screen: { backgroundColor: tokens.colorPage },
});
