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
import { layoutOf } from '../../components/settingsShell.ts';
import { settingsHref } from '../settings/Route.tsx';
import { lookingAs } from '../settings/sample.ts';
import { EventScreen } from './EventPage.tsx';
import { backToEvents } from './EventFrame.tsx';
import { EventsList } from './EventsList.tsx';
import { EventGone } from './EventGone.tsx';
import { eventStateOf, listStateOf } from './EventsModel.ts';
import { messagesStateOf } from '../messages/MessagesModel.ts';
import { seatingStateOf } from '../seating/SeatingModel.ts';
import { guestsFromOf, guestsStateOf } from '../guests/GuestsModel.ts';
import { budgetStateOf } from '../budget/BudgetModel.ts';
import { cardStateOf } from '../people/PeopleCardModel.ts';
import { areaOf, sampleEvent } from './EventsSample.ts';
import { say } from './EventsWords.ts';
import { type Shell, ShellContext, type ShellSection } from '../../components/settingsShell.ts';
import { PageToast } from '../../components/Summary.tsx';

/** Events on sample data, in Settings' shell: Today and Settings a tab away, and anything unbuilt said so. */
export function EventsShell({
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

/** /demo/events/[id]: one event, with ?state= for each phase, edit and question, and ?area= for an area, ?people= for Overview's People card; with ?area=messages, ?state= is Messages'. */
export function EventRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    state?: string;
    area?: string;
    switcher?: string;
    as?: string;
    people?: string;
    filter?: string;
  }>();
  const area = areaOf(params.area);
  const from = area === 'guests' ? guestsFromOf(params.filter) : null;
  const messages = area === 'messages' ? messagesStateOf(params.state) : null;
  const seating = area === 'seating' ? seatingStateOf(params.state) : null;
  const budget = area === 'budget' ? budgetStateOf(params.state) : null;
  // Can edit has no Budget: a deep link to it opens the event page, More open without it (sc-93).
  const noBudget = area === 'budget' && (budget === 'no_budget' || params.as === 'kemi');
  const state = noBudget ? 'more' : eventStateOf(params.state);
  const guests = area === 'guests' ? guestsStateOf(params.state) : null;
  const people = cardStateOf(params.people);

  if (area === 'guests' && params.state === 'eventDeleted')
    return (
      <EventsShell switcher={params.switcher}>
        <EventGone />
      </EventsShell>
    );

  return (
    <EventsShell switcher={params.switcher}>
      <EventScreen
        key={`${params.id ?? ''}:${state ?? ''}:${area ?? ''}:${messages ?? ''}:${seating ?? ''}:${guests ?? ''}:${budget ?? ''}:${people ?? ''}:${from ?? ''}`}
        id={params.id}
        state={state}
        area={noBudget ? null : area}
        messages={messages}
        seating={seating}
        guests={guests}
        budget={budget}
        people={people}
        guestsFrom={from}
        without={noBudget ? 'budget' : undefined}
      />
    </EventsShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.colorCard },
});
