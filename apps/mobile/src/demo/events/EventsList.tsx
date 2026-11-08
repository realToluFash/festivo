import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, type Ref, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '../../components/Field.tsx';
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
import { EventsFirstRun, EventsTabs, Said, SaidLine } from '../../components/EventsList.tsx';
import { EventsFilterMenu, FilterButton } from './EventsFilter.tsx';
import {
  type CardStep,
  type Filters,
  type ListState,
  NO_FILTERS,
  PAST_PAGE,
  type Shown,
  tabWord,
  eventHref,
  filterWord,
  filtered,
  homeOf,
  hostNames,
  howSoon,
  listStart,
  noMatchLine,
  resultsOf,
  rowLine,
  rowTag,
  searching,
  summaryLine,
} from './EventsModel.ts';
import { CLOCKS, EVENTS, EVENT_OF_KEY, OFFLINE_AS_OF } from './EventsSample.ts';
import { W, say } from './EventsWords.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import {
  type Anchor,
  anchorUnder,
  HeadCount,
  Row,
  RowList,
  SectionHead,
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
  const first = state === 'first' || state === 'eventsFirst';
  const wide = shell.layout !== 'phone';
  const events = useMemo(
    () =>
      first
        ? []
        : EVENTS.filter(
            (event) => event.id !== deleted && (state !== 'eventsZero' || event.status === 'draft'),
          ),
    [first, deleted, state],
  );
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
  const word = filterWord(filters, locale);

  useReadOut(results == null ? null : say.count(results.count));

  useEffect(() => {
    if (typed === searched) return;
    const wait = setTimeout(() => setSearched(typed), SEARCH_PAUSE_MS);

    return () => clearTimeout(wait);
  }, [typed, searched]);

  useEffect(() => {
    if (state !== 'filterOpen') return;
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
        summary={first ? null : summaryLine(home)}
        wide={wide}
        bell={shell.layout !== 'portrait'}
        org={shell.layout === 'phone'}
        onNew={() => shell.tell(say.ownDesign(W.newEvent))}
        onBell={shell.tell}
      />
      {!first && <GuestTiles counts={guests} locale={locale} />}
      <SwitchedNotice />
    </>
  );

  if (first)
    return (
      <ListFrame offline={null}>
        {top}
        <EventsFirstRun wide={wide} onCreate={() => shell.tell(say.ownDesign(W.firstRunCreate))} />
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
          locale={locale}
        />
      }
    >
      {top}
      <View style={styles.searchBlock}>
        <View style={styles.searchRow}>
          <SearchField
            typed={typed}
            off={offline}
            width={shell.layout === 'portrait' ? 420 : shell.layout === 'landscape' ? 440 : null}
            onTyped={setTyped}
            onSearch={() => setSearched(typed)}
            onClear={clearSearch}
            ref={field}
          />
          <FilterButton
            ref={filterRef}
            word={word}
            off={offline}
            open={menuAt != null}
            onPress={() => anchorUnder(filterRef, setMenuAt)}
          />
        </View>
        {offline && (
          <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
            {W.searchOffline}
          </Text>
        )}
      </View>
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
          {card != null && (
            <EventCard
              guests={guestLine(card)}
              event={card}
              now={now}
              locale={locale}
              wide={wide}
              onOpen={() => openEvent(card.id)}
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
          <SaidLine words={say.footer(tabEvents.length)} />
        </>
      ) : (
        <Results
          count={results.count}
          onClearFilters={filtered(filters) ? () => setFilters(NO_FILTERS) : null}
        >
          {results.count === 0 ? (
            <View style={styles.noMatch} testID="events.noMatch">
              <Text size={18} weight="bold" accessibilityRole="header" style={styles.noMatchTitle}>
                {W.noMatch}
              </Text>
              <Text size={15} weight="medium" style={[styles.secondary, styles.noMatchLine]}>
                {noMatchLine(searched, filters, locale)}
              </Text>
              <View style={styles.noMatchActions}>
                {searching(searched) && (
                  <TextAction
                    label={W.clearSearch}
                    onPress={clearSearch}
                    testID="events.noMatch.clearSearch"
                  />
                )}
                {filtered(filters) && (
                  <TextAction
                    label={W.clearFilters}
                    onPress={() => setFilters(NO_FILTERS)}
                    testID="events.noMatch.clearFilters"
                  />
                )}
              </View>
            </View>
          ) : (
            <View style={styles.groups}>
              {results.groups.map((group) => (
                <View key={group.tab}>
                  <SectionHead
                    title={tabWord(group.tab)}
                    right={<HeadCount text={String(group.events.length)} />}
                  />
                  <RowList items={group.events.map((event) => row(event, true))} />
                </View>
              ))}
            </View>
          )}
        </Results>
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
  onNew: () => void;
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
        {wide ? (
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

export function SearchField({
  typed,
  off,
  width,
  onTyped,
  onSearch,
  onClear,
  label = W.search,
  testID = 'events.search',
  ref,
}: {
  typed: string;
  off: boolean;
  width: number | null;
  onTyped: (typed: string) => void;
  onSearch: () => void;
  onClear: () => void;
  label?: string;
  testID?: string;
  ref?: Ref<TextInputInstance>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View accessibilityRole="search" style={width == null ? styles.searchPhone : { width }}>
      <View
        style={[
          styles.search,
          typed !== '' && styles.searchTyped,
          off && styles.searchOff,
          focused && styles.searchFocused,
        ]}
      >
        <Glyph
          name="search"
          size={18}
          ink={off ? tokens.colorInkTertiary : tokens.colorInkSecondary}
          weight={2.2}
        />
        <TextField
          ref={ref}
          value={typed}
          editable={!off}
          placeholder={label}
          placeholderTextColor={off ? tokens.colorInkTertiary : tokens.colorInkSecondary}
          onChangeText={onTyped}
          onSubmitEditing={onSearch}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={label}
          style={styles.searchInput}
          testID={testID}
        />
        {typed !== '' && (
          <Pressable
            onPress={onClear}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel={W.clearSearch}
            testID={`${testID}.clear`}
          >
            <View style={styles.clearDot}>
              <Glyph name="x" size={12} ink={tokens.colorInkOnDark} weight={3} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Results({
  count,
  onClearFilters,
  children,
}: {
  count: number;
  onClearFilters: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.results}>
      <View style={styles.countRow}>
        <Text
          size={16}
          weight="semibold"
          style={[styles.grow, styles.figures]}
          testID="events.count"
        >
          {say.count(count)}
        </Text>
        {onClearFilters != null && count > 0 && (
          <TextAction
            label={W.clearFilters}
            onPress={onClearFilters}
            testID="events.clearFilters"
          />
        )}
      </View>
      {children}
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
  searchBlock: { gap: tokens.spaceXs },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceSm,
    rowGap: tokens.spaceXxs,
  },
  searchPhone: { flexGrow: 1, flexBasis: 220 },
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: 14,
    paddingRight: 14,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    borderRadius: 14,
    backgroundColor: tokens.colorCard,
  },
  searchTyped: { paddingRight: tokens.spaceHair },
  searchOff: { borderColor: tokens.colorBorder, backgroundColor: tokens.colorInset },
  searchFocused: { borderWidth: 2, borderColor: tokens.colorAccent, paddingLeft: 13.5 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  clear: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkTertiary,
  },
  results: { gap: 18 },
  countRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  groups: { gap: tokens.spaceMd },
  noMatch: { gap: tokens.spaceXs, paddingTop: tokens.spaceXxs },
  noMatchTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  noMatchLine: { lineHeight: 15 * 1.45 },
  noMatchActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
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
