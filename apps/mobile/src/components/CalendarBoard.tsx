import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CalendarMonth,
  type CalendarView,
  keptCalendarPlace,
  monthOfDay,
  readCalendarPlace,
  shiftMonth,
} from '@soirely/domain';
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  type FlatList,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  BIG_WEEK,
  type CalEvent,
  type Days,
  type Item,
  PHONE_WEEK,
  WIDE_WEEK,
  type Week,
  agendaMonth,
  agendaOf,
  emptyMonthLine,
  firstOf,
  landingIn,
  landingOf,
  monthKey,
  monthName,
  offsetsOf,
  pinnedOf,
  weekIndexOf,
  weeksAround,
} from '../kit/calendar.ts';
import { useAccessibilitySizes } from '../layout/useLayout.ts';
import { motionEase } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { Agenda } from './CalendarAgenda.tsx';
import {
  MonthName,
  type ShowChoice,
  ShowButton,
  ShowMenu,
  Spinner,
  Stepper,
  ViewSwitch,
} from './CalendarControls.tsx';
import { DayList, type RowProps } from './CalendarDay.tsx';
import { CentredDialog, SIDE_GAP, SIDE_PANEL, SidePanel } from './CalendarOverlays.tsx';
import { type GridLook, LoadingWeeks, WeekdayHeads, WeekList } from './CalendarWeeks.tsx';
import { EventsFirstRun } from './EventsList.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import type { CoverLayout } from './TodayCover.tsx';
import { Pill } from './SettingsParts.tsx';
import { Sheet } from './Sheet.tsx';
import { type Anchor, anchorUnder } from './Summary.tsx';
import { Text } from './Text.tsx';

export type BoardLoad = 'loading' | 'failed' | 'loaded';

/** What a Show choice changes beyond its days: the rows it draws, its empty words, and where Agenda and Today land. */
export interface ShowParts {
  Row?: ComponentType<RowProps>;
  lateOf?: (item: Item) => boolean;
  emptyDay: string;
  emptyMonth: (month: string) => string;
  /** Agenda lists every month, an empty one with its line, and today only with something on it. */
  everyMonth?: boolean;
  /** Where Agenda and Today land from a day, in place of today or the month asked for. */
  landing?: (days: Days, from: string) => string;
}

/** Where the board opens, in place of the place it kept: the demo's states. */
export interface BoardStart {
  view: CalendarView | null;
  at: string | null;
  open: string | null;
  menu: boolean;
}

const NO_START: BoardStart = { view: null, at: null, open: null, menu: false };

const LOOKS: Record<'big' | 'phone' | 'wide', GridLook> = {
  big: { week: BIG_WEEK, wide: false, big: true },
  phone: { week: PHONE_WEEK, wide: false, big: false },
  wide: { week: WIDE_WEEK, wide: true, big: false },
};

function lookOf(big: boolean, phone: boolean): GridLook {
  return LOOKS[big ? 'big' : phone ? 'phone' : 'wide'];
}

/** A scroll the page drives itself, over motionSlow with motionEase, or at once under Reduce Motion. */
function useGlide(reduced: boolean) {
  const running = useRef<Animated.CompositeAnimation | null>(null);

  return useCallback(
    (from: number, to: number, apply: (y: number) => void, done: () => void) => {
      running.current?.stop();
      if (reduced || Math.abs(to - from) < 1) {
        apply(to);
        done();
        return;
      }
      const value = new Animated.Value(from);
      const heard = value.addListener(({ value: y }) => apply(y));
      running.current = Animated.timing(value, {
        toValue: to,
        duration: tokens.motionSlow,
        easing: motionEase,
        useNativeDriver: false,
      });
      running.current.start(() => {
        value.removeListener(heard);
        done();
      });
    },
    [reduced],
  );
}

export interface CalendarBoardProps<S extends string, E extends CalEvent> {
  load: BoardLoad;
  events: readonly E[];
  daysOf: (events: readonly E[], show: S) => Days;
  choices: readonly ShowChoice<S>[];
  firstShow: S;
  partsOf: (show: S) => ShowParts;
  layout: CoverLayout;
  today: string;
  readerZone: string;
  locale: string;
  firstDay: number;
  /** The AsyncStorage key the view and month are kept under. */
  kept: string;
  start?: BoardStart;
  bottom: number;
  head?: ReactNode;
  onOpen: (item: Item) => void;
  onRetry: () => void;
  onCreate?: (() => void) | undefined;
}

/** Calendar, `Calendar-*` (sc-3625): the toolbar, the weeks as lanes or Agenda, and a day's list, for the app and its demo alike. */
export function CalendarBoard<S extends string, E extends CalEvent>({
  load,
  events,
  daysOf,
  choices,
  firstShow,
  partsOf,
  layout,
  today,
  readerZone,
  locale,
  firstDay,
  kept,
  start = NO_START,
  bottom,
  head,
  onOpen,
  onRetry,
  onCreate,
}: CalendarBoardProps<S, E>) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const big = useAccessibilitySizes();
  const phone = layout === 'phone';
  const landscape = layout === 'landscape';

  const [view, setView] = useState<CalendarView | null>(start.view);
  const [at, setAt] = useState<string | null>(start.at);
  const [show, setShow] = useState<S>(firstShow);
  const [open, setOpen] = useState<string | null>(start.open);
  const [lastDay, setLastDay] = useState<string | null>(start.open);
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const [agendaTop, setAgendaTop] = useState<string | null>(null);
  const [todayRuns, setTodayRuns] = useState(false);
  const [width, setWidth] = useState(0);

  const showRef = useRef<ViewInstance>(null);
  const dayOpener = useRef<ViewInstance | null>(null);
  const listRef = useRef<FlatList<Week>>(null);
  const agendaRef = useRef<ScrollViewInstance>(null);
  const weekY = useRef(0);
  const agendaY = useRef(0);
  const places = useRef(new Map<string, number>());
  const glide = useGlide(reduced);
  const placed = start.view != null && start.at != null;

  useEffect(() => {
    if (placed) return;
    let live = true;
    const land = (place: ReturnType<typeof readCalendarPlace>) => {
      setView((was) => was ?? place?.view ?? 'month');
      setAt((was) => was ?? (place == null ? today : landingOf(place.month, today)));
    };

    AsyncStorage.getItem(kept).then(
      (read) => live && land(readCalendarPlace(read)),
      () => live && land(null),
    );

    return () => {
      live = false;
    };
  }, [placed, kept, today]);

  useEffect(() => {
    if (!start.menu) return;
    const wait = setTimeout(() => anchorUnder(showRef, setMenuAt), SETTLED_MS);

    return () => clearTimeout(wait);
  }, [start.menu]);

  const parts = useMemo(() => partsOf(show), [partsOf, show]);
  const days = useMemo(() => daysOf(events, show), [daysOf, events, show]);
  const weeks = useMemo(
    () => weeksAround(monthOfDay(today), firstDay, days),
    [today, firstDay, days],
  );
  const look = lookOf(big, phone);
  const offsets = useMemo(() => offsetsOf(weeks, look.week), [weeks, look]);
  const everyMonth = parts.everyMonth ?? false;
  const entries = useMemo(
    () => agendaOf(monthOfDay(today), days, today, everyMonth),
    [today, days, everyMonth],
  );
  const startIndex = weekIndexOf(weeks, at ?? today);
  const topWeek = weeks[top ?? startIndex];
  const pinned: CalendarMonth =
    view === 'agenda'
      ? agendaTop == null
        ? monthOfDay(at ?? today)
        : monthOfDay(`${agendaTop}-01`)
      : pinnedOf(topWeek, monthOfDay(today));
  const pinnedKey = monthKey(pinned);
  const ready = view != null && at != null;

  useEffect(() => {
    if (view == null || at == null) return;
    void AsyncStorage.setItem(
      kept,
      keptCalendarPlace({ view, month: monthOfDay(`${pinnedKey}-01`) }),
    ).catch(() => undefined);
  }, [kept, view, at, pinnedKey]);

  const loaded = load === 'loaded';
  const none = loaded && events.length === 0;
  const items = days.get(lastDay ?? '') ?? [];

  const closeDay = useCallback(() => setOpen(null), []);
  const onDay = useCallback((day: string, node: ViewInstance | null) => {
    dayOpener.current = node;
    setLastDay(day);
    setOpen(day);
  }, []);
  const onTop = useCallback((index: number, y: number) => {
    weekY.current = y;
    setTop(index);
  }, []);

  const scrollWeeks = (index: number, toToday: boolean) => {
    const to = offsets[index] ?? 0;
    if (toToday) setTodayRuns(true);
    glide(
      weekY.current,
      to,
      (y) => listRef.current?.scrollToOffset({ offset: y, animated: false }),
      () => setTodayRuns(false),
    );
  };
  const scrollAgenda = (key: string, toToday: boolean) => {
    const to = places.current.get(key);
    if (to == null) return;
    if (toToday) setTodayRuns(true);
    glide(
      agendaY.current,
      to,
      (y) => agendaRef.current?.scrollTo({ y, animated: false }),
      () => setTodayRuns(false),
    );
  };
  const onStep = (step: -1 | 1) => {
    if (view === 'agenda') {
      const month = agendaMonth(entries, pinned, step);
      if (month != null) scrollAgenda(`month-${monthKey(month)}`, false);
      return;
    }
    scrollWeeks(weekIndexOf(weeks, firstOf(shiftMonth(pinned, step))), false);
  };
  const onToday = () => {
    if (view === 'agenda') scrollAgenda(parts.landing?.(days, today) ?? today, true);
    else scrollWeeks(weekIndexOf(weeks, today), true);
  };
  const toView = (next: CalendarView) => {
    if (next === view) return;
    setAt(landingOf(pinned, today));
    setTop(null);
    setAgendaTop(null);
    setOpen(null);
    setView(next);
  };
  const toShow = (next: S) => {
    if (next === show) return;
    setAt(view === 'agenda' ? landingOf(pinned, today) : (topWeek?.start ?? today));
    setTop(null);
    setAgendaTop(null);
    setShow(next);
  };

  const onAgendaY = useCallback((key: string, y: number) => {
    places.current.set(key, y);
  }, []);
  const onAgendaLand = useCallback((y: number) => {
    agendaY.current = y;
  }, []);
  const onAgendaScroll = (y: number) => {
    agendaY.current = y;
    let found: string | null = null;
    for (const entry of entries) {
      const place = places.current.get(entry.key);
      if (place == null || place > y + 1) continue;
      found = entry.kind === 'day' ? entry.day.slice(0, 7) : monthKey(entry.month);
    }
    if (found != null && found !== agendaTop) setAgendaTop(found);
  };

  const agendaWords = useMemo(
    () => ({
      emptyDay: parts.emptyDay,
      emptyMonth: (month: CalendarMonth) => parts.emptyMonth(monthName(month, locale)),
    }),
    [parts, locale],
  );
  const agendaLanding = parts.landing?.(days, at ?? today) ?? landingIn(entries, at, today);

  const sideOpen = landscape && open != null;
  const gridWidth = sideOpen ? Math.max(0, width - SIDE_PANEL - SIDE_GAP) : width;
  const monthWords = monthName(pinned, locale);

  const viewSwitch = <ViewSwitch view={view ?? 'month'} onView={toView} big={big && phone} />;
  const showButton = (
    <ShowButton
      show={show}
      choices={choices}
      big={big && phone}
      onPress={() => anchorUnder(showRef, setMenuAt)}
      ref={showRef}
    />
  );
  const stepper = <Stepper running={todayRuns} onStep={onStep} onToday={onToday} />;
  const toolbar = phone ? (
    big ? (
      <View style={styles.toolbarBig}>
        {viewSwitch}
        {showButton}
        <MonthName name={monthWords} size={22} />
        <View style={styles.stepperBig}>{stepper}</View>
      </View>
    ) : (
      <View style={styles.toolbarPhone}>
        <View style={[styles.row, styles.wrap]}>
          {viewSwitch}
          <View style={styles.grow} />
          {showButton}
        </View>
        <View style={styles.row}>
          <MonthName name={monthWords} size={22} />
          <View style={styles.grow} />
          {stepper}
        </View>
      </View>
    )
  ) : (
    <View style={[styles.row, landscape ? styles.toolbarSide : styles.toolbarUpright]}>
      <View style={styles.monthGroup}>
        <MonthName name={monthWords} size={22} />
        {stepper}
      </View>
      <View style={styles.grow} />
      <View style={styles.viewGroup}>
        {viewSwitch}
        {showButton}
      </View>
    </View>
  );

  const emptyLine =
    view === 'month' ? emptyMonthLine(loaded, pinned, days, parts.emptyMonth, monthWords) : null;
  const line =
    load === 'loading' ? (
      <ReadOut words={t('calendar.loading')} style={styles.loading}>
        <Spinner />
        <Text size={14} weight="medium" style={styles.secondary}>
          {t('calendar.loading')}
        </Text>
      </ReadOut>
    ) : emptyLine != null ? (
      <Text
        size={15}
        weight="medium"
        style={[styles.secondary, styles.said]}
        testID="calendar.emptyMonth"
      >
        {emptyLine}
      </Text>
    ) : null;

  const heads = <WeekdayHeads firstDay={firstDay} locale={locale} width={gridWidth} look={look} />;
  const dayList = (day: string) => (
    <DayList
      day={day}
      today={today}
      items={items}
      emptyWords={parts.emptyDay}
      Row={parts.Row}
      locale={locale}
      readerZone={readerZone}
      big={big}
      onOpen={onOpen}
      onClose={closeDay}
    />
  );

  let body: ReactNode = null;

  if (none)
    body = (
      <ScrollView
        style={styles.grow}
        contentContainerStyle={[styles.first, { paddingBottom: bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <EventsFirstRun wide={!phone} onCreate={onCreate} />
      </ScrollView>
    );
  else if (load === 'failed')
    body = (
      <View style={styles.failed} testID="calendar.failed">
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('calendar.failed')}
          announce
        />
        <Pill
          label={t('calendar.retry')}
          kind="secondary"
          height={tokens.sizeHit}
          onPress={onRetry}
          testID="calendar.retry"
        />
      </View>
    );
  else if (load === 'loading')
    body = (
      <View style={styles.grow} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            {heads}
            <LoadingWeeks
              weeks={weeks.slice(startIndex, startIndex + 6)}
              width={gridWidth}
              look={look}
              today={today}
              locale={locale}
            />
          </>
        )}
      </View>
    );
  else if (ready && view === 'agenda')
    body = (
      <Agenda
        key={`${show}:${at}`}
        entries={entries}
        land={agendaLanding}
        today={today}
        words={agendaWords}
        Row={parts.Row}
        locale={locale}
        readerZone={readerZone}
        big={big}
        lead={big ? 68 : phone ? 44 : 56}
        maxWidth={phone ? null : 640}
        bottom={bottom}
        scrollRef={agendaRef}
        onOpen={onOpen}
        onY={onAgendaY}
        onLand={onAgendaLand}
        onScroll={onAgendaScroll}
      />
    );
  else if (ready)
    body = (
      <View
        style={[styles.grow, styles.sideRow]}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <View style={{ width: gridWidth }}>
            {heads}
            <WeekList
              key={`${show}:${at}:${big ? 'big' : 'lanes'}`}
              weeks={weeks}
              width={gridWidth}
              look={look}
              today={today}
              lit={open}
              pinned={pinned}
              locale={locale}
              lateOf={parts.lateOf}
              start={startIndex}
              bottom={bottom}
              onDay={onDay}
              onTop={onTop}
              listRef={listRef}
            />
          </View>
        )}
        {landscape && (
          <SidePanel open={open != null} opener={dayOpener} testID="calendar.dayPanel">
            {open != null && dayList(open)}
          </SidePanel>
        )}
      </View>
    );

  const shownDay = loaded && lastDay != null ? dayList(lastDay) : null;

  return (
    <View style={styles.grow}>
      {head}
      {!none && toolbar}
      {!none && line}
      {body}
      <ShowMenu
        at={menuAt}
        show={show}
        choices={choices}
        opener={showRef}
        onShow={toShow}
        onClose={() => setMenuAt(null)}
      />
      {phone ? (
        <Sheet
          open={open != null}
          onClose={closeDay}
          opener={dayOpener}
          scrimLabel={t('calendar.close')}
          headingTakesFocus
          testID="calendar.daySheet"
        >
          <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
            {shownDay}
          </ScrollView>
        </Sheet>
      ) : (
        !landscape && (
          <CentredDialog
            open={open != null}
            onClose={closeDay}
            opener={dayOpener}
            width={560}
            testID="calendar.dayDialog"
          >
            {shownDay}
          </CentredDialog>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: tokens.sizeHit,
    gap: tokens.spaceMd,
  },
  wrap: { flexWrap: 'wrap' },
  toolbarPhone: { gap: tokens.spaceMd, marginTop: tokens.spaceMd, marginBottom: tokens.spaceXs },
  toolbarBig: { gap: tokens.spaceMd, marginTop: tokens.spaceMd, marginBottom: tokens.spaceXs },
  stepperBig: { minHeight: 60, justifyContent: 'center', alignItems: 'flex-start' },
  toolbarUpright: { marginTop: tokens.spaceXl, marginBottom: tokens.spaceLg },
  toolbarSide: { marginTop: tokens.spacePillEnd, marginBottom: tokens.spaceMd },
  monthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    flexShrink: 1,
  },
  viewGroup: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.space3xl,
    marginBottom: tokens.spaceSm,
  },
  said: { lineHeight: 15 * 1.45, marginBottom: tokens.spaceSm },
  sideRow: { flexDirection: 'row', gap: SIDE_GAP },
  first: { gap: 18, paddingTop: tokens.spacePillEnd },
  failed: { gap: tokens.spaceLg, paddingTop: tokens.spaceXxs },
  sheetBody: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceSm,
  },
});
