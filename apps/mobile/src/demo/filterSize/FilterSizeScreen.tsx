import {
  EVENT_TYPES,
  type EventType,
  type EventsFilters,
  type EventsWhen,
  NO_EVENTS_FILTERS,
  filtered,
  formatWallDay,
  listFormat,
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
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterButton, GrownTopRow, useFilterWords } from '../../components/EventsSearch.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { type Picking, PickerLayer, pick } from '../../components/MomentPick.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { type Anchor, AnchoredMenu, anchorUnder } from '../../components/Summary.tsx';
import { openOnceSettled } from '../menuSettles.ts';
import { Text } from '../../components/Text.tsx';
import { isTablet } from '../../layout/classify.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { LONG_HOST } from '../events/EventsModel.ts';
import {
  FILTER_LANGUAGES,
  FILTER_LEVELS,
  FILTER_PICKS,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterLevel,
  type FilterPicks,
  type FilterSize,
  datesStacked,
  drilledSize,
  drilledStart,
  filterScale,
} from './filterSizeRules.ts';
import { rowStarts } from '../../layout/menuRowFit.ts';
import { piecesIn, wholeLineHeight } from '../../layout/textSize.ts';
import { frameTitleCap } from '../frameTitleCap.ts';

export interface FilterSizeStart {
  size: FilterSize;
  language: FilterLanguage;
  picks: FilterPicks;
  level: FilterLevel;
}

// The hosts sc-75213's AC names.
const HOSTS = ['Adaeze Obi', 'Tunde Bakare', LONG_HOST, 'Chidi Okafor'] as const;
const MENU_AFTER_MS = 600;
const SPAN = { from: '2026-11-20', to: '2026-12-04' } as const;
const WHENS: readonly { kind: EventsWhen['kind']; word: string }[] = [
  { kind: 'any', word: 'eventsSearch.anyTime' },
  { kind: 'week', word: 'eventsSearch.thisWeek' },
  { kind: 'month', word: 'eventsSearch.thisMonth' },
  { kind: 'next3', word: 'eventsSearch.next3Months' },
  { kind: 'between', word: 'eventsSearch.between' },
];

function whenOf(kind: EventsWhen['kind']): EventsWhen {
  return kind === 'between' ? { kind, ...SPAN } : { kind };
}

function filtersOf(picks: FilterPicks): EventsFilters {
  if (picks === 'twoTypes') return { ...NO_EVENTS_FILTERS, types: ['anniversary', 'party'] };
  if (picks === 'longHost') return { ...NO_EVENTS_FILTERS, hosts: [LONG_HOST] };
  if (picks === 'between') return { ...NO_EVENTS_FILTERS, when: whenOf('between') };

  return NO_EVENTS_FILTERS;
}

/** sc-73933 and sc-75213: Events' Filter menu at a stand-in text size, every word whole at the accessibility sizes, in its top level and in the levels each row opens. */
export function FilterSizeScreen({ start }: { start: FilterSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const layout = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [filters, setFilters] = useState(() => filtersOf(start.picks));
  const [level, setLevel] = useState(start.level);
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const filterRef = useRef<ViewInstance>(null);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const cap = frameTitleCap(isTablet(layout.kind), Math.min(layout.width, layout.height), scale);

  useEffect(() => {
    return openOnceSettled((then) => anchorUnder(filterRef, then), setMenuAt, MENU_AFTER_MS);
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
              onClose={() => {
                setLevel('top');
                setMenuAt(null);
              }}
              opener={filterRef}
              level={level}
              onLevel={setLevel}
              filters={filters}
              onFilters={setFilters}
              scale={scale}
              cap={cap}
              locale={language}
            />
          </View>
        </I18nextProvider>
        <View style={styles.page}>
          <DemoOnly title="Stand-ins for the device’s text size, its language, what qa has chosen and the level open. The menu draws at the size chosen; Filter stays as main draws it at this device’s size. At AX1 to AX5 a top-level row whose value cannot sit whole beside its title puts it on the line under (sc-73933). In a drilled level every word grows up to the Events title’s size, a row wraps between its words beside its check or radio, a word too wide for its line steps down until it fits whole, never under its default size, and From and To stack (sc-75213). At the standard sizes every level is main’s. Tap Filter to open the menu again. Nothing is sent and no string is added.">
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
            <Choices
              heading="Level"
              options={FILTER_LEVELS}
              chosen={level}
              onChoose={(key) => {
                setLevel(key);
                anchorUnder(filterRef, setMenuAt);
              }}
              id="level"
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

function Menu({
  at,
  onClose,
  opener,
  level,
  onLevel,
  filters,
  onFilters,
  scale,
  cap,
  locale,
}: {
  at: Anchor | null;
  onClose: () => void;
  opener: RefObject<ViewInstance | null>;
  level: FilterLevel;
  onLevel: (level: FilterLevel) => void;
  filters: EventsFilters;
  onFilters: (filters: EventsFilters) => void;
  scale: number;
  cap: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<Picking | null>(null);
  const setLevel = onLevel;
  const first = useRef<ViewInstance>(null);
  const listed = (picks: readonly string[]) =>
    listFormat(locale, { type: 'unit', style: 'short' }).format(picks);
  const types = filters.types.map((type) => t(`eventTypes.${type}`));
  const day = (value: string) => formatWallDay(value, locale);
  const between = filters.when.kind === 'between' ? filters.when : null;
  const whenWord =
    between != null
      ? t('eventsScreen.days', { first: day(between.from), last: day(between.to) })
      : t(WHENS.find(({ kind }) => kind === filters.when.kind)?.word ?? 'eventsSearch.anyTime');
  const close = () => {
    setPicking(null);
    onClose();
  };
  const words = { scale, cap };
  const pickDay = (end: 'from' | 'to') => {
    if (between == null) return;
    pick(
      {
        title: t(end === 'from' ? 'eventsSearch.from' : 'eventsSearch.to'),
        mode: 'date',
        field: { date: between[end], time: '12:00' },
        take: ({ date }) => onFilters({ ...filters, when: { ...between, [end]: date } }),
      },
      setPicking,
    );
  };

  return (
    <AnchoredMenu
      at={at}
      onClose={close}
      opener={opener}
      first={first}
      width={272}
      align="start"
      over={
        picking != null && (
          <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
        )
      }
      testID="demo.filterSize.menu"
    >
      {level === 'top' && (
        <>
          <GrownTopRow
            ref={first}
            title={t('eventsSearch.type')}
            picks={types}
            value={types.length === 0 ? t('eventsSearch.anyType') : listed(types)}
            scale={scale}
            cap={cap}
            onPress={() => setLevel('type')}
            testID="demo.filterSize.type"
          />
          <GrownTopRow
            title={t('eventsSearch.when')}
            picks={[whenWord]}
            value={whenWord}
            scale={scale}
            cap={cap}
            onPress={() => setLevel('when')}
            testID="demo.filterSize.when"
          />
          <GrownTopRow
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
        <Drilled title={t('eventsSearch.type')} onBack={() => setLevel('top')} {...words}>
          {EVENT_TYPES.map((type: EventType) => (
            <Choice
              key={type}
              kind="checkbox"
              word={t(`eventTypes.${type}`)}
              on={filters.types.includes(type)}
              onPress={() => onFilters(withTypeToggled(filters, type))}
              testID={`demo.filterSize.type.${type}`}
              {...words}
            />
          ))}
        </Drilled>
      )}
      {level === 'when' && (
        <Drilled title={t('eventsSearch.when')} onBack={() => setLevel('top')} {...words}>
          {WHENS.map(({ kind, word }) => (
            <Choice
              key={kind}
              kind="radio"
              word={t(word)}
              on={filters.when.kind === kind}
              onPress={() => onFilters({ ...filters, when: whenOf(kind) })}
              testID={`demo.filterSize.when.${kind}`}
              {...words}
            />
          ))}
          {between != null && (
            <View style={[styles.between, datesStacked(scale) && styles.betweenStacked]}>
              {(['from', 'to'] as const).map((end) => (
                <View key={end} style={datesStacked(scale) ? styles.dayStacked : styles.day}>
                  <DayLabel
                    label={t(end === 'from' ? 'eventsSearch.from' : 'eventsSearch.to')}
                    {...words}
                  />
                  <DayBox
                    label={t(end === 'from' ? 'eventsSearch.from' : 'eventsSearch.to')}
                    words={day(between[end])}
                    onPress={() => pickDay(end)}
                    testID={`demo.filterSize.${end}`}
                    {...words}
                  />
                </View>
              ))}
            </View>
          )}
        </Drilled>
      )}
      {level === 'hosts' && (
        <Drilled title={t('eventsSearch.hostedBy')} onBack={() => setLevel('top')} {...words}>
          {HOSTS.map((host) => (
            <Choice
              key={host}
              kind="checkbox"
              word={host}
              on={filters.hosts.includes(host)}
              onPress={() => onFilters(withHostToggled(filters, host, HOSTS))}
              testID={`demo.filterSize.host.${host}`}
              {...words}
            />
          ))}
        </Drilled>
      )}
    </AnchoredMenu>
  );
}

export interface Sizing {
  scale: number;
  cap: number;
}

/** A drilled level's words at the stand-in size: measured piece by piece at their start, a piece being a word or its part up to a hyphen it has, and stepped down only where the widest is wider than `room` (sc-75213). */
export function LevelWords({
  text,
  size,
  scale,
  cap,
  room,
  weight,
  role,
  style,
  testID,
}: Sizing & {
  text: string;
  size: number;
  room: number;
  weight: 'medium' | 'semibold' | 'bold';
  role?: 'header';
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const start = drilledStart(size, scale, cap);
  const key = `${start}|${weight}|${text}`;
  const pieces = piecesIn([text]);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  const pending = widest == null || room === 0;
  const drawn = pending ? start : drilledSize(size, scale, cap, widest, room);

  return (
    <>
      <MeasuredWords
        words={pieces}
        size={start}
        weight={weight}
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[piece] === width ? now : { key, widths: { ...kept, [piece]: width } };
          })
        }
      />
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        size={drawn}
        weight={weight}
        allowFontScaling={false}
        accessible={false}
        accessibilityRole={role}
        style={[{ lineHeight: wholeLineHeight(drawn, drawn) }, style, pending && styles.waiting]}
        testID={testID}
      >
        {text}
      </Text>
    </>
  );
}

/** The width a row's words have, reported once it is laid out. */
function useRoom(): [number, (event: LayoutChangeEvent) => void] {
  const [room, setRoom] = useState(0);

  return [room, (event) => setRoom(event.nativeEvent.layout.width)];
}

function Drilled({
  title,
  onBack,
  children,
  scale,
  cap,
}: Sizing & {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [room, onRoom] = useRoom();

  return (
    <>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('eventsSearch.backFrom', { title })}
        testID="demo.filterSize.back"
      >
        <Glyph name="back" size={18} ink={tokens.colorAccentText} weight={2.4} />
        <View style={styles.words} onLayout={onRoom}>
          <LevelWords
            text={title}
            size={16}
            weight="bold"
            role="header"
            room={room}
            scale={scale}
            cap={cap}
          />
        </View>
      </Pressable>
      <View style={styles.rule} />
      {children}
    </>
  );
}

function Choice({
  kind,
  word,
  on,
  onPress,
  testID,
  scale,
  cap,
}: Sizing & {
  kind: 'checkbox' | 'radio';
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  const [room, onRoom] = useRoom();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
      accessibilityRole={kind}
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      {kind === 'radio' ? (
        <RadioMark on={on} />
      ) : (
        <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>
          {on && <Glyph name="tick" size={14} ink={tokens.colorInkOnDark} weight={3} />}
        </View>
      )}
      <View style={styles.words} onLayout={onRoom}>
        <LevelWords
          text={word}
          size={16}
          weight={on ? 'semibold' : 'medium'}
          room={room}
          style={on && styles.on}
          scale={scale}
          cap={cap}
        />
      </View>
    </Pressable>
  );
}

function DayLabel({ label, scale, cap }: Sizing & { label: string }) {
  const [room, onRoom] = useRoom();

  return (
    <View onLayout={onRoom}>
      <LevelWords text={label} size={13} weight="semibold" room={room} scale={scale} cap={cap} />
    </View>
  );
}

/** Main's date box (MomentBox, year left out), its words at the stand-in size. */
function DayBox({
  label,
  words,
  onPress,
  testID,
  scale,
  cap,
}: Sizing & {
  label: string;
  words: string;
  onPress: () => void;
  testID: string;
}) {
  const [room, onRoom] = useRoom();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayBox,
        datesStacked(scale) && styles.dayBoxGrown,
        pressed && styles.dayBoxPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${words}`}
      testID={testID}
    >
      <View onLayout={onRoom}>
        <LevelWords
          text={words}
          size={15}
          weight="medium"
          room={room}
          style={styles.figures}
          scale={scale}
          cap={cap}
        />
      </View>
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
  pressed: { backgroundColor: tokens.colorInset },
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
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
    paddingVertical: tokens.spaceXxs,
  },
  words: { flex: 1, minWidth: 0 },
  waiting: { opacity: 0 },
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
  betweenStacked: { flexDirection: 'column', gap: tokens.spaceMd },
  day: { flex: 1, gap: 5 },
  dayStacked: { gap: 5 },
  dayBox: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg - 1.5,
    borderWidth: 1.5,
    borderRadius: tokens.radiusRow,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  dayBoxGrown: { paddingVertical: tokens.spaceXs },
  dayBoxPressed: { opacity: tokens.opacityPressed },
  figures: { fontVariant: ['tabular-nums'] },
});
