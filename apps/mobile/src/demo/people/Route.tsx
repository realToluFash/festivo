import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import type { Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { useCoverStatusBar } from '../Welcome.tsx';
import { layoutOf } from '../../components/settingsShell.ts';
import { settingsHref } from '../settings/Route.tsx';
import { lookingAs } from '../settings/sample.ts';
import { type PeopleParams, PeopleSection } from './People.tsx';
import { doorStartOf } from '../doorCode/DoorCodeModel.ts';
import { EventsShell } from '../events/Route.tsx';
import { EventScreen } from '../events/EventPage.tsx';
import { SAMPLE_EVENT_ID } from '../messages/MessagesSample.ts';
import { type Shell, ShellContext, type ShellSection } from '../../components/settingsShell.ts';
import { PageToast } from '../../components/Summary.tsx';

/** /demo/people: People in its event's frame as every area is, on the iPad (sc-67665) and the phone (sc-70351); for the door code's own event, its own page with Today and Settings a tab away. */
export function PeopleRoute() {
  const params = useLocalSearchParams<PeopleParams>();
  const door = doorStartOf(params.state, params.code, params.show ?? params.hold);

  if (door == null)
    return (
      <EventsShell>
        <EventScreen id={SAMPLE_EVENT_ID} state={null} area="people" peopleParams={params} />
      </EventsShell>
    );

  return <PeopleAlone />;
}

function PeopleAlone() {
  const layout = layoutOf(useLayout().kind);
  const insets = useSafeAreaInsets();
  const [told, setTold] = useState<string>();
  const tell = useCallback<Tell>((words) => setTold(words), []);

  useCoverStatusBar('dark', false);

  const openSection = useCallback(
    (section: ShellSection) => router.push(settingsHref('owner', section)),
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
