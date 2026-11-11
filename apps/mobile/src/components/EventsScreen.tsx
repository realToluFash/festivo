import {
  type EventsFilters,
  type EventsSearch,
  type EventsTab,
  NO_EVENTS_FILTERS,
  eventsSearchOf,
  firstDayOfWeek,
  rememberEventsTab,
  rememberedEventsTab,
  roleHolds,
  serverClock,
  takesCardStep,
  wallDay,
  withPastPage,
} from '@soirely/domain';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { eventHref } from '../kit/eventNav.ts';
import { takeDeleted } from '../kit/eventSaved.ts';
import { hasNoEvents } from '../kit/eventsOpen.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { useOffline } from '../offline.ts';
import { afterFailedLoad } from '../offlineLoad.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { EventsFailed } from './Events.tsx';
import {
  EventsFound,
  EventsHome,
  EventsSummary,
  type FoundLoad,
  type HomeLoad,
} from './EventsHome.tsx';
import {
  type Calendar,
  EventsFilterMenu,
  FilterButton,
  SearchField,
  SearchRow,
  useFilterWords,
} from './EventsSearch.tsx';
import { EventsFirstRun } from './EventsList.tsx';
import { type ListAndPageSpacing, ListAndPage, useListAndPageLayout } from './ListAndPage.tsx';
import { phoneTabBarClearance } from './TodayCover.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';
import { Arrived } from './Skeleton.tsx';
import {
  type Anchor,
  LoadingBlock,
  SunkTabs,
  PageToast,
  anchorUnder,
  useAnchorFollowsTurn,
} from './Summary.tsx';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | ({ kind: 'loaded'; refreshing: boolean } & HomeLoad);

const PAST_PAGE = 10;

/** How long typing rests before it searches; Return searches at once. */
const SEARCH_PAUSE_MS = 300;

const SEARCH_WIDTH: Record<'phone' | 'tabletPortrait' | 'tabletLandscape', number | null> = {
  phone: null,
  tabletPortrait: 420,
  tabletLandscape: 440,
};

type Found =
  | { search: string; kind: 'loading' }
  | { search: string; kind: 'failed' }
  | ({ search: string; kind: 'loaded' } & FoundLoad);

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const LOADING: Load = { kind: 'loading' };

/** Events, `EventsHome-*` (sc-1593): the organisation's events; an event's page is pushed over it (sc-22103). The search and Filter stay while the person stays in Events (sc-30302). */
export function EventsScreen() {
  const { t } = useTranslation();
  const { kind } = useListAndPageLayout(SPACING, 'nothing');
  const insets = useSafeAreaInsets();
  const underTabs = phoneTabBarClearance(insets.bottom);
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const reads = organisation != null;
  const creates = organisation != null && roleHolds(organisation, 'events.create');
  const [deleted, setDeleted] = useState<string | null>(null);

  const [held, setHeld] = useState<{ in: string | undefined; load: Load }>({
    in: organisationId,
    load: LOADING,
  });
  const load = held.in === organisationId ? held.load : LOADING;
  const [attempt, setAttempt] = useState(0);
  const title = useRef<TextHandle>(null);
  const now = useServerNow();
  const locale = dateLocale();
  const calendar: Calendar = {
    today: wallDay(now, readerZone()),
    firstDay: firstDayOfWeek(locale),
    locale,
  };
  const [lookIn, setLookIn] = useState(organisationId);
  const [typed, setTyped] = useState('');
  const [searched, setSearched] = useState('');
  const [filters, setFilters] = useState<EventsFilters>(NO_EVENTS_FILTERS);
  const [hosts, setHosts] = useState<readonly string[]>([]);
  const [found, setFound] = useState<Found | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const filterRef = useRef<ViewInstance>(null);
  useAnchorFollowsTurn(filterRef, menuAt != null, setMenuAt);
  const filterWords = useFilterWords(filters, locale);
  if (lookIn !== organisationId) {
    setLookIn(organisationId);
    setTyped('');
    setSearched('');
    setFilters(NO_EVENTS_FILTERS);
    setHosts([]);
    setFound(null);
  }

  // The rows stay in place while they reload; a failed load gives way to loading.
  const reload = useCallback(() => {
    setHeld((before) => ({
      in: before.in,
      load: before.load.kind === 'loaded' ? { ...before.load, refreshing: true } : LOADING,
    }));
    setAttempt((n) => n + 1);
  }, []);

  const { watch, freshen, stale } = useOffline({
    loaded: load.kind === 'loaded',
    reload,
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  const searchOff = stale != null;
  const search = searchOff
    ? null
    : eventsSearchOf({ q: searched, filters }, calendar.today, calendar.firstDay);
  const searchKey = search == null ? null : JSON.stringify(search);

  useEffect(() => {
    if (typed === searched) return;
    const wait = setTimeout(() => setSearched(typed), SEARCH_PAUSE_MS);

    return () => clearTimeout(wait);
  }, [typed, searched]);

  useEffect(() => {
    if (organisationId == null || !reads || attempt === 0) return;
    let live = true;

    api.eventHosts(organisationId).then(
      (names) => live && setHosts(names),
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, [organisationId, reads, attempt]);

  useEffect(() => {
    if (organisationId == null || searchKey == null) return;
    let live = true;

    watch(api.searchedEvents(organisationId, JSON.parse(searchKey) as EventsSearch)).then(
      ({ unfinished, past }) =>
        live &&
        setFound({ search: searchKey, kind: 'loaded', unfinished, past, at: serverClock.now() }),
      () => live && setFound({ search: searchKey, kind: 'failed' }),
    );

    return () => {
      live = false;
    };
  }, [organisationId, searchKey, searchAttempt, watch]);

  const clearSearch = () => {
    setTyped('');
    setSearched('');
  };

  const [tab, setTab] = useState<{ in: string | undefined; tab: EventsTab }>(() => ({
    in: organisationId,
    tab: organisationId == null ? 'upcoming' : rememberedEventsTab(organisationId),
  }));
  if (tab.in !== organisationId) {
    setTab({
      in: organisationId,
      tab: organisationId == null ? 'upcoming' : rememberedEventsTab(organisationId),
    });
  }

  useFocusEffect(
    useCallback(() => {
      const gone = takeDeleted();
      setDeleted(gone);
      // Back from an event's page lands on the tab that now holds it.
      if (organisationId != null) {
        setTab({ in: organisationId, tab: rememberedEventsTab(organisationId) });
      }
      // A load already out may have left before the delete, so it cannot be joined.
      if (gone != null) reload();
      else freshen();
    }, [reload, freshen, organisationId]),
  );

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') freshen();
    });

    return () => listener.remove();
  }, [freshen]);

  useEffect(() => {
    if (organisationId == null || !reads || attempt === 0) return;
    let live = true;

    watch(
      Promise.all([
        api.unfinishedEvents(organisationId),
        api.events(organisationId, { finished: true, itemsPerPage: PAST_PAGE }),
      ]),
    ).then(
      ([unfinished, past]) =>
        live &&
        setHeld({
          in: organisationId,
          load: {
            kind: 'loaded',
            unfinished,
            past: past.events,
            pastTotal: past.total,
            pastPages: 1,
            at: serverClock.now(),
            refreshing: false,
          },
        }),
      (error: unknown) =>
        live &&
        setHeld((before) => ({
          in: organisationId,
          load: afterFailedLoad(
            before.load.kind === 'loaded' ? { ...before.load, refreshing: false } : before.load,
            error,
            { kind: 'failed' },
          ),
        })),
    );

    return () => {
      live = false;
    };
  }, [organisationId, reads, attempt, watch]);

  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [moreShown, setMoreShown] = useState<string | null>(null);
  const showMore = () => {
    if (organisationId == null || load.kind !== 'loaded') return;
    const loaded = load;

    setMore('loading');
    api
      .events(organisationId, {
        finished: true,
        page: loaded.pastPages + 1,
        itemsPerPage: PAST_PAGE,
      })
      .then(
        (page) => {
          const read = withPastPage(loaded, page, PAST_PAGE);

          setHeld({ in: organisationId, load: read.load });
          setMoreShown(t('eventsScreen.moreShown', { count: read.added }));
          setMore('idle');
        },
        () => setMore('failed'),
      );
  };

  if (organisation != null && !reads) {
    return <Redirect href={DESTINATION_HREF.home} />;
  }

  const newEvent = () => router.push('/events/new');
  const openEvent = (id: string, fromHappeningNow: boolean) => {
    setDeleted(null);
    router.push(eventHref(id, fromHappeningNow));
  };

  const searchRow = (off: boolean) => (
    <SearchRow
      offline={searchOff}
      field={
        <SearchField
          typed={typed}
          off={off}
          width={SEARCH_WIDTH[kind]}
          onTyped={setTyped}
          onSearch={() => setSearched(typed)}
          onClear={clearSearch}
        />
      }
      filter={
        <FilterButton
          ref={filterRef}
          {...filterWords}
          wraps={SEARCH_WIDTH[kind] == null}
          off={off}
          open={menuAt != null}
          onPress={() => anchorUnder(filterRef, setMenuAt)}
        />
      }
    />
  );
  const results =
    search == null ? null : found == null ||
      found.kind === 'loading' ||
      (found.kind === 'failed' && found.search !== searchKey) ? (
      <LoadingBlock words={t('eventsScreen.loading')} />
    ) : found.kind === 'failed' ? (
      <EventsFailed
        onRetry={() => {
          setFound({ search: found.search, kind: 'loading' });
          setSearchAttempt((n) => n + 1);
        }}
        testID="events.search.retry"
      />
    ) : (
      <EventsFound
        kind={kind}
        found={found}
        typed={searched}
        filters={filters}
        onOpen={openEvent}
        onClearSearch={clearSearch}
        onClearFilters={() => setFilters(NO_EVENTS_FILTERS)}
      />
    );

  const list = !reads ? null : load.kind === 'loading' ? (
    <View style={styles.loading}>
      {searchRow(true)}
      <SunkTabs />
      <LoadingBlock words={t('eventsScreen.loading')} />
    </View>
  ) : load.kind === 'failed' ? (
    <EventsFailed onRetry={reload} testID="events.retry" />
  ) : (
    <Arrived style={styles.stack}>
      {hasNoEvents(load) ? (
        <EventsFirstRun wide={kind !== 'phone'} onCreate={creates ? newEvent : undefined} />
      ) : results != null ? (
        <>
          {searchRow(false)}
          {results}
        </>
      ) : (
        <>
          {searchRow(searchOff)}
          <EventsHome
            kind={kind}
            load={load}
            tab={tab.tab}
            onTab={(next) => {
              if (organisationId != null) rememberEventsTab(organisationId, next);
              setTab({ in: organisationId, tab: next });
            }}
            onOpen={openEvent}
            takes={(action) => organisation != null && takesCardStep(organisation, action)}
            onStep={(event, step) => {
              const id = encodeURIComponent(event.id);

              if (step.action === 'changeDates') {
                setDeleted(null);
                router.push(`/events/${id}/edit?at=starts`);
              } else if (step.action === 'duplicate') {
                setDeleted(null);
                router.push(`/events/${id}/duplicate`);
              } else {
                openEvent(event.id, event.phase === 'happening_now');
              }
            }}
            more={more}
            shown={moreShown}
            onShowMore={showMore}
          />
        </>
      )}
      <EventsFilterMenu
        at={menuAt}
        onClose={() => setMenuAt(null)}
        opener={filterRef}
        filters={filters}
        onFilters={setFilters}
        hosts={hosts}
        calendar={calendar}
      />
    </Arrived>
  );
  const firstVisit = load.kind === 'loaded' && hasNoEvents(load);
  const underTitle =
    !reads || load.kind !== 'loaded' ? null : load.refreshing ? (
      <Text
        size={tokens.typeBodyPhone.size}
        muted
        accessibilityRole="text"
        testID="events.refreshing"
      >
        {t('eventsScreen.refreshing')}
      </Text>
    ) : !firstVisit ? (
      <EventsSummary load={load} />
    ) : null;

  return (
    <AppFrame
      current="events"
      top="scrolls"
      title={t('eventsScreen.title')}
      titleRef={title}
      offline={stale}
      underTitle={underTitle}
      primary={
        creates
          ? { label: t('eventsScreen.newEvent'), onPress: newEvent, testID: 'events.new' }
          : undefined
      }
      listUnderTabs
    >
      <ListAndPage
        kind={kind}
        list={list}
        listRefresh={
          reads && load.kind === 'loaded' ? (
            <RefreshControl refreshing={load.refreshing} onRefresh={stale?.retry ?? freshen} />
          ) : undefined
        }
        page={null}
        pageInFront={false}
        pageless
        pageKey=""
        back={{ label: t('eventsScreen.back'), onPress: () => undefined, testID: 'events.back' }}
        spacing={SPACING}
      />
      {deleted != null && (
        <PageToast
          words={t('eventDelete.deleted', { event: deleted })}
          onClose={() => setDeleted(null)}
          bottom={
            kind === 'phone'
              ? underTabs + tokens.spaceMd
              : kind === 'tabletLandscape'
                ? Math.max(insets.bottom, tokens.spaceLg) - Math.max(insets.bottom, tokens.spaceMd)
                : Math.max(insets.bottom, tokens.spaceLg)
          }
        />
      )}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  loading: { gap: 18 },
  phone: {
    gap: 18,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space6xl * 2,
  },
  portrait: {
    gap: 18,
    paddingTop: 26,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: 18,
    paddingTop: 26,
    paddingHorizontal: 30,
  },
  column: { gap: 18, paddingBottom: tokens.space5xl },
});

const SPACING: ListAndPageSpacing = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  landscape: styles.landscape,
  column: styles.column,
  listWidth: 360,
  between: tokens.spaceXxl,
};
