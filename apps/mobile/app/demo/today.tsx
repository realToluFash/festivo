import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '../../src/components/Toast.tsx';
import { useSystemBack } from '../../src/components/useSystemBack.ts';
import { useLayout } from '../../src/layout/useLayout.ts';
import { OrgSwitcherProvider, SwitchedNotice } from '../../src/demo/OrgSwitcher.tsx';
import { switcherStateOf } from '../../src/demo/OrgSwitcherModel.ts';
import { MOMENTS, momentOf, sayIn } from '../../src/demo/today.ts';
import type { MomentName } from '../../src/kit/today.ts';
import type { Tab } from '../../src/components/TodayCover.tsx';
import type { Tell } from '../../src/components/TodayParts.tsx';
import { TAB_BAR, TodayScreen } from '../../src/components/TodayScreen.tsx';
import { TodayShellProvider } from '../../src/components/todayShell.ts';
import { demoShell } from '../../src/demo/demoShell.ts';
import { openEvent } from '../../src/demo/events/EventsList.tsx';
import { EVENT_OF_KEY } from '../../src/demo/events/EventsSample.ts';
import { useCoverStatusBar } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

function toEvents() {
  router.replace('/demo/events');
}

function toCalendar() {
  router.replace('/demo/calendar');
}

function isMoment(name: string | undefined): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

export default function DemoTodayScreen() {
  const params = useLocalSearchParams<{ moment?: string; toast?: string; switcher?: string }>();
  const name = isMoment(params.moment) ? params.moment : 'plan';
  const { i18n } = useTranslation();
  // The demo's words are English, so its dates are too, in the phone's own region.
  const moment = useMemo(
    () =>
      momentOf(
        name,
        sayIn(formattingLocale('en', getLocales()[0]?.languageTag)),
        i18n.getFixedT('en'),
      ),
    [name, i18n],
  );
  const { kind } = useLayout();
  const [told, setTold] = useState(params.toast);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const shell = useMemo(
    () =>
      demoShell(tell, {
        events: toEvents,
        calendar: toCalendar,
        event: (key) => openEvent(EVENT_OF_KEY[key]),
      }),
    [tell],
  );
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

  const onTab = useCallback((tab: Tab) => {
    if (tab === 'Settings') router.replace('/demo/settings');
    else if (tab === 'Events') toEvents();
    else if (tab === 'Calendar') toCalendar();
  }, []);

  return (
    <OrgSwitcherProvider state={switcherStateOf(params.switcher)} tell={tell}>
      <TodayShellProvider value={shell}>
        <View style={styles.fill}>
          <TodayScreen
            moment={moment}
            onTab={onTab}
            notices={
              <SwitchedNotice style={kind === 'tabletLandscape' ? undefined : styles.switched} />
            }
          />
          {told != null && (
            <Told words={told} phone={kind === 'phone'} onClose={() => setTold(undefined)} />
          )}
        </View>
      </TodayShellProvider>
    </OrgSwitcherProvider>
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
  switched: { marginBottom: tokens.spaceXl },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
