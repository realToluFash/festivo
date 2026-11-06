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
import { Glyph } from '../Glyph.tsx';
import { PhoneTabBar } from '../TodayCover.tsx';
import { Bell, Fade, Landscape, PHONE_TAB_BAR, PortraitTop, useShell } from '../settings/Frame.tsx';
import { Pill } from '../settings/parts.tsx';
import {
  type Anchor,
  CardSays,
  HeadCount,
  Row,
  RowList,
  SectionHead,
  StepButton,
  SummaryCard,
  TextAction,
  anchorUnder,
} from '../settings/Summary.tsx';
import { EventCard, EventThumb } from './EventCard.tsx';
import { EventsFilterMenu, FilterButton } from './EventsFilter.tsx';
import {
  type CardStep,
  type Filters,
  type ListState,
  type ListTab,
  NO_FILTERS,
  PAST_PAGE,
  type Shown,
  TAB_WORDS,
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

const SEARCH_PAUSE_MS = 300;
const MENU_AFTER_MS = 700;
const TABS: readonly ListTab[] = ['upcoming', 'drafts', 'past'];

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
  const [offline, setOffline] = useState(state === 'offline');
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const filterRef = useRef<ViewInstance>(null);
  const field = useRef<TextInputInstance>(null);
  const first = state === 'first';
  const wide = shell.layout !== 'phone';
  const events = useMemo(
    () => (first ? [] : EVENTS.filter((event) => event.id !== deleted)),
    [first, deleted],
  );
  const home = useMemo(() => homeOf(events, now, locale), [events, now, locale]);
  const looking = searching(searched) || filtered(filters);
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
  const row = (event: Shown, everyPhase: boolean) => ({
    key: event.id,
    inset: 60,
    row: (
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
    ),
  });

  const top = (
    <ListTop
      summary={first ? null : summaryLine(home)}
      wide={wide}
      bell={shell.layout !== 'portrait'}
      onNew={() => shell.tell(say.ownDesign(W.newEvent))}
      onBell={shell.tell}
    />
  );

  if (first)
    return (
      <ListFrame offline={null}>
        {top}
        <SummaryCard size={wide ? 'wide' : 'page'} height={200} testID="events.first">
          <CardSays text={W.firstRunTitle} size={wide ? 28 : 24} heading />
          <View style={styles.cardFoot}>
            <StepButton
              label={W.firstRunCreate}
              onPress={() => shell.tell(say.ownDesign(W.firstRunCreate))}
              testID="events.first.create"
            />
          </View>
        </SummaryCard>
        <RowList
          items={W.firstRunSteps.map((step, index) => ({
            key: step,
            inset: 52,
            row: <Row title={step} lead={<StepTile n={index + 1} />} />,
          }))}
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
          <Text size={14} weight="medium" style={styles.secondary}>
            {W.searchOffline}
          </Text>
        )}
      </View>
      {results == null ? (
        <>
          <Segment
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
          <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
            {say.footer(tabEvents.length)}
          </Text>
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
              <Text size={15} weight="medium" style={styles.secondary}>
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
                    title={TAB_WORDS[group.tab]}
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
          <Fade />
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
  onNew,
  onBell,
}: {
  summary: string | null;
  wide: boolean;
  bell: boolean;
  onNew: () => void;
  onBell: (words: string) => void;
}) {
  return (
    <View style={styles.top}>
      <View style={styles.titleRow}>
        <Text
          size={wide ? 34 : 30}
          weight="bold"
          accessibilityRole="header"
          style={[styles.grow, styles.title]}
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
        {bell && <Bell tell={onBell} />}
      </View>
      {summary != null && (
        <Text size={15} weight="medium" style={[styles.secondary, styles.figures]}>
          {summary}
        </Text>
      )}
    </View>
  );
}

function SearchField({
  typed,
  off,
  width,
  onTyped,
  onSearch,
  onClear,
  ref,
}: {
  typed: string;
  off: boolean;
  width: number | null;
  onTyped: (typed: string) => void;
  onSearch: () => void;
  onClear: () => void;
  ref: Ref<TextInputInstance>;
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
          placeholder={W.search}
          placeholderTextColor={off ? tokens.colorInkTertiary : tokens.colorInkSecondary}
          onChangeText={onTyped}
          onSubmitEditing={onSearch}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={W.search}
          style={styles.searchInput}
          testID="events.search"
        />
        {typed !== '' && (
          <Pressable
            onPress={onClear}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel={W.clearSearch}
            testID="events.search.clear"
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

/** B's segment: the lit tab white with a tick, each with its count. */
function Segment({
  tab,
  counts,
  onTab,
}: {
  tab: ListTab;
  counts: Record<ListTab, number>;
  onTab: (tab: ListTab) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {TABS.map((each) => {
        const on = each === tab;
        const ink = on ? tokens.colorAccentText : tokens.colorInkSecondary;

        return (
          <Pressable
            key={each}
            onPress={() => onTab(each)}
            style={[styles.cell, on && styles.cellOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${TAB_WORDS[each]}, ${counts[each]}`}
            testID={`events.tab.${each}`}
          >
            {on && <Glyph name="tick" size={14} ink={tokens.colorAccent} weight={2.8} />}
            <View style={styles.tabWords}>
              <Text
                size={14.5}
                weight={on ? 'semibold' : 'medium'}
                numberOfLines={1}
                accessible={false}
                style={{ color: ink }}
              >
                {TAB_WORDS[each]}
              </Text>
              <Text
                size={14.5}
                weight={on ? 'semibold' : 'medium'}
                accessible={false}
                style={[{ color: ink }, styles.count]}
              >
                {String(counts[each])}
              </Text>
            </View>
          </Pressable>
        );
      })}
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

function Said({ words }: { words: string }) {
  useReadOut(words);

  return (
    <Text size={14} weight="medium" style={styles.secondary}>
      {words}
    </Text>
  );
}

function OfflineBand({ onRetry }: { onRetry: () => void }) {
  useReadOut(say.offline(OFFLINE_AS_OF));

  return (
    <View style={styles.band} testID="events.offline">
      <View style={styles.diamond} />
      <Text size={14.5} weight="semibold" style={[styles.grow, styles.figures]}>
        {say.offline(OFFLINE_AS_OF)}
      </Text>
      <TextAction label={W.tryAgain} onPress={onRetry} testID="events.offline.retry" />
    </View>
  );
}

function StepTile({ n }: { n: number }) {
  return (
    <View
      style={styles.stepTile}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size={16} weight="bold" accessible={false} style={[styles.accent, styles.figures]}>
        {String(n)}
      </Text>
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
  top: { gap: tokens.spaceHair },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  title: { letterSpacing: -0.6 },
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
  segment: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    padding: 3,
    borderRadius: 22,
    backgroundColor: tokens.colorNeutralFill,
  },
  cell: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 19,
  },
  cellOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
  count: { opacity: 0.8, fontVariant: ['tabular-nums'] },
  tabWords: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spaceXxs, minWidth: 0 },
  cardFoot: { marginTop: 'auto' },
  results: { gap: tokens.spaceXs },
  countRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  groups: { gap: tokens.spaceMd },
  noMatch: { gap: tokens.spaceXs, paddingTop: tokens.spaceXxs },
  noMatchTitle: { letterSpacing: -0.18 },
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
  stepTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
});
