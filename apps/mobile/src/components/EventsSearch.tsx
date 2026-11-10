import {
  EVENT_TYPES,
  type EventsFilters,
  type EventsTab,
  type EventsWhen,
  NO_EVENTS_FILTERS,
  filtered,
  formatWallDay,
  listFormat,
  searching,
  whenSpan,
  withHostToggled,
  withTypeToggled,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type ReactNode, type Ref, type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { MomentBox, type Picking, PickerLayer, pick } from './MomentPick.tsx';
import { RadioMark } from './RadioMark.tsx';
import { useReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { type Anchor, AnchoredMenu, HeadCount, SectionHead, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

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

/** What Filter reads: All, or what is chosen. */
export function useFilterWord(filters: EventsFilters, locale: string): string {
  const { t } = useTranslation();
  const chosen = chosenWords(filters, locale, t);

  return chosen.length === 0 ? t('eventsSearch.all') : listed(chosen, locale);
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

/** Filter beside the search: its mark, what is chosen, and a chevron, in Violet. */
export function FilterButton({
  word,
  off,
  open,
  onPress,
  ref,
}: {
  word: string;
  off: boolean;
  open: boolean;
  onPress: () => void;
  ref: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const ink = off ? tokens.colorInkTertiary : tokens.colorAccentText;

  return (
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
      <Glyph name="filter" size={18} ink={ink} weight={2.2} />
      <Text
        size={15}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={[styles.shrink, { color: ink }]}
      >
        {word}
      </Text>
      <Glyph name="down" size={16} ink={ink} weight={2.4} />
    </Pressable>
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
            value={
              filters.types.length === 0
                ? t('eventsSearch.anyType')
                : listed(
                    filters.types.map((type) => t(`eventTypes.${type}`)),
                    locale,
                  )
            }
            onPress={() => setLevel('type')}
            testID="events.filter.type"
          />
          <TopRow
            title={t('eventsSearch.when')}
            value={whenWords(filters.when, locale, t)}
            onPress={() => setLevel('when')}
            testID="events.filter.when"
          />
          <TopRow
            title={t('eventsSearch.hostedBy')}
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

function TopRow({
  title,
  value,
  onPress,
  testID,
}: {
  title: string;
  value: string;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.top, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={t('eventsSearch.choice', { title, value })}
      testID={testID}
    >
      <Text size={16} weight="medium" accessible={false} style={styles.grow}>
        {title}
      </Text>
      <Text
        size={15}
        weight="medium"
        numberOfLines={1}
        accessible={false}
        style={[styles.secondary, styles.value]}
      >
        {value}
      </Text>
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
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceXs,
  },
  top: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
  on: { color: tokens.colorAccentText },
  value: { maxWidth: 120 },
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
