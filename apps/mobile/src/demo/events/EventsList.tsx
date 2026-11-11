import { filtered, formattingLocale, searching, wallDay } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  type GuestCounts,
  GUEST_WORDS as G,
  SAMPLE_GUESTS,
  figureOf,
  guestCountsOf,
  rowGuests,
} from './GuestCounts.ts';
import { PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import { Bell, Landscape, OrgPill, PortraitTop } from '../settings/Frame.tsx';
import { EventCard, EventThumb } from '../../components/EventCard.tsx';
import {
  EventsEmptyTab,
  EventsFirstRun,
  EventsSummaryLine,
  EventsTabs,
  Said,
  SaidLine,
} from '../../components/EventsList.tsx';
import {
  type Calendar,
  EventsFilterMenu,
  EventsResults,
  FilterButton,
  SearchField,
  SearchRow,
  useFilterWords,
} from '../../components/EventsSearch.tsx';
import {
  type CardStep,
  type Filters,
  type ListState,
  NO_FILTERS,
  PAST_PAGE,
  type Shown,
  emptyTabOf,
  eventHref,
  homeOf,
  hostNames,
  howSoon,
  listStart,
  resultsOf,
  rowLine,
  rowTag,
  summaryLine,
  withoutTab,
} from './EventsModel.ts';
import { CLOCKS, EVENTS, EVENT_OF_KEY, OFFLINE_AS_OF, READER_ZONE } from './EventsSample.ts';
import { W, say } from './EventsWords.ts';
import { kindOf, useShell } from '../../components/settingsShell.ts';
import {
  type Anchor,
  anchorUnder,
  LoadingBlock,
  Row,
  RowList,
  SunkTabs,
  TextAction,
} from '../../components/Summary.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { Notice } from '../../components/Notice.tsx';
import { EventsFailed } from '../../components/Events.tsx';
import { ListTop } from '../../components/ListTop.tsx';
import { LIST_EDGES, LIST_GAP } from '../../components/listFrame.ts';

const SEARCH_PAUSE_MS = 300;
const MENU_AFTER_MS = 700;

export function openEvent(id: string, query?: Readonly<Record<string, string>>): void {
  router.push(eventHref(id, query) as Href);
}

/** The card's step from the list: the event opens where the step is. */
export function stepFrom(
  event: Shown,
  step: Extract<CardStep, { kind: 'button' }>,
  tell: (words: string) => void,
) {
  if (step.action === 'makeLive') tell(say.ownDesign(W.makeLive));
  else if (step.action === 'changeDates') openEvent(event.id, { state: 'dates' });
  else if (step.action === 'duplicate') openEvent(event.id, { state: 'duplicate' });
  else openEvent(event.id);
}

/** Events in A, Summary first: search and Filter, the tabs, the soonest event as the card, then its rows. */
export function EventsList({
  state,
  deleted,
}: {
  state: ListState | null;
  deleted: string | null;
}) {
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const now = useMemo(() => new Date(CLOCKS.reader), []);
  const start = useMemo(() => listStart(state), [state]);
  const [tab, setTab] = useState(start.tab);
  const [typed, setTyped] = useState(start.typed);
  const [searched, setSearched] = useState(start.typed);
  const [filters, setFilters] = useState<Filters>(start.filters);
  const [pastShown, setPastShown] = useState(start.pastShown);
  const [offline, setOffline] = useState(state === 'offline' || state === 'eventsOffline');
  const [failed, setFailed] = useState(state === 'failed');
  const [moreFailed, setMoreFailed] = useState(state === 'pastFailed');
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const filterRef = useRef<ViewInstance>(null);
  const field = useRef<TextInputInstance>(null);
  const asks = state === 'firstAsk';
  const loading = state === 'loading';
  const first = state === 'first' || state === 'eventsFirst' || asks;
  const wide = shell.layout !== 'phone';
  const events = useMemo(() => {
    if (first) return [];
    const all = EVENTS.filter(
      (event) => event.id !== deleted && (state !== 'eventsZero' || event.status === 'draft'),
    );
    const emptied = emptyTabOf(state);

    return emptied == null ? all : withoutTab(all, emptied, now, locale);
  }, [first, deleted, state, now, locale]);
  const home = useMemo(() => homeOf(events, now, locale), [events, now, locale]);
  const looking = searching(searched) || filtered(filters);
  const guests = useMemo(
    () => guestCountsOf(events, state === 'noGuests' ? {} : SAMPLE_GUESTS, now),
    [events, state, now],
  );
  const results = useMemo(
    () => (looking ? resultsOf(events, searched, filters, now, locale) : null),
    [looking, events, searched, filters, now, locale],
  );
  const hosts = useMemo(() => hostNames(EVENTS, locale), [locale]);
  const filterWords = useFilterWords(filters, locale);
  const calendar: Calendar = { today: wallDay(now, READER_ZONE), firstDay: 1, locale };

  useEffect(() => {
    if (typed === searched) return;
    const wait = setTimeout(() => setSearched(typed), SEARCH_PAUSE_MS);

    return () => clearTimeout(wait);
  }, [typed, searched]);

  useEffect(() => {
    if (state !== 'filterOpen' && state !== 'manyFiltersOpen') return;
    const wait = setTimeout(() => anchorUnder(filterRef, setMenuAt), MENU_AFTER_MS);

    return () => clearTimeout(wait);
  }, [state]);

  const clearSearch = () => {
    setTyped('');
    setSearched('');
  };
  const guestLine = (event: Shown) => {
    const one = state === 'noGuests' ? null : rowGuests(event, SAMPLE_GUESTS, now);
    return one == null
      ? null
      : `${G.coming(one.coming, locale)} · ${G.notReplied(one.notReplied, locale)}`;
  };
  const row = (event: Shown, everyPhase: boolean) => ({
    key: event.id,
    inset: 60,
    row: (
      <Row
        title={event.name}
        line={[rowLine(event, locale), guestLine(event)].filter(Boolean).join('\n')}
        lead={<EventThumb event={event} />}
        tag={rowTag(event, everyPhase)}
        value={wide ? (howSoon(event, now) ?? undefined) : undefined}
        opens
        onPress={() => openEvent(event.id)}
        testID={`events.row.${event.id}`}
      />
    ),
  });

  const summary = first || loading || failed ? null : summaryLine(home);
  const top = (
    <>
      <ListTop
        kind={kindOf(shell.layout)}
        title={W.events}
        pill={<OrgPill />}
        bell={<Bell tell={shell.tell} />}
        primary={
          asks
            ? undefined
            : {
                label: W.newEvent,
                onPress: () => shell.tell(say.ownDesign(W.newEvent)),
                testID: 'events.new',
              }
        }
        under={summary != null && <EventsSummaryLine words={summary} />}
      />
      {!first && !loading && !failed && <GuestTiles counts={guests} locale={locale} />}
      <SwitchedNotice />
    </>
  );

  if (loading)
    return (
      <ListFrame offline={null}>
        {top}
        <SearchRow
          offline={false}
          field={
            <SearchField
              typed=""
              off
              width={shell.layout === 'portrait' ? 420 : shell.layout === 'landscape' ? 440 : null}
              onTyped={setTyped}
              onSearch={() => undefined}
              onClear={clearSearch}
              ref={field}
            />
          }
          filter={
            <FilterButton
              ref={filterRef}
              {...filterWords}
              wraps={!wide}
              off
              open={false}
              onPress={() => undefined}
            />
          }
        />
        <SunkTabs />
        <LoadingBlock words={W.loading} />
      </ListFrame>
    );

  if (failed)
    return (
      <ListFrame offline={null}>
        {top}
        <EventsFailed onRetry={() => setFailed(false)} testID="events.failed.retry" />
      </ListFrame>
    );

  if (first)
    return (
      <ListFrame offline={null}>
        {top}
        <EventsFirstRun
          wide={wide}
          onCreate={asks ? undefined : () => shell.tell(say.ownDesign(W.firstRunCreate))}
        />
      </ListFrame>
    );

  const tabEvents = home[tab];
  const card = tab === 'past' ? null : (tabEvents[0] ?? null);
  const rows = tab === 'past' ? tabEvents.slice(0, pastShown) : tabEvents.slice(1);
  const more = tab === 'past' && pastShown < tabEvents.length;
  const shownMore =
    tab === 'past' ? Math.max(0, Math.min(pastShown, tabEvents.length) - PAST_PAGE) : 0;

  return (
    <ListFrame
      offline={offline ? () => setOffline(false) : null}
      overlay={
        <EventsFilterMenu
          at={menuAt}
          onClose={() => setMenuAt(null)}
          opener={filterRef}
          filters={filters}
          onFilters={setFilters}
          hosts={hosts}
          calendar={calendar}
        />
      }
    >
      {top}
      <SearchRow
        offline={offline}
        field={
          <SearchField
            typed={typed}
            off={offline}
            width={shell.layout === 'portrait' ? 420 : shell.layout === 'landscape' ? 440 : null}
            onTyped={setTyped}
            onSearch={() => setSearched(typed)}
            onClear={clearSearch}
            ref={field}
          />
        }
        filter={
          <FilterButton
            ref={filterRef}
            {...filterWords}
            wraps={!wide}
            off={offline}
            open={menuAt != null}
            onPress={() => anchorUnder(filterRef, setMenuAt)}
          />
        }
      />
      {results == null ? (
        <>
          <EventsTabs
            tab={tab}
            counts={{
              upcoming: home.upcoming.length,
              drafts: home.drafts.length,
              past: home.past.length,
            }}
            onTab={setTab}
          />
          {tabEvents.length === 0 && <EventsEmptyTab tab={tab} />}
          {card != null && (
            <EventCard
              guests={guestLine(card)}
              event={card}
              now={now}
              locale={locale}
              wide={wide}
              onOpen={() => openEvent(card.id)}
              takes={() => true}
              onStep={(step) => stepFrom(card, step, shell.tell)}
              testID="events.card"
            />
          )}
          {rows.length > 0 && <RowList items={rows.map((event) => row(event, false))} />}
          {more && (
            <TextAction
              label={W.showMore}
              onPress={() => {
                setMoreFailed(false);
                setPastShown((shown) => shown + PAST_PAGE);
              }}
              testID="events.showMore"
            />
          )}
          {tab === 'past' && moreFailed && (
            <Notice tone="broken" mark={tokens.marks.broken.glyph} body={W.moreFailed} announce />
          )}
          {shownMore > 0 && <Said words={say.moreShown(shownMore)} />}
          {tabEvents.length > 0 && <SaidLine words={say.footer(tabEvents.length)} />}
        </>
      ) : (
        <EventsResults
          typed={searched}
          filters={filters}
          groups={results.groups.map((group) => ({
            tab: group.tab,
            count: group.events.length,
            rows: <RowList items={group.events.map((event) => row(event, true))} />,
          }))}
          locale={locale}
          onClearSearch={clearSearch}
          onClearFilters={() => setFilters(NO_FILTERS)}
        />
      )}
    </ListFrame>
  );
}

/** The list in its frame: the tab bar on the phone, the capsule upright, the app's sidebar on its side. */
function ListFrame({
  offline,
  overlay,
  children,
}: {
  offline: (() => void) | null;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const band = offline != null && <OfflineBand onRetry={offline} />;

  if (shell.layout === 'landscape')
    return (
      <Landscape
        column={null}
        at="Events"
        onEvent={(key) => openEvent(EVENT_OF_KEY[key])}
        overlay={overlay}
      >
        {band}
        <ScrollView
          style={styles.grow}
          contentContainerStyle={[styles.pane, LIST_EDGES.tabletLandscape]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Landscape>
    );

  const phone = shell.layout === 'phone';
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      {phone ? <View style={{ height: insets.top }} /> : <PortraitTop at="Events" />}
      {band}
      <ScrollView
        style={styles.grow}
        contentContainerStyle={[
          styles.blocks,
          phone
            ? [LIST_EDGES.phone, { paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2 }]
            : [LIST_EDGES.tabletPortrait, { paddingBottom: insets.bottom + tokens.space6xl * 2 }],
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {phone && (
        <>
          <TabBarFade />
          <PhoneTabBar bottom={foot} onTab={shell.onTab} at="Events" />
        </>
      )}
      {overlay}
    </View>
  );
}

function GuestTiles({ counts, locale }: { counts: GuestCounts; locale: string }) {
  return (
    <View style={styles.guests} testID="events.guests">
      <GuestTile
        id="invited"
        name={G.invited}
        figure={figureOf(counts.invited, locale)}
        line={G.coming(counts.coming, locale)}
      />
      <GuestTile
        id="replied"
        name={G.replied}
        figure={figureOf(counts.replied, locale)}
        line={G.notReplied(counts.notReplied, locale)}
      />
    </View>
  );
}

function GuestTile({
  id,
  name,
  figure,
  line,
}: {
  id: 'invited' | 'replied';
  name: string;
  figure: string;
  line: string;
}) {
  return (
    <View
      style={styles.guest}
      accessible
      accessibilityLabel={`${name}, ${figure}, ${line}`}
      testID={`events.guests.${id}`}
    >
      <Text size={14} weight="semibold" style={styles.secondary}>
        {name}
      </Text>
      <Text size={28} weight="bold" style={[styles.figures, styles.guestFigure]}>
        {figure}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.figures, styles.said]}>
        {line}
      </Text>
    </View>
  );
}

export function OfflineBand({
  onRetry,
  testID = 'events.offline',
}: {
  onRetry: () => void;
  testID?: string;
}) {
  useReadOut(say.offline(OFFLINE_AS_OF));

  return (
    <View style={styles.band} testID={testID}>
      <View style={styles.diamond} />
      <Text size={14.5} weight="semibold" style={[styles.grow, styles.figures]}>
        {say.offline(OFFLINE_AS_OF)}
      </Text>
      <TextAction label={W.tryAgain} onPress={onRetry} testID={`${testID}.retry`} />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  blocks: { gap: LIST_GAP },
  pane: { paddingBottom: tokens.space6xl * 2, gap: LIST_GAP },
  guests: { flexDirection: 'row', gap: tokens.spaceMd },
  guest: {
    flex: 1,
    minWidth: 0,
    gap: tokens.spaceHair,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  guestFigure: { lineHeight: 28 * 1.15 },
  said: { lineHeight: 14 * 1.45 },
  band: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXxl,
    backgroundColor: tokens.colorNeutralFill,
  },
  diamond: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: tokens.colorInkSecondary,
    transform: [{ rotate: '45deg' }],
  },
});
