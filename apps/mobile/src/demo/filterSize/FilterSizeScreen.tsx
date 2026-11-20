import {
  EVENT_TYPES,
  type EventType,
  type EventsFilters,
  type EventsWhen,
  NO_EVENTS_FILTERS,
  filtered,
  listFormat,
  picksLead,
  withHostToggled,
  withTypeToggled,
} from '@soirely/domain';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterButton, useFilterWords } from '../../components/EventsSearch.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { type Anchor, AnchoredMenu, anchorUnder } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { isTablet } from '../../layout/classify.ts';
import { piecesIn } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { LONG_HOST } from '../events/EventsModel.ts';
import {
  FILTER_LANGUAGES,
  FILTER_PICKS,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterPicks,
  type FilterSize,
  filterScale,
  keptWhole,
  rowDrawn,
  rowStarts,
} from './filterSizeRules.ts';
import { frameTitleCap } from '../frameTitleCap.ts';

export interface FilterSizeStart {
  size: FilterSize;
  language: FilterLanguage;
  picks: FilterPicks;
}

const HOSTS = ['Adaeze Obi', 'Ire Events', 'Kemi Adebayo', LONG_HOST] as const;
const MENU_AFTER_MS = 600;
const WHENS: readonly { kind: Exclude<EventsWhen['kind'], 'between'>; word: string }[] = [
  { kind: 'any', word: 'eventsSearch.anyTime' },
  { kind: 'week', word: 'eventsSearch.thisWeek' },
  { kind: 'month', word: 'eventsSearch.thisMonth' },
  { kind: 'next3', word: 'eventsSearch.next3Months' },
];

function filtersOf(picks: FilterPicks): EventsFilters {
  if (picks === 'twoTypes') return { ...NO_EVENTS_FILTERS, types: ['anniversary', 'party'] };
  if (picks === 'longHost') return { ...NO_EVENTS_FILTERS, hosts: [LONG_HOST] };

  return NO_EVENTS_FILTERS;
}

/** sc-73933: Events' Filter menu at a stand-in text size, its top-level values whole under their titles at the accessibility sizes. */
export function FilterSizeScreen({ start }: { start: FilterSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const layout = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [filters, setFilters] = useState(() => filtersOf(start.picks));
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const filterRef = useRef<ViewInstance>(null);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const cap = frameTitleCap(isTablet(layout.kind), Math.min(layout.width, layout.height), scale);

  useEffect(() => {
    const wait = setTimeout(() => anchorUnder(filterRef, setMenuAt), MENU_AFTER_MS);

    return () => clearTimeout(wait);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <NavBar />
        <I18nextProvider i18n={words}>
          <View style={styles.page}>
            <Opener
              filters={filters}
              locale={language}
              open={menuAt != null}
              onPress={() => anchorUnder(filterRef, setMenuAt)}
              ref={filterRef}
            />
            <Menu
              at={menuAt}
              onClose={() => setMenuAt(null)}
              opener={filterRef}
              filters={filters}
              onFilters={setFilters}
              scale={scale}
              cap={cap}
              locale={language}
            />
          </View>
        </I18nextProvider>
        <View style={styles.page}>
          <DemoOnly title="Stand-ins for the device’s text size, its language and what qa has chosen. Only the menu’s top-level rows draw at the size chosen; Filter and the drilled levels stay as main draws them at this device’s size. At AX1 to AX5 a row whose value cannot sit whole beside its title puts it on the line under, at the title’s start, with the › kept at the end. At the standard sizes every row is main’s one line. Tap Filter to open the menu again. Nothing is sent and no string is added.">
            <Choices
              heading="Text size"
              options={FILTER_SIZES}
              chosen={size}
              onChoose={setSize}
              id="size"
              prefix="demo.filterSize"
            />
            <Choices
              heading="Language"
              options={FILTER_LANGUAGES}
              chosen={language}
              onChoose={setLanguage}
              id="language"
              prefix="demo.filterSize"
            />
            <Choices
              heading="Chosen"
              options={FILTER_PICKS}
              chosen={
                FILTER_PICKS.find(({ key }) => sameFilters(filtersOf(key), filters))?.key ?? 'none'
              }
              onChoose={(key) => setFilters(filtersOf(key))}
              id="picks"
              prefix="demo.filterSize"
            />
          </DemoOnly>
        </View>
      </ScrollView>
    </View>
  );
}

function sameFilters(one: EventsFilters, other: EventsFilters): boolean {
  return JSON.stringify(one) === JSON.stringify(other);
}

function Opener({
  filters,
  locale,
  open,
  onPress,
  ref,
}: {
  filters: EventsFilters;
  locale: string;
  open: boolean;
  onPress: () => void;
  ref: Ref<ViewInstance>;
}) {
  const filterWords = useFilterWords(filters, locale);

  return (
    <FilterButton ref={ref} {...filterWords} wraps off={false} open={open} onPress={onPress} />
  );
}

type Level = 'top' | 'type' | 'when' | 'hosts';

function Menu({
  at,
  onClose,
  opener,
  filters,
  onFilters,
  scale,
  cap,
  locale,
}: {
  at: Anchor | null;
  onClose: () => void;
  opener: RefObject<ViewInstance | null>;
  filters: EventsFilters;
  onFilters: (filters: EventsFilters) => void;
  scale: number;
  cap: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<Level>('top');
  const first = useRef<ViewInstance>(null);
  const listed = (picks: readonly string[]) =>
    listFormat(locale, { type: 'unit', style: 'short' }).format(picks);
  const types = filters.types.map((type) => t(`eventTypes.${type}`));
  const whenWord = t(
    WHENS.find(({ kind }) => kind === filters.when.kind)?.word ?? 'eventsSearch.anyTime',
  );
  const close = () => {
    setLevel('top');
    onClose();
  };

  return (
    <AnchoredMenu
      at={at}
      onClose={close}
      opener={opener}
      first={first}
      width={272}
      align="start"
      testID="demo.filterSize.menu"
    >
      {level === 'top' && (
        <>
          <TopRow
            ref={first}
            title={t('eventsSearch.type')}
            picks={types}
            value={types.length === 0 ? t('eventsSearch.anyType') : listed(types)}
            scale={scale}
            cap={cap}
            onPress={() => setLevel('type')}
            testID="demo.filterSize.type"
          />
          <TopRow
            title={t('eventsSearch.when')}
            picks={[whenWord]}
            value={whenWord}
            scale={scale}
            cap={cap}
            onPress={() => setLevel('when')}
            testID="demo.filterSize.when"
          />
          <TopRow
            title={t('eventsSearch.hostedBy')}
            picks={filters.hosts}
            value={filters.hosts.length === 0 ? t('eventsSearch.anyone') : listed(filters.hosts)}
            scale={scale}
            cap={cap}
            onPress={() => setLevel('hosts')}
            testID="demo.filterSize.hosts"
          />
          {filtered(filters) && (
            <>
              <View style={styles.rule} />
              <Pressable
                onPress={() => onFilters(NO_EVENTS_FILTERS)}
                style={({ pressed }) => [styles.top, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('eventsSearch.clearFilters')}
                testID="demo.filterSize.clear"
              >
                <Text
                  size={rowStarts(scale, cap).title}
                  weight="medium"
                  allowFontScaling={false}
                  accessible={false}
                  style={styles.on}
                >
                  {t('eventsSearch.clearFilters')}
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
      {level === 'type' && (
        <Drilled title={t('eventsSearch.type')} onBack={() => setLevel('top')}>
          {EVENT_TYPES.map((type: EventType) => (
            <Choice
              key={type}
              word={t(`eventTypes.${type}`)}
              on={filters.types.includes(type)}
              onPress={() => onFilters(withTypeToggled(filters, type))}
            />
          ))}
        </Drilled>
      )}
      {level === 'when' && (
        <Drilled title={t('eventsSearch.when')} onBack={() => setLevel('top')}>
          {WHENS.map(({ kind, word }) => (
            <Choice
              key={kind}
              word={t(word)}
              on={filters.when.kind === kind}
              onPress={() => onFilters({ ...filters, when: { kind } })}
            />
          ))}
        </Drilled>
      )}
      {level === 'hosts' && (
        <Drilled title={t('eventsSearch.hostedBy')} onBack={() => setLevel('top')}>
          {HOSTS.map((host) => (
            <Choice
              key={host}
              word={host}
              on={filters.hosts.includes(host)}
              onPress={() => onFilters(withHostToggled(filters, host, HOSTS))}
            />
          ))}
        </Drilled>
      )}
    </AnchoredMenu>
  );
}

/** A top-level row: beside its title while its value fits whole, under it at the accessibility sizes when not. */
function TopRow({
  ref,
  title,
  picks,
  value,
  scale,
  cap,
  onPress,
  testID,
}: {
  ref?: Ref<ViewInstance>;
  title: string;
  picks: readonly string[];
  value: string;
  scale: number;
  cap: number;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const shownPicks = picks.length === 0 ? [value] : picks;
  const count = shownPicks.length;
  const tail = (rest: number) => keptWhole(t('calendar.moreItems', { count: rest }));
  const read = (shown: number) =>
    shown === count ? value : `${picksLead(shownPicks, shown)} ${tail(count - shown)}`;
  // Beside its title the line draws as two texts, so it is measured as two: as one string it comes out narrower on Android (main's usePicksFit).
  const parts = (shown: number) =>
    shown === count ? [value] : [picksLead(shownPicks, shown), ` ${tail(count - shown)}`];
  const reads = shownPicks.map((_, index) => read(index + 1));
  const besides = shownPicks.flatMap((_, index) => parts(index + 1));
  const tails = shownPicks.slice(1).map((_, index) => tail(index + 1));
  const valuePieces = [...piecesIn(shownPicks), ...tails];
  const starts = rowStarts(scale, cap);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const [room, setRoom] = useState(0);
  const titleKey = (text: string) => `t|${starts.title}|${text}`;
  const valueKey = (text: string) => `v|${starts.value}|${text}`;
  const titlePieces = piecesIn([title]);
  const keys = [
    titleKey(title),
    ...titlePieces.map(titleKey),
    ...reads.map(valueKey),
    ...besides.map(valueKey),
    ...valuePieces.map(valueKey),
  ];
  const ready = room > 0 && keys.every((key) => widths[key] != null);
  const widthOf = (key: string) => widths[key] ?? 0;
  const widestOf = (texts: readonly string[], key: (text: string) => string) =>
    Math.max(...texts.map((text) => widthOf(key(text))));
  const drawn = ready
    ? rowDrawn({
        scale,
        cap,
        room,
        gap: tokens.spaceMd,
        title: widthOf(titleKey(title)),
        titleWidest: widestOf(titlePieces, titleKey),
        valueWidestAt: (shown) =>
          widestOf(
            [
              ...piecesIn(shownPicks.slice(0, shown)),
              ...(shown < count ? [tail(count - shown)] : []),
            ],
            valueKey,
          ),
        count,
        besideAt: (shown) =>
          parts(shown).reduce((sum, text) => sum + Math.ceil(widthOf(valueKey(text))), 0),
        underAt: (shown) => widthOf(valueKey(read(shown))),
      })
    : null;
  const shown = drawn?.shown ?? count;
  const rest = count - shown;
  const lead = rest === 0 ? value : picksLead(shownPicks, shown);
  const measured = (key: (text: string) => string) => (text: string, width: number) =>
    setWidths((now) => (now[key(text)] === width ? now : { ...now, [key(text)]: width }));

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.top,
        drawn?.stacked === true && styles.topStacked,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('eventsSearch.choice', { title, value })}
      testID={testID}
    >
      <MeasuredWords
        words={[title, ...titlePieces]}
        size={starts.title}
        weight="medium"
        allowFontScaling={false}
        onWidth={measured(titleKey)}
      />
      <MeasuredWords
        words={[...new Set([...reads, ...besides, ...valuePieces])]}
        size={starts.value}
        weight="medium"
        allowFontScaling={false}
        onWidth={measured(valueKey)}
      />
      <View
        style={[drawn?.stacked === true ? styles.stacked : styles.beside, !ready && styles.waiting]}
        onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      >
        {drawn?.stacked === true ? (
          <>
            <Text
              size={drawn.titleSize}
              weight="medium"
              allowFontScaling={false}
              accessible={false}
            >
              {title}
            </Text>
            <Text
              size={drawn.valueSize}
              weight="medium"
              allowFontScaling={false}
              accessible={false}
              style={styles.secondary}
            >
              {rest === 0 ? value : `${lead} ${tail(rest)}`}
            </Text>
          </>
        ) : (
          <>
            <Text
              size={starts.title}
              weight="medium"
              allowFontScaling={false}
              numberOfLines={1}
              accessible={false}
              style={styles.title}
            >
              {title}
            </Text>
            <View style={styles.value}>
              <Text
                size={starts.value}
                weight="medium"
                allowFontScaling={false}
                numberOfLines={1}
                accessible={false}
                style={[styles.shrink, styles.secondary]}
              >
                {lead}
              </Text>
              {rest > 0 && (
                <Text
                  size={starts.value}
                  weight="medium"
                  allowFontScaling={false}
                  numberOfLines={1}
                  accessible={false}
                  style={[styles.kept, styles.secondary]}
                >
                  {` ${tail(rest)}`}
                </Text>
              )}
            </View>
          </>
        )}
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
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('eventsSearch.backFrom', { title })}
      >
        <Glyph name="back" size={16} ink={tokens.colorAccentText} weight={2.3} />
        <Text size={16} weight="semibold">
          {title}
        </Text>
      </Pressable>
      <View style={styles.rule} />
      {children}
    </>
  );
}

function Choice({ word, on, onPress }: { word: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Text size={16} weight="medium" style={styles.shrink}>
        {word}
      </Text>
      {on && <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.5} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceLg, gap: tokens.spaceLg },
  top: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
  topStacked: { paddingVertical: tokens.spaceSm },
  pressed: { backgroundColor: tokens.colorInset },
  beside: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  stacked: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  waiting: { opacity: 0 },
  title: { flexShrink: 0 },
  value: { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-end' },
  shrink: { flexShrink: 1 },
  kept: { flexShrink: 0 },
  secondary: { color: tokens.colorInkSecondary },
  on: { color: tokens.colorAccentText },
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
    justifyContent: 'space-between',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
  },
});
