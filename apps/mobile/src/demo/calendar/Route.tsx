import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { switcherStateOf } from '../OrgSwitcherModel.ts';
import { useCoverStatusBar } from '../Welcome.tsx';
import { PHONE_TAB_BAR, type Shell, ShellContext } from '../settings/Frame.tsx';
import { layoutOf, settingsHref } from '../settings/Route.tsx';
import { type DemoSection, lookingAs } from '../settings/sample.ts';
import { PageToast } from '../settings/Summary.tsx';
import { calendarStateOf } from './CalendarModel.ts';
import { CalendarPage } from './CalendarPage.tsx';

/** The Calendar on sample data, in the tabs' shell: Today, Events and Settings a tab away. */
function CalendarShell({
  switcher,
  children,
}: {
  switcher?: string | undefined;
  children: ReactNode;
}) {
  const layout = layoutOf(useLayout().kind);
  const insets = useSafeAreaInsets();
  const [told, setTold] = useState<string>();
  const tell = useCallback<Tell>((words) => setTold(words), []);

  useCoverStatusBar('dark', false);

  const openSection = useCallback(
    (section: DemoSection) => router.push(settingsHref('owner', section)),
    [],
  );
  const toSettings = useCallback(() => router.push(settingsHref('owner', null)), []);
  const onTab = useCallback(
    (tab: Tab) => {
      if (tab === 'Today') router.replace('/demo/today');
      else if (tab === 'Events') router.replace('/demo/events');
      else if (tab === 'Settings') toSettings();
    },
    [toSettings],
  );
  const shell = useMemo<Shell>(
    () => ({
      layout,
      viewer: 'owner',
      looking: lookingAs('owner'),
      open: null,
      openSection,
      toSettings,
      tell,
      onTab,
      listColumn: null,
    }),
    [layout, openSection, toSettings, tell, onTab],
  );
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <ShellContext.Provider value={shell}>
      <OrgSwitcherProvider state={switcherStateOf(switcher)} tell={tell}>
        <View style={styles.fill}>
          {children}
          {told != null && (
            <PageToast
              words={told}
              onClose={() => setTold(undefined)}
              bottom={
                layout === 'phone'
                  ? foot + PHONE_TAB_BAR + tokens.spaceMd
                  : Math.max(insets.bottom, tokens.spaceLg)
              }
            />
          )}
        </View>
      </OrgSwitcherProvider>
    </ShellContext.Provider>
  );
}

/** /demo/calendar: weeks as lanes, with ?state= for each of its states. */
export function CalendarRoute() {
  const params = useLocalSearchParams<{ state?: string; switcher?: string }>();
  const state = calendarStateOf(params.state);

  return (
    <CalendarShell key={`${state ?? ''}:${params.switcher ?? ''}`} switcher={params.switcher}>
      <CalendarPage state={state} />
    </CalendarShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.colorCard },
});
