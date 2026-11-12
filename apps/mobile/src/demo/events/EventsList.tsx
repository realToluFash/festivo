import { filtered, formattingLocale, searching, wallDay } from '@soirely/domain';
import { getLocales } from 'expo-localization';
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

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  FIGURE_OPENS,
  type GuestCounts,
  type GuestsTile,
  GUEST_WORDS as G,
  SAMPLE_GUESTS,
  eventsOfTile,
  figureOf,
  guestCountsOf,
  rowGuests,
  withReply,
} from './GuestCounts.ts';
import { PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import { Bell, Landscape, OrgPill, PortraitTop } from '../settings/Frame.tsx';
import { EventCard } from '../../components/EventCard.tsx';
import { EventThumb } from '../../components/EventThumb.tsx';
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
import { CLOCKS, EVENTS, OFFLINE_AS_OF, READER_ZONE } from './EventsSample.ts';
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
import { OfflineBand as ProductOfflineBand } from '../../components/OfflineBand.tsx';
import { LIST_EDGES, LIST_GAP } from '../../components/listFrame.ts';
import { openEvent } from './openEvent.ts';

const SEARCH_PAUSE_MS = 300;
const MENU_AFTER_MS = 700;
const REPLY_AFTER_MS = 2500;
const REPLYING = 'evt-wed-4';

const TILE_OF: Partial<Record<ListState, GuestsTile>> = {
  tileInvited: 'invited',
  tileReplied: 'replied',
};

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
  const [sample, setSample] = useState(() => (state === 'noGuests' ? {} : SAMPLE_GUESTS));
  const [tile, setTile] = useState<GuestsTile | null>(
    state == null ? null : (TILE_OF[state] ?? null),
  );
  const reads = state !== 'noGuestsRead';
  const guests = useMemo(() => guestCountsOf(events, sample, now), [events, sample, now]);
  const tileEvents = useMemo(
    () =>
      tile == null ? [] : eventsOfTile(tile, homeOf(events, now, locale).upcoming, sample, now),
    [tile, events, sample, now, locale],
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
    if (state !== 'replyLands') return;
    const wait = setTimeout(() => setSample((was) => withReply(was, REPLYING)), REPLY_AFTER_MS);

    return () => clearTimeout(wait);
  }, [state]);

  useEffect(() => {
    if (state !== 'filterOpen' && state !== 'manyFiltersOpen') return;
    const wait = setTimeout(() => anchorUnder(filterRef, setMenuAt), MENU_AFTER_MS);

    return () => clearTimeout(wait);
  }, [state]);

  const clearSearch = () => {
    setTyped('');
    setSearched('');
  };
  const guestLine = (event: Shown, inset: number) => {
    const figures = reads ? rowGuests(event, sample, now) : null;

    return (
      figures != null && (
        <GuestLine
          event={event}
          coming={figures.coming}
          notReplied={figures.notReplied}
          locale={locale}
          inset={inset}
        />
      )
    );
  };
  const row = (event: Shown, everyPhase: boolean) => ({
    key: event.id,
    inset: 60,
    row: (
      <View>
        <Row
          title={event.name}
          line={rowLine(event, locale)}
          lead={<EventThumb event={event} />}
          tag={rowTag(event, everyPhase)}
          value={wide ? (howSoon(event, now) ?? undefined) : undefined}
          opens
          onPress={() => openEvent(event.id)}
          testID={`events.row.${event.id}`}
        />
        {guestLine(event, 60)}
      </View>
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
      {!first && !loading && !failed && reads && (
        <GuestTiles
          counts={guests}
          locale={locale}
          chosen={tile}
          onTile={(next) => setTile((was) => (was === next ? null : next))}
        />
      )}
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
      {tile != null && results == null ? (
        <>
          <View style={styles.tileShown}>
            <Text size={14} weight="medium" style={[styles.secondary, styles.figures, styles.grow]}>
              {G.tileShown[tile](tileEvents.length, home.upcoming.length)}
            </Text>
            <TextAction
              label={G.clear}
              onPress={() => setTile(null)}
              testID="events.guests.clear"
            />
          </View>
          <RowList items={tileEvents.map((event) => row(event, false))} />
        </>
      ) : results == null ? (
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
            <View>
              <EventCard
                event={card}
                now={now}
                locale={locale}
                wide={wide}
                onOpen={() => openEvent(card.id)}
                takes={() => true}
                onStep={(step) => stepFrom(card, step, shell.tell)}
                testID="events.card"
              />
              {guestLine(card, 0)}
            </View>
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
export function ListFrame({
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
      <Landscape column={null} at="Events" overlay={overlay}>
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

/** sc-3786: under the event's card or row, beside its link and never inside it, each figure its own link into the event's Guests. */
function GuestLine({
  event,
  coming,
  notReplied,
  locale,
  inset,
}: {
  event: Shown;
  coming: number;
  notReplied: number;
  locale: string;
  inset: number;
}) {
  return (
    <View style={[styles.line, { marginLeft: inset }]} testID={`events.line.${event.id}`}>
      <FigureLink
        words={G.coming(coming, locale)}
        opens={G.comingOpens(event.name)}
        onPress={() => openEvent(event.id, { area: 'guests', filter: FIGURE_OPENS.coming })}
        testID={`events.line.${event.id}.coming`}
      />
      <Text
        size={14}
        weight="medium"
        style={styles.secondary}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        ·
      </Text>
      <FigureLink
        words={G.notReplied(notReplied, locale)}
        opens={G.notRepliedOpens(event.name)}
        onPress={() => openEvent(event.id, { area: 'guests', filter: FIGURE_OPENS.notReplied })}
        testID={`events.line.${event.id}.notReplied`}
      />
    </View>
  );
}

function FigureLink({
  words,
  opens,
  onPress,
  testID,
}: {
  words: string;
  opens: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${words}, ${opens}`}
      style={({ pressed }) => [styles.figureLink, pressed && styles.pressed]}
      testID={testID}
    >
      <Text size={14} weight="semibold" style={[styles.accent, styles.figures]}>
        {words}
      </Text>
    </Pressable>
  );
}

function GuestTiles({
  counts,
  locale,
  chosen,
  onTile,
}: {
  counts: GuestCounts;
  locale: string;
  chosen: GuestsTile | null;
  onTile: (tile: GuestsTile) => void;
}) {
  return (
    <View style={styles.guests} testID="events.guests">
      <GuestTile
        id="invited"
        name={G.invited}
        figure={figureOf(counts.invited, locale)}
        line={G.coming(counts.coming, locale)}
        on={chosen === 'invited'}
        onPress={() => onTile('invited')}
      />
      <GuestTile
        id="replied"
        name={G.replied}
        figure={figureOf(counts.replied, locale)}
        line={G.notReplied(counts.notReplied, locale)}
        on={chosen === 'replied'}
        onPress={() => onTile('replied')}
      />
    </View>
  );
}

function GuestTile({
  id,
  name,
  figure,
  line,
  on,
  onPress,
}: {
  id: GuestsTile;
  name: string;
  figure: string;
  line: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.guest, on && styles.guestOn, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${name}, ${figure}, ${line}, ${G.tileOpens[id]}`}
      testID={`events.guests.${id}`}
    >
      <View style={styles.tileName}>
        <Text size={14} weight="semibold" style={[styles.secondary, styles.grow]}>
          {name}
        </Text>
        {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />}
      </View>
      <Text size={28} weight="bold" style={[styles.figures, styles.guestFigure]}>
        {figure}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.figures, styles.said]}>
        {line}
      </Text>
    </Pressable>
  );
}

/** The product's band (sc-22586) over a sample Stale, its Try again clearing the demo's state and reaching no server. */
export function OfflineBand({ onRetry }: { onRetry: () => void }) {
  const [at] = useState(() => {
    const day = new Date();
    day.setHours(Number(OFFLINE_AS_OF.slice(0, 2)), Number(OFFLINE_AS_OF.slice(3)), 0, 0);

    return day;
  });

  return <ProductOfflineBand stale={{ at, retry: onRetry, unanswered: 0 }} inFront />;
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
  guestOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  guestFigure: { lineHeight: 28 * 1.15 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: tokens.spaceXs },
  figureLink: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  tileName: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  tileShown: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  said: { lineHeight: 14 * 1.45 },
});
