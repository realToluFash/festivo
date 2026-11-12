import {
  EVENT_TYPES,
  type EventsFilters,
  type EventsTab,
  type EventsWhen,
  NO_EVENTS_FILTERS,
  filtered,
  formatWallDay,
  listFormat,
  picksLead,
  picksShown,
  searching,
  whenSpan,
  withHostToggled,
  withTypeToggled,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type ReactNode, type Ref, type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';

import { endCuts, endCutWidth, unbroken } from '../layout/endCut.ts';
import { tokens } from '../theme/tokens.ts';
import { TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { MomentBox, type Picking, PickerLayer, pick } from './MomentPick.tsx';
import { RadioMark } from './RadioMark.tsx';
import { useReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type Anchor, AnchoredMenu, HeadCount, SectionHead, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';

type Level = 'top' | 'type' | 'when' | 'hosts';

const WHENS: readonly { kind: EventsWhen['kind']; word: string }[] = [
  { kind: 'any', word: 'eventsSearch.anyTime' },
  { kind: 'week', word: 'eventsSearch.thisWeek' },
  { kind: 'month', word: 'eventsSearch.thisMonth' },
  { kind: 'next3', word: 'eventsSearch.next3Months' },
  { kind: 'between', word: 'eventsSearch.between' },
];

const TAB_WORD: Record<EventsTab, string> = {
  upcoming: 'eventsScreen.tabUpcoming',
  drafts: 'eventsScreen.tabDrafts',
  past: 'eventsScreen.tabPast',
};

/** Where today is and the week starts, which This week, This month and Next 3 months are counted from. */
export interface Calendar {
  today: string;
  firstDay: number;
  locale: string;
}

function whenWords(when: EventsWhen, locale: string, t: TFunction): string {
  switch (when.kind) {
    case 'any':
      return t('eventsSearch.anyTime');
    case 'week':
      return t('eventsSearch.thisWeek');
    case 'month':
      return t('eventsSearch.thisMonth');
    case 'next3':
      return t('eventsSearch.next3Months');
    case 'between': {
      const day = (value: string) => formatWallDay(value, locale);

      return when.from !== '' && when.to !== ''
        ? t('eventsScreen.days', { first: day(when.from), last: day(when.to) })
        : day(when.from || when.to);
    }
  }
}

function listed(words: readonly string[], locale: string): string {
  return listFormat(locale, { type: 'unit', style: 'short' }).format(words);
}

function chosenWords(filters: EventsFilters, locale: string, t: TFunction): string[] {
  return [
    ...filters.types.map((type) => t(`eventTypes.${type}`)),
    ...(filters.when.kind === 'any' ? [] : [whenWords(filters.when, locale, t)]),
    ...filters.hosts,
  ];
}

/** What Filter names: each pick, and the whole list a screen reader hears, or All. */
export interface FilterWords {
  picks: readonly string[];
  word: string;
}

export function useFilterWords(filters: EventsFilters, locale: string): FilterWords {
  const { t } = useTranslation();
  const picks = chosenWords(filters, locale, t);

  return { picks, word: picks.length === 0 ? t('eventsSearch.all') : listed(picks, locale) };
}

/** Each way a line of picks can read, measured hidden, and how many show whole in a room (sc-39348). */
function usePicksFit(
  picks: readonly string[],
  whole: string,
  look: { size: number; weight: 'semibold' | 'medium' },
) {
  const { t } = useTranslation();
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const more = (count: number) => t('calendar.moreItems', { count });
  const tail = (shown: number) => ` ${more(picks.length - shown)}`;
  // Measured as the two texts a cut line is drawn as: the line measured as one string comes out narrower on Android.
  const parts = (shown: number) =>
    shown === picks.length ? [whole] : [picksLead(picks, shown), tail(shown)];
  const reads = picks.length === 0 ? [whole] : picks.flatMap((_, index) => parts(index + 1));
  const measured = reads.every((text) => widths[`${look.weight}|${text}`] != null);
  const widthOf = (text: string) => widths[`${look.weight}|${text}`] ?? 0;
  const widthAt = (shown: number) =>
    parts(shown).reduce((sum, text) => sum + Math.ceil(widthOf(text)), 0);

  return {
    measurer: (
      <MeasuredWords
        words={reads}
        size={look.size}
        weight={look.weight}
        onWidth={(text, width) => {
          const key = `${look.weight}|${text}`;
          setWidths((now) => (now[key] === width ? now : { ...now, [key]: width }));
        }}
      />
    ),
    whole: measured ? widthOf(whole) : null,
    shownIn: (room: number | null) =>
      room == null || !measured
        ? picks.length
        : picksShown(picks.length, (shown) => widthAt(shown) <= room),
    more,
  };
}

/** The first `shown` picks whole, then "+N more"; only the first is ever cut. */
function PicksLine({
  picks,
  whole,
  shown,
  room,
  more,
  size,
  weight,
  ink,
}: {
  picks: readonly string[];
  whole: string;
  shown: number;
  room: number | null;
  more: (count: number) => string;
  size: number;
  weight: 'semibold' | 'medium';
  ink: string;
}) {
  const rest = picks.length - shown;
  const snugs = Platform.OS === 'android' && rest > 0;
  // Android cuts a line that can break at a space or hyphen there, short of the longest cut the box is sized to (sc-41871).
  const plain = picksLead(picks, shown);
  const lead = rest === 0 ? whole : snugs ? unbroken(plain) : plain;
  const { fontScale } = useWindowDimensions();
  const drawn = `${room}|${fontScale}|${lead}|${more(rest)}`;
  const [box, setBox] = useState<{ drawn: string; width: number } | null>(null);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const boxWidth = snugs && box?.drawn === drawn ? box.width : null;
  const widthOf = (text: string) => widths[`${fontScale}|${text}`];
  const overflows = boxWidth != null && (widthOf(lead) ?? 0) > boxWidth;
  // Android stops a cut line's "…" short of the box it was laid out in, so the box narrows to the longest cut that fits it (sc-41871).
  const cutWidth = boxWidth == null ? null : endCutWidth(lead, boxWidth, widthOf);
  const snugWidth = cutWidth == null ? null : Math.ceil(cutWidth);

  return (
    <View style={styles.picks}>
      <Text
        size={size}
        weight={weight}
        numberOfLines={1}
        accessible={false}
        style={[styles.shrink, { color: ink }, snugWidth != null && { width: snugWidth }]}
        onLayout={
          snugs && snugWidth == null
            ? (event) => {
                const width = event.nativeEvent.layout.width;
                setBox((now) =>
                  now?.drawn === drawn && now.width === width ? now : { drawn, width },
                );
              }
            : undefined
        }
      >
        {lead}
      </Text>
      {rest > 0 && (
        <Text
          size={size}
          weight={weight}
          numberOfLines={1}
          accessible={false}
          style={[styles.kept, { color: ink }]}
        >
          {` ${more(rest)}`}
        </Text>
      )}
      {snugs && (
        <MeasuredWords
          words={overflows ? [lead, ...endCuts(lead)] : [lead]}
          size={size}
          weight={weight}
          onWidth={(text, width) => {
            const key = `${fontScale}|${text}`;
            setWidths((now) => (now[key] === width ? now : { ...now, [key]: width }));
          }}
        />
      )}
    </View>
  );
}

/** The search field: the search mark, the words, and once typed a 44 clear button; Return searches. */
export function SearchField({
  typed,
  off,
  width,
  onTyped,
  onSearch,
  onClear,
  label,
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
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const named = label ?? t('eventsSearch.label');

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
          placeholder={named}
          placeholderTextColor={off ? tokens.colorInkTertiary : tokens.colorInkSecondary}
          onChangeText={onTyped}
          onSubmitEditing={onSearch}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={named}
          style={styles.searchInput}
          testID={testID}
        />
        {typed !== '' && (
          <Pressable
            onPress={onClear}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel={t('eventsSearch.clearSearch')}
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

const FILTER_MARK = 18;
const FILTER_CHEVRON = 16;
const FILTER_SPACE = tokens.spaceXs;
/** Filter's marks and padding around its picks: the padding at both ends, a gap either side of the picks, and the two marks. */
const FILTER_SIDES = 4 * FILTER_SPACE + FILTER_MARK + FILTER_CHEVRON;

/** Filter beside the search: its mark, what is chosen, and a chevron, in Violet. On a phone (`wraps`) it moves under the field when its picks do not fit beside it, and fits them to the full width there. */
export function FilterButton({
  picks,
  word,
  wraps,
  off,
  open,
  onPress,
  ref,
}: FilterWords & {
  wraps: boolean;
  off: boolean;
  open: boolean;
  onPress: () => void;
  ref: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const ink = off ? tokens.colorInkTertiary : tokens.colorAccentText;
  const fit = usePicksFit(picks, word, { size: 15, weight: 'semibold' });
  const [slot, setSlot] = useState<number | null>(null);

  return (
    <View
      style={wraps ? styles.filterWraps : styles.filterBeside}
      onLayout={(event) => setSlot(event.nativeEvent.layout.width)}
    >
      {fit.measurer}
      {/* As wide as every pick, so the row moves Filter under the field exactly when they do not fit beside it. */}
      {wraps && fit.whole != null && (
        <View style={[styles.strut, { width: fit.whole + FILTER_SIDES }]} />
      )}
      <Pressable
        ref={ref}
        onPress={off ? undefined : onPress}
        disabled={off}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ disabled: off, expanded: open }}
        accessibilityLabel={t('eventsSearch.filterLabel', { what: word })}
        testID="events.filter"
      >
        <Glyph name="filter" size={FILTER_MARK} ink={ink} weight={2.2} />
        <PicksLine
          picks={picks}
          whole={word}
          shown={fit.shownIn(slot == null ? null : slot - FILTER_SIDES)}
          room={slot}
          more={fit.more}
          size={15}
          weight="semibold"
          ink={ink}
        />
        <Glyph name="down" size={FILTER_CHEVRON} ink={ink} weight={2.4} />
      </Pressable>
    </View>
  );
}

/** The Filter menu, 272 wide: Type, When and Hosted by, each drilling in to its choices. */
export function EventsFilterMenu({
  at,
  onClose,
  opener,
  filters,
  onFilters,
  hosts,
  calendar,
}: {
  at: Anchor | null;
  onClose: () => void;
  opener: RefObject<ScreenReaderTarget | null>;
  filters: EventsFilters;
  onFilters: (filters: EventsFilters) => void;
  hosts: readonly string[];
  calendar: Calendar;
}) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<Level>('top');
  const [picking, setPicking] = useState<Picking | null>(null);
  const { locale } = calendar;
  const types = filters.types.map((type) => t(`eventTypes.${type}`));
  const whenNamed = whenWords(filters.when, locale, t);
  const offered = [...hosts, ...filters.hosts.filter((host) => !hosts.includes(host))];
  const close = () => {
    setLevel('top');
    onClose();
  };
  const between = filters.when.kind === 'between' ? filters.when : null;
  const pickDay = (end: 'from' | 'to') => {
    if (between == null) return;
    pick(
      {
        title: t(end === 'from' ? 'eventsSearch.from' : 'eventsSearch.to'),
        mode: 'date',
        field: { date: between[end] || calendar.today, time: '12:00' },
        take: ({ date }) => onFilters({ ...filters, when: { ...between, [end]: date } }),
      },
      setPicking,
    );
  };
  const opened = (kind: EventsWhen['kind']): EventsWhen =>
    kind === 'between'
      ? {
          kind,
          ...(whenSpan(filters.when, calendar.today, calendar.firstDay) ?? {
            from: calendar.today,
            to: calendar.today,
          }),
        }
      : { kind };

  return (
    <AnchoredMenu
      at={at}
      onClose={close}
      opener={opener}
      width={272}
      align="start"
      over={
        picking != null && (
          <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
        )
      }
      testID="events.filter.menu"
    >
      {level === 'top' && (
        <>
          <TopRow
            title={t('eventsSearch.type')}
            picks={types}
            value={types.length === 0 ? t('eventsSearch.anyType') : listed(types, locale)}
            onPress={() => setLevel('type')}
            testID="events.filter.type"
          />
          <TopRow
            title={t('eventsSearch.when')}
            picks={[whenNamed]}
            value={whenNamed}
            onPress={() => setLevel('when')}
            testID="events.filter.when"
          />
          <TopRow
            title={t('eventsSearch.hostedBy')}
            picks={filters.hosts}
            value={
              filters.hosts.length === 0 ? t('eventsSearch.anyone') : listed(filters.hosts, locale)
            }
            onPress={() => setLevel('hosts')}
            testID="events.filter.hosts"
          />
          {filtered(filters) && (
            <>
              <View style={styles.rule} />
              <Pressable
                onPress={() => onFilters(NO_EVENTS_FILTERS)}
                style={({ pressed }) => [styles.top, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('eventsSearch.clearFilters')}
                testID="events.filter.clear"
              >
                <Text size={16} weight="medium" accessible={false} style={styles.on}>
                  {t('eventsSearch.clearFilters')}
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
      {level === 'type' && (
        <Drilled title={t('eventsSearch.type')} onBack={() => setLevel('top')}>
          {EVENT_TYPES.map((type) => (
            <Check
              key={type}
              word={t(`eventTypes.${type}`)}
              on={filters.types.includes(type)}
              onPress={() => onFilters(withTypeToggled(filters, type))}
              testID={`events.filter.type.${type}`}
            />
          ))}
        </Drilled>
      )}
      {level === 'when' && (
        <Drilled title={t('eventsSearch.when')} onBack={() => setLevel('top')}>
          {WHENS.map(({ kind, word }) => (
            <Radio
              key={kind}
              word={t(word)}
              on={filters.when.kind === kind}
              onPress={() => onFilters({ ...filters, when: opened(kind) })}
              testID={`events.filter.when.${kind}`}
            />
          ))}
          {between != null && (
            <View style={styles.between}>
              {(['from', 'to'] as const).map((end) => (
                <View key={end} style={styles.day}>
                  <Text size={13} weight="semibold">
                    {t(end === 'from' ? 'eventsSearch.from' : 'eventsSearch.to')}
                  </Text>
                  <MomentBox
                    label={t(end === 'from' ? 'eventsSearch.from' : 'eventsSearch.to')}
                    mode="date"
                    value={between[end]}
                    locale={locale}
                    year={false}
                    height={tokens.sizeHit}
                    onPress={() => pickDay(end)}
                    testID={`events.filter.${end}`}
                  />
                </View>
              ))}
            </View>
          )}
        </Drilled>
      )}
      {level === 'hosts' && (
        <Drilled title={t('eventsSearch.hostedBy')} onBack={() => setLevel('top')}>
          {offered.map((host) => (
            <Check
              key={host}
              word={host}
              on={filters.hosts.includes(host)}
              onPress={() => onFilters(withHostToggled(filters, host, offered))}
              testID={`events.filter.host.${host}`}
            />
          ))}
        </Drilled>
      )}
    </AnchoredMenu>
  );
}

/** A menu row: its title, then its picks fitted between the title and the chevron. */
function TopRow({
  title,
  picks,
  value,
  onPress,
  testID,
}: {
  title: string;
  picks: readonly string[];
  value: string;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const fit = usePicksFit(picks, value, { size: 15, weight: 'medium' });
  const [room, setRoom] = useState<number | null>(null);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.top, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={t('eventsSearch.choice', { title, value })}
      testID={testID}
    >
      <Text size={16} weight="medium" accessible={false} style={styles.title}>
        {title}
      </Text>
      <View style={styles.value} onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
        {fit.measurer}
        <PicksLine
          picks={picks}
          whole={value}
          shown={fit.shownIn(room)}
          room={room}
          more={fit.more}
          size={15}
          weight="medium"
          ink={tokens.colorInkSecondary}
        />
      </View>
      <Glyph name="chevron" size={16} ink={tokens.colorInkTertiary} weight={2.3} />
    </Pressable>
  );
}

function Drilled({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('eventsSearch.backFrom', { title })}
        testID="events.filter.back"
      >
        <Glyph name="back" size={18} ink={tokens.colorAccentText} weight={2.4} />
        <Text size={16} weight="bold" accessible={false} accessibilityRole="header">
          {title}
        </Text>
      </Pressable>
      <View style={styles.rule} />
      {children}
    </>
  );
}

function Check({
  word,
  on,
  onPress,
  testID,
}: {
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.rowPressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>
        {on && <Glyph name="tick" size={14} ink={tokens.colorInkOnDark} weight={3} />}
      </View>
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.grow, on && styles.on]}
      >
        {word}
      </Text>
    </Pressable>
  );
}

function Radio({
  word,
  on,
  onPress,
  testID,
}: {
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.rowPressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      <RadioMark on={on} />
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.grow, on && styles.on]}
      >
        {word}
      </Text>
    </Pressable>
  );
}

/** The field and Filter in one row, Filter wrapping under the field when its words do not fit; offline, both off with the line under them. */
export function SearchRow({
  field,
  filter,
  offline,
}: {
  field: ReactNode;
  filter: ReactNode;
  offline: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.searchBlock}>
      <View style={styles.searchRow}>
        {field}
        {filter}
      </View>
      {offline && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
          {t('eventsSearch.searchOff')}
        </Text>
      )}
    </View>
  );
}

export interface ResultsGroup {
  tab: EventsTab;
  count: number;
  rows: ReactNode;
}

/** One set of results: the count, read out as it changes, with Clear filters; then each group with its count, or what found nothing. */
export function EventsResults({
  typed,
  filters,
  groups,
  locale,
  onClearSearch,
  onClearFilters,
}: {
  typed: string;
  filters: EventsFilters;
  groups: readonly ResultsGroup[];
  locale: string;
  onClearSearch: () => void;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation();
  const count = groups.reduce((total, group) => total + group.count, 0);
  const words = t('eventsSearch.count', { count });
  const q = typed.trim();
  const chosen = listFormat(locale, { type: 'conjunction' }).format(
    chosenWords(filters, locale, t),
  );
  const noMatch =
    searching(q) && filtered(filters)
      ? t('eventsSearch.searchedAndFiltered', { q, filters: chosen })
      : searching(q)
        ? t('eventsSearch.searched', { q })
        : t('eventsSearch.filtered', { filters: chosen });

  useReadOut(words);

  return (
    <View style={styles.results}>
      <View style={styles.countRow}>
        <Text
          size={16}
          weight="semibold"
          style={[styles.grow, styles.figures]}
          testID="events.count"
        >
          {words}
        </Text>
        {filtered(filters) && count > 0 && (
          <TextAction
            label={t('eventsSearch.clearFilters')}
            onPress={onClearFilters}
            testID="events.clearFilters"
          />
        )}
      </View>
      {count === 0 ? (
        <View style={styles.noMatch} testID="events.noMatch">
          <Text size={18} weight="bold" accessibilityRole="header" style={styles.noMatchTitle}>
            {t('eventsSearch.noMatch')}
          </Text>
          <Text size={15} weight="medium" style={[styles.secondary, styles.noMatchLine]}>
            {noMatch}
          </Text>
          <View style={styles.noMatchActions}>
            {searching(q) && (
              <TextAction
                label={t('eventsSearch.clearSearch')}
                onPress={onClearSearch}
                testID="events.noMatch.clearSearch"
              />
            )}
            {filtered(filters) && (
              <TextAction
                label={t('eventsSearch.clearFilters')}
                onPress={onClearFilters}
                testID="events.noMatch.clearFilters"
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.groups}>
          {groups.map(
            (group) =>
              group.count > 0 && (
                <View key={group.tab}>
                  <SectionHead
                    title={t(TAB_WORD[group.tab])}
                    right={<HeadCount text={String(group.count)} />}
                  />
                  {group.rows}
                </View>
              ),
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  kept: { flexShrink: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  said: { lineHeight: 14 * 1.45 },
  pressed: { opacity: tokens.opacityPressed },
  rowPressed: { backgroundColor: tokens.colorInset },
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
  button: {
    minHeight: tokens.sizeHitPhonePrimary,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: FILTER_SPACE,
    paddingHorizontal: FILTER_SPACE,
  },
  top: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
  on: { color: tokens.colorAccentText },
  title: { flexShrink: 0 },
  value: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  picks: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  filterWraps: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
  filterBeside: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  strut: { height: 0 },
  rule: { height: 1, marginVertical: tokens.spaceXs, backgroundColor: tokens.colorBorder },
  back: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
  },
  choice: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
  box: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: tokens.colorAccent },
  boxOff: { borderWidth: 2, borderColor: tokens.colorFieldBorder },
  between: {
    flexDirection: 'row',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spacePillEnd,
    paddingTop: tokens.spaceXxs,
    paddingBottom: tokens.spaceMd,
  },
  day: { flex: 1, gap: 5 },
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
});
