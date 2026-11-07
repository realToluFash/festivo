import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { switcherStateOf } from '../OrgSwitcherModel.ts';
import { PHONE_TAB_BAR, type Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { useCoverStatusBar } from '../Welcome.tsx';
import { layoutOf, settingsHref } from '../settings/Route.tsx';
import { lookingAs } from '../settings/sample.ts';
import { PageToast } from '../settings/Summary.tsx';
import { EventScreen } from './EventPage.tsx';
import { backToEvents } from './EventFrame.tsx';
import { EventsList } from './EventsList.tsx';
import { eventStateOf, listStateOf } from './EventsModel.ts';
import { areaOf, sampleEvent } from './EventsSample.ts';
import { say } from './EventsWords.ts';
import { type Shell, ShellContext, type ShellSection } from '../../components/settingsShell.ts';

/** Events on sample data, in Settings' shell: Today and Settings a tab away, and anything unbuilt said so. */
function EventsShell({
  told: start,
  switcher,
  children,
}: {
  told?: string | undefined;
  switcher?: string | undefined;
  children: ReactNode;
}) {
  const layout = layoutOf(useLayout().kind);
  const insets = useSafeAreaInsets();
  const [told, setTold] = useState(start);
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
      else if (tab === 'Events') backToEvents();
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

/** /demo/events: the list, with ?state= for each of its states and ?deleted= after a delete. */
export function EventsRoute() {
  const params = useLocalSearchParams<{ state?: string; deleted?: string; switcher?: string }>();
  const state = listStateOf(params.state);
  const deleted = sampleEvent(params.deleted);

  return (
    <EventsShell
      key={`${state ?? ''}:${deleted?.id ?? ''}:${params.switcher ?? ''}`}
      told={deleted == null ? undefined : say.deleted(deleted.name)}
      switcher={params.switcher}
    >
      <EventsList state={state} deleted={deleted?.id ?? null} />
    </EventsShell>
  );
}

/** /demo/events/[id]: one event, with ?state= for each phase, edit and question, and ?area= for an area. */
export function EventRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    state?: string;
    area?: string;
    switcher?: string;
  }>();
  const state = eventStateOf(params.state);
  const area = areaOf(params.area);

  return (
    <EventsShell switcher={params.switcher}>
      <EventScreen
        key={`${params.id ?? ''}:${state ?? ''}:${area ?? ''}`}
        id={params.id}
        state={state}
        area={area}
      />
    </EventsShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.colorCard },
});
