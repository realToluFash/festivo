import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '../../src/components/Buttons.tsx';
import { Toast } from '../../src/components/Toast.tsx';
import { useSystemBack } from '../../src/components/useSystemBack.ts';
import { DemoScreen } from '../../src/demo/DemoScreen.tsx';
import { Heading, Plain } from '../../src/steps/Lines.tsx';
import { SAMPLE } from '../../src/demo/samples.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Where each flow ends, signed in: Home is its own design, so this only stands in for it. */
export default function DemoHomeScreen() {
  const { toast } = useLocalSearchParams<{ toast?: string }>();
  const [shown, setShown] = useState(toast);
  const insets = useSafeAreaInsets();
  const toList = () => router.dismissTo('/demo');

  const navigation = useNavigation();

  // Signed in, the steps behind are gone: Back goes to the list, never into sign-in.
  useSystemBack(true, toList);
  // With Home's own swipe off, the edge swipe would close the whole demo instead.
  useFocusEffect(
    useCallback(() => {
      const demo = navigation.getParent();
      demo?.setOptions({ gestureEnabled: false });

      return () => demo?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );

  return (
    <View style={styles.fill}>
      <DemoScreen>
        <Heading
          title={SAMPLE.organisation}
          intro="Signed in. Home has its own design; this stands in for it."
        />
        <Plain top={tokens.space3xl}>The flow ends here.</Plain>
        <View style={styles.back}>
          <SecondaryButton label="Back to the demo list" onPress={toList} testID="demo.list" />
        </View>
      </DemoScreen>
      {shown != null && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, tokens.spaceLg) }]}>
          <Toast words={shown} onClose={() => setShown(undefined)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: { marginTop: tokens.space3xl },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
