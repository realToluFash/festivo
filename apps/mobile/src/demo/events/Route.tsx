import { type Href, router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { type Place, switcherStateOf } from '../OrgSwitcherModel.ts';
import { PHONE_TAB_BAR, type Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { useCoverStatusBar } from '../Welcome.tsx';
import { layoutOf } from '../../components/settingsShell.ts';
import { settingsHref } from '../settings/Route.tsx';
import { lookingAs } from '../settings/sample.ts';
import { EventScreen } from './EventPage.tsx';
import { type Opened, openerOf } from './opener.ts';
import { backToEvents } from './EventFrame.tsx';
import { EventsList } from './EventsList.tsx';
import { EventGone } from './EventGone.tsx';
import { linkStateOf } from './EventLink.ts';
import { EventLinkPage } from './EventLinkPage.tsx';
import { eventStateBeside, listStateOf } from './EventsModel.ts';
import { AT_READ, refusedStartOf } from './DeleteRefusal.ts';
import { messagesStateOf } from '../messages/MessagesModel.ts';
import { seatingStateOf } from '../seating/SeatingModel.ts';
import { guestsFromOf, guestsStateOf } from '../guests/GuestsModel.ts';
import { budgetStateOf } from '../budget/BudgetModel.ts';
import { rosterStateOf } from '../staffLink/StaffRosterModel.ts';
import { cardStateOf } from '../people/PeopleCardModel.ts';
import { areaOf, sampleEvent } from './EventsSample.ts';
import { say } from './EventsWords.ts';
import { originStateOf } from '../enquiries/EnquiryToEventModel.ts';
import { CREATED_ID } from './NewEvent.tsx';
import {
  type Looking,
  type Shell,
  ShellContext,
  type ShellSection,
} from '../../components/settingsShell.ts';
import { PageToast } from '../../components/Summary.tsx';
import { type WayInState, wayInOf, wayInStateOf } from '../enquiries/WayInModel.ts';
import { WayInRow } from '../enquiries/WayInRow.tsx';

const OWNER = lookingAs('owner');

/** Events on sample data, in Settings' shell: Today and Settings a tab away, and anything unbuilt said so. */
export function EventsShell({
  told: start,
  switcher,
  looking = OWNER,
  place = null,
  children,
}: {
  told?: string | undefined;
  switcher?: string | undefined;
  place?: Place | null;
  looking?: Looking;
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
      looking,
      open: null,
      openSection,
      toSettings,
      tell,
      onTab,
      listColumn: null,
    }),
    [layout, looking, openSection, toSettings, tell, onTab],
  );
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <ShellContext.Provider value={shell}>
      <OrgSwitcherProvider state={switcherStateOf(switcher)} place={place} tell={tell}>
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
  const wayIn = wayInStateOf(params.state);
  if (wayIn != null) return <WayInRoute state={wayIn} />;

  return <ListRoute params={params} />;
}

function WayInRoute({ state }: { state: WayInState }) {
  const { i18n } = useTranslation();
  const way = wayInOf(state);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: way.language, initAsync: false }),
    [i18n, way.language],
  );

  const pushedFor = useRef<WayInState | null>(null);

  useEffect(() => {
    if (!way.opensEnquiries || pushedFor.current === state) return undefined;
    const later = setTimeout(() => {
      pushedFor.current = state;
      router.push('/demo/enquiries' as Href);
    }, 600);

    return () => clearTimeout(later);
  }, [way.opensEnquiries, state]);

  return (
    <I18nextProvider i18n={words}>
      <EventsShell key={state}>
        <EventsList state={way.list} deleted={null} wayIn={way.enterprise && <WayInRow />} />
      </EventsShell>
    </I18nextProvider>
  );
}

function ListRoute({
  params,
}: {
  params: { state?: string; deleted?: string; switcher?: string };
}) {
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

/** /demo/events/[id]: one event, with ?state= for each phase, edit and question, or the draft made from an enquiry (sc-31232), and ?area= for an area, ?people= for Overview's People card, ?link= for opening it from its link (sc-80863), ?from= for what it was opened over, ?pushed=1 when that screen is under it and ?q= for Search's term, with ?lang=es and ?refreshing=1 (sc-83008), and ?bell=open for an iPad's bell open over it (sc-84453); with ?area=messages, ?state= is Messages'. */
export function EventRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    state?: string;
    area?: string;
    switcher?: string;
    as?: string;
    people?: string;
    filter?: string;
    staff?: string;
    link?: string;
    from?: string;
    pushed?: string;
    q?: string;
    lang?: string;
    refreshing?: string;
    bell?: string;
  }>();
  const link = linkStateOf(params.link);
  const opened: Opened = {
    opener: openerOf(params.from),
    pushed: params.pushed === '1',
    term: params.q ?? null,
    spanish: params.lang === 'es',
    refreshing: params.refreshing === '1',
    bell: params.bell === 'open',
  };
  const area = areaOf(params.area);
  const staff = area === 'staff' ? rosterStateOf(params.staff) : null;
  // Without staff.read the event has no Staff: a deep link to it opens the event page, More open without it (sc-77903).
  const noStaff = staff === 'noRead';
  const from =
    area !== 'guests'
      ? null
      : params.filter === 'changed'
        ? 'changed'
        : guestsFromOf(params.filter);
  const messages = area === 'messages' ? messagesStateOf(params.state) : null;
  const seating = area === 'seating' ? seatingStateOf(params.state) : null;
  const budget = area === 'budget' ? budgetStateOf(params.state) : null;
  // Can edit has no Budget: a deep link to it opens the event page, More open without it (sc-93).
  const noBudget = area === 'budget' && (budget === 'no_budget' || params.as === 'kemi');
  const state = noBudget || noStaff ? 'more' : eventStateBeside(params.state, messages);
  const guests = area === 'guests' ? guestsStateOf(params.state) : null;
  const people = cardStateOf(params.people);
  const origin = params.id === CREATED_ID ? originStateOf(params.state) : null;

  if (link != null)
    return (
      <EventsShell key={link}>
        <EventLinkPage id={params.id} state={link} opened={opened} />
      </EventsShell>
    );

  if (area === 'guests' && params.state === 'eventDeleted')
    return (
      <EventsShell switcher={params.switcher}>
        <EventGone />
      </EventsShell>
    );

  return (
    <EventsShell
      switcher={params.switcher}
      {...(refusedStartOf(state)?.canChange === false || state === 'makeLiveCannotSend'
        ? { looking: AT_READ }
        : {})}
    >
      <EventScreen
        key={`${params.id ?? ''}:${state ?? ''}:${area ?? ''}:${messages ?? ''}:${seating ?? ''}:${guests ?? ''}:${budget ?? ''}:${staff ?? ''}:${people ?? ''}:${from ?? ''}:${origin ?? ''}`}
        id={params.id}
        state={state}
        area={noBudget || noStaff ? null : area}
        messages={messages}
        seating={seating}
        guests={guests}
        budget={budget}
        staff={staff}
        people={people}
        guestsFrom={from}
        without={noBudget ? 'budget' : noStaff ? 'staff' : undefined}
        origin={origin}
        opened={opened}
      />
    </EventsShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.colorCard },
});
