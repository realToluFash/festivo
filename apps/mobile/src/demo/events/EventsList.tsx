import { filtered, formattingLocale, searching, wallDay } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
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
import { Glyph } from '../../components/Glyph.tsx';
import { PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import { Bell, Landscape, OrgPill, PortraitTop } from '../settings/Frame.tsx';
import { EventCard, EventThumb } from '../../components/EventCard.tsx';
import {
  EventsEmptyTab,
  EventsFirstRun,
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
import { useShell } from '../../components/settingsShell.ts';
import { Pill } from '../../components/SettingsParts.tsx';
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

  const top = (
    <>
      <ListTop
        summary={first || loading ? null : summaryLine(home)}
        wide={wide}
        bell={shell.layout !== 'portrait'}
        org={shell.layout === 'phone'}
        onNew={asks ? null : () => shell.tell(say.ownDesign(W.newEvent))}
        onBell={shell.tell}
      />
      {!first && !loading && <GuestTiles counts={guests} locale={locale} />}
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
              onPress={() => setPastShown((shown) => shown + PAST_PAGE)}
              testID="events.showMore"
            />
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
          contentContainerStyle={styles.pane}
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
            ? {
                paddingTop: tokens.spaceXxs,
                paddingHorizontal: tokens.spaceXxl,
                paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2,
              }
            : {
                paddingTop: 26,
                paddingHorizontal: tokens.space5xl,
                paddingBottom: insets.bottom + tokens.space6xl * 2,
              },
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

function ListTop({
  summary,
  wide,
  bell,
  org,
  onNew,
  onBell,
}: {
  summary: string | null;
  wide: boolean;
  bell: boolean;
  org: boolean;
  /** Absent for a role without Create events. */
  onNew: (() => void) | null;
  onBell: (words: string) => void;
}) {
  return (
    <View>
      {org && (
        <View style={styles.orgRow}>
          <OrgPill />
          <View style={styles.grow} />
          {bell && <Bell tell={onBell} />}
        </View>
      )}
      <View style={styles.titleRow}>
        <Text
          size={wide ? 34 : 30}
          weight="bold"
          accessibilityRole="header"
          style={[styles.grow, titled(wide ? 34 : 30)]}
        >
          {W.events}
        </Text>
        {onNew == null ? null : wide ? (
          <Pill
            label={W.newEvent}
            glyph="plus"
            height={tokens.sizeHit}
            full={false}
            onPress={onNew}
            testID="events.new"
          />
        ) : (
          <Pressable
            onPress={onNew}
            style={({ pressed }) => [styles.newRound, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={W.newEvent}
            testID="events.new"
          >
            <Glyph name="plus" size={20} ink={tokens.colorInkOnDark} weight={2.6} />
          </Pressable>
        )}
        {bell && !org && <Bell tell={onBell} />}
      </View>
      {summary != null && (
        <Text size={15} weight="medium" style={[styles.secondary, styles.figures, styles.summary]}>
          {summary}
        </Text>
      )}
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

function titled(size: number) {
  return { lineHeight: size * 1.12, letterSpacing: size * -0.02 };
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
  pressed: { opacity: tokens.opacityPressed },
  blocks: { gap: 18 },
  pane: { paddingTop: 26, paddingHorizontal: 30, paddingBottom: tokens.space6xl * 2, gap: 18 },
  orgRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spaceSm },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  summary: { marginTop: tokens.spaceHair, lineHeight: 15 * 1.45 },
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
  newRound: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
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
