import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Text } from '../src/components/Text.tsx';
import { initI18n } from '../src/i18n/index.ts';

/**
 * The root. Localisation is awaited before anything renders.
 *
 * Rendering first and translating afterwards shows a French reader a flash of
 * English, which is brief and reads as a broken product rather than as loading.
 * So this gate is deliberate, and the thing behind it is a spinner rather than
 * a half-translated screen.
 */
export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;

    initI18n()
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

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state === 'failed') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text weight="medium">Soirely could not start</Text>
        <Text muted>{message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* No header: every screen is built on `Screen`, which owns its own
          insets. A native header plus a safe-area wrapper double-pads the top,
          and the result is a gap nobody can find the source of. */}
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
