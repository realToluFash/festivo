import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SettingsSection } from '../../kit/appNav.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import type { Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { useCoverStatusBar } from '../Welcome.tsx';
import { type Shell, ShellContext } from '../settings/Frame.tsx';
import { layoutOf, settingsHref } from '../settings/Route.tsx';
import { lookingAs } from '../settings/sample.ts';
import { PageToast } from '../settings/Summary.tsx';
import { PeopleSection } from './People.tsx';

/** People on an event, drawn with no event around it: Settings' kit, with Today and Settings a tab away. */
export function PeopleRoute() {
  const layout = layoutOf(useLayout().kind);
  const insets = useSafeAreaInsets();
  const [told, setTold] = useState<string>();
  const tell = useCallback<Tell>((words) => setTold(words), []);

  useCoverStatusBar('dark', false);

  const openSection = useCallback(
    (section: SettingsSection) => router.push(settingsHref('owner', section)),
    [],
  );
  const toSettings = useCallback(() => router.push(settingsHref('owner', null)), []);
  const onTab = useCallback(
    (tab: Tab) => {
      if (tab === 'Today') router.replace('/demo/today');
      else if (tab === 'Settings') toSettings();
      else if (tab === 'Events') router.replace('/demo/events');
      else router.replace('/demo/calendar');
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

  return (
    <ShellContext.Provider value={shell}>
      <OrgSwitcherProvider state={null} tell={tell}>
        <View style={styles.fill}>
          <PeopleSection />
          {told != null && (
            <PageToast
              words={told}
              onClose={() => setTold(undefined)}
              bottom={Math.max(insets.bottom, tokens.spaceLg)}
            />
          )}
        </View>
      </OrgSwitcherProvider>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.colorCard },
});
