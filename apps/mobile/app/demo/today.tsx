import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '../../src/components/Toast.tsx';
import { useSystemBack } from '../../src/components/useSystemBack.ts';
import { useLayout } from '../../src/layout/useLayout.ts';
import { MOMENTS, type MomentName, momentOf, sayIn } from '../../src/demo/today.ts';
import type { Tab } from '../../src/demo/TodayCover.tsx';
import type { Tell } from '../../src/demo/TodayParts.tsx';
import { TAB_BAR, TodayScreen } from '../../src/demo/TodayScreen.tsx';
import { demoShell, TodayShellProvider } from '../../src/demo/todayShell.ts';
import { useCoverStatusBar } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

function isMoment(name: string | undefined): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

export default function DemoTodayScreen() {
  const params = useLocalSearchParams<{ moment?: string; toast?: string }>();
  const name = isMoment(params.moment) ? params.moment : 'plan';
  // The demo's words are English, so its dates are too, in the phone's own region.
  const moment = useMemo(
    () => momentOf(name, sayIn(formattingLocale('en', getLocales()[0]?.languageTag))),
    [name],
  );
  const { kind } = useLayout();
  const [told, setTold] = useState(params.toast);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const shell = useMemo(() => demoShell(tell), [tell]);
  const toList = useCallback(() => router.dismissTo('/demo'), []);
  const navigation = useNavigation();

  // Signed in, the steps behind are gone: Back goes to the list, never into sign-in.
  useSystemBack(true, toList);
  // With Today's own swipe off, the edge swipe would close the whole demo instead.
  useFocusEffect(
    useCallback(() => {
      const demo = navigation.getParent();
      demo?.setOptions({ gestureEnabled: false });

      return () => demo?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );
  useCoverStatusBar(kind === 'tabletLandscape' ? 'dark' : 'light', false);

  const onTab = useCallback(
    (tab: Tab) => {
      if (tab === 'Settings') router.replace('/demo/settings');
      else if (tab !== 'Today') tell(`${tab} has its own design.`);
    },
    [tell],
  );

  return (
    <TodayShellProvider value={shell}>
      <View style={styles.fill}>
        <TodayScreen moment={moment} onTab={onTab} />
        {told != null && (
          <Told words={told} phone={kind === 'phone'} onClose={() => setTold(undefined)} />
        )}
      </View>
    </TodayShellProvider>
  );
}

function Told({ words, phone, onClose }: { words: string; phone: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, tokens.spaceLg) + (phone ? TAB_BAR + tokens.spaceLg : 0);

  return (
    <View style={[styles.toast, { bottom }]}>
      <Toast key={words} words={words} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
