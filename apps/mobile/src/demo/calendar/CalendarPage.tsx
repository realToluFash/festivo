import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CalendarMonth,
  type CalendarView,
  firstDayOfWeek,
  formattingLocale,
  keptCalendarPlace,
  monthOfDay,
  readCalendarPlace,
  shiftMonth,
  wallDay,
} from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type FlatList,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '../../components/Cover.tsx';
import { Notice } from '../../components/Notice.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import { useAccessibilitySizes } from '../../layout/useLayout.ts';
import { motionEase } from '../../motion.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { CardPieces } from '../../components/EventCard.tsx';
import { openEvent } from '../events/EventsList.tsx';
import { CLOCKS, EVENT_OF_KEY, READER_ZONE } from '../events/EventsSample.ts';
import { W } from '../events/EventsWords.ts';
import { Bell, Landscape, OrgPill, PortraitTop } from '../settings/Frame.tsx';
import { Agenda } from './CalendarAgenda.tsx';
import {
  MonthName,
  ShowButton,
  ShowMenu,
  Spinner,
  Stepper,
  SubscribeRound,
  ViewSwitch,
} from './CalendarControls.tsx';
import { DayList } from './CalendarDay.tsx';
import {
  type AgendaEntry,
  BIG_WEEK,
  type CalendarState,
  type Feed,
  type Load,
  NOW,
  PHONE_WEEK,
  type Show,
  WIDE_WEEK,
  type Week,
  agendaMonth,
  agendaOf,
  calendarEvents,
  daysOf,
  firstOf,
  monthKey,
  monthLine,
  monthName,
  needsLanding,
  pinnedOf,
  sampleOf,
  startOf,
  weekIndexOf,
  weeksAround,
} from './CalendarModel.ts';
import { CentredDialog, SIDE_GAP, SIDE_PANEL, SidePanel } from './CalendarOverlays.tsx';
import { SubscribePanel } from './CalendarSubscribe.tsx';
import {
  type GridLook,
  LoadingWeeks,
  WeekdayHeads,
  WeekList,
  offsetsOf,
} from './CalendarWeeks.tsx';
import { CW } from './CalendarWords.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import {
  type Anchor,
  anchorUnder,
  CardSays,
  Row,
  RowList,
  StepButton,
  SummaryCard,
} from '../../components/Summary.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';

/** The demo keeps its own place, so it never moves the real Calendar's. */
const KEPT = 'soirely.demo.calendar';
const TODAY = wallDay(CLOCKS.reader, READER_ZONE);
const RETRY_MS = 900;

function landingOf(month: CalendarMonth): string {
  return monthKey(month) === TODAY.slice(0, 7) ? TODAY : firstOf(month);
}

/** Agenda lands on today, or on the month asked for, or the next month with days in it. */
const LOOKS: Record<'big' | 'phone' | 'wide', GridLook> = {
  big: { week: BIG_WEEK, wide: false, big: true },
  phone: { week: PHONE_WEEK, wide: false, big: false },
  wide: { week: WIDE_WEEK, wide: true, big: false },
};

function lookOf(big: boolean, phone: boolean): GridLook {
  return LOOKS[big ? 'big' : phone ? 'phone' : 'wide'];
}

function landingIn(entries: readonly AgendaEntry[], at: string | null): string {
  if (at == null || at === TODAY) return TODAY;
  const key = monthKey(monthOfDay(at));
  const found = entries.find((entry) => entry.kind === 'month' && monthKey(entry.month) >= key);

  return found?.key ?? TODAY;
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

/** The Calendar in B, weeks as lanes, on the demo's sample: every state the AC names, by ?state=. */
export function CalendarPage({ state }: { state: CalendarState | null }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const big = useAccessibilitySizes();
  const phone = shell.layout === 'phone';
  const { locale, firstDay } = useMemo(() => {
    const dates = formattingLocale('en', getLocales()[0]?.languageTag);

    return { locale: dates, firstDay: firstDayOfWeek(dates) };
  }, []);
  const start = useMemo(() => startOf(state, TODAY), [state]);
  const events = useMemo(() => calendarEvents(sampleOf(state), NOW, start.needs), [state, start]);

  const [view, setView] = useState<CalendarView | null>(start.view);
  const [at, setAt] = useState<string | null>(start.at);
  const [show, setShow] = useState<Show>(start.show);
  const [open, setOpen] = useState<string | null>(start.open);
  const [feed, setFeed] = useState<Feed | null>(start.feed);
  const [feeds, setFeeds] = useState(0);
  const [load, setLoad] = useState<Load>(start.load);
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const [agendaTop, setAgendaTop] = useState<string | null>(null);
  const [todayRuns, setTodayRuns] = useState(false);
  const [width, setWidth] = useState(0);

  const showRef = useRef<ViewInstance>(null);
  const subscribeRef = useRef<ViewInstance>(null);
  const dayOpener = useRef<ViewInstance | null>(null);
  const listRef = useRef<FlatList<Week>>(null);
  const agendaRef = useRef<ScrollViewInstance>(null);
  const weekY = useRef(0);
  const agendaY = useRef(0);
  const places = useRef(new Map<string, number>());
  const [lastDay, setLastDay] = useState<string | null>(start.open);
  const glide = useGlide(reduced);

  useEffect(() => {
    if (start.view != null && start.at != null) return;
    let live = true;

    AsyncStorage.getItem(KEPT).then(
      (read) => {
        if (!live) return;
        const kept = readCalendarPlace(read);
        setView((was) => was ?? kept?.view ?? 'month');
        setAt((was) => was ?? (kept == null ? TODAY : landingOf(kept.month)));
      },
      () => {
        if (!live) return;
        setView((was) => was ?? 'month');
        setAt((was) => was ?? TODAY);
      },
    );

    return () => {
      live = false;
    };
  }, [start]);

  useEffect(() => {
    if (!start.menu) return;
    const wait = setTimeout(() => anchorUnder(showRef, setMenuAt), SETTLED_MS);

    return () => clearTimeout(wait);
  }, [start]);

  const days = useMemo(() => daysOf(events, show), [events, show]);
  const weeks = useMemo(() => weeksAround(monthOfDay(TODAY), firstDay, days), [firstDay, days]);
  const look = lookOf(big, phone);
  const offsets = useMemo(() => offsetsOf(weeks, look.week), [weeks, look]);
  const entries = useMemo(() => agendaOf(monthOfDay(TODAY), days, TODAY, show), [days, show]);
  const startIndex = weekIndexOf(weeks, at ?? TODAY);
  const topWeek = weeks[top ?? startIndex];
  const pinned =
    view === 'agenda'
      ? agendaTop == null
        ? monthOfDay(at ?? TODAY)
        : monthOfDay(`${agendaTop}-01`)
      : pinnedOf(topWeek, monthOfDay(TODAY));
  const pinnedKey = monthKey(pinned);
  const ready = view != null && at != null;

  useEffect(() => {
    if (view == null || at == null) return;
    void AsyncStorage.setItem(
      KEPT,
      keptCalendarPlace({ view, month: monthOfDay(`${pinnedKey}-01`) }),
    ).catch(() => undefined);
  }, [view, at, pinnedKey]);

  const loaded = load === 'loaded';
  const none = loaded && events.length === 0;
  const lit = open;
  const items = days.get(lastDay ?? '') ?? [];
  const tell = shell.tell;

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

  const scrollWeeks = (index: number, today: boolean) => {
    const to = offsets[index] ?? 0;
    if (today) setTodayRuns(true);
    glide(
      weekY.current,
      to,
      (y) => listRef.current?.scrollToOffset({ offset: y, animated: false }),
      () => setTodayRuns(false),
    );
  };
  const scrollAgenda = (key: string, today: boolean) => {
    const to = places.current.get(key);
    if (to == null) return;
    if (today) setTodayRuns(true);
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
    if (view === 'agenda') scrollAgenda(show === 'needs' ? needsLanding(days, TODAY) : TODAY, true);
    else scrollWeeks(weekIndexOf(weeks, TODAY), true);
  };
  const toView = (next: CalendarView) => {
    if (next === view) return;
    setAt(landingOf(pinned));
    setTop(null);
    setAgendaTop(null);
    setOpen(null);
    setView(next);
  };
  const toShow = (next: Show) => {
    if (next === show) return;
    setAt(view === 'agenda' ? landingOf(pinned) : (topWeek?.start ?? TODAY));
    setTop(null);
    setAgendaTop(null);
    setShow(next);
  };
  const retry = () => {
    setLoad('loading');
    setTimeout(() => setLoad('loaded'), RETRY_MS);
  };
  const subscribe = () => {
    setFeeds((count) => count + 1);
    setFeed('panel');
  };

  const agendaLanding = show === 'needs' ? needsLanding(days, at ?? TODAY) : landingIn(entries, at);
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

  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const bottom = phone ? foot + PHONE_TAB_BAR + tokens.space3xl : insets.bottom + tokens.space3xl;
  const sideOpen = shell.layout === 'landscape' && open != null;
  const gridWidth = sideOpen ? Math.max(0, width - SIDE_PANEL - SIDE_GAP) : width;
  const monthWords = monthName(pinned, locale);

  const title = (
    <View style={styles.titleRow}>
      <Text
        size={phone ? 30 : 34}
        weight="bold"
        accessibilityRole="header"
        maxFontSizeMultiplier={44 / (phone ? 30 : 34)}
        style={[styles.grow, titled(phone ? 30 : 34)]}
      >
        {CW.title}
      </Text>
      {phone ? (
        <SubscribeRound onPress={subscribe} ref={subscribeRef} />
      ) : (
        <Pill
          label={CW.subscribe}
          kind="secondary"
          glyph="calendar"
          height={tokens.sizeHit}
          full={false}
          onPress={subscribe}
          ref={subscribeRef}
          testID="calendar.subscribe"
        />
      )}
    </View>
  );

  const viewSwitch = <ViewSwitch view={view ?? 'month'} onView={toView} big={big && phone} />;
  const showButton = (
    <ShowButton
      show={show}
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
    <View
      style={[styles.row, shell.layout === 'portrait' ? styles.toolbarUpright : styles.toolbarSide]}
    >
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

  const emptyLine = view === 'month' ? monthLine(load, show, pinned, days, monthWords) : null;
  const line =
    load === 'loading' ? (
      <ReadOut words={CW.loading} style={styles.loading}>
        <Spinner />
        <Text size={14} weight="medium" style={styles.secondary}>
          {CW.loading}
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

  let body: ReactNode = null;

  if (none)
    body = (
      <ScrollView
        style={styles.grow}
        contentContainerStyle={[styles.first, { paddingBottom: bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <FirstRun wide={!phone} onTell={tell} />
      </ScrollView>
    );
  else if (load === 'failed')
    body = (
      <View style={styles.failed} testID="calendar.failed">
        <Notice tone="broken" mark={tokens.marks.broken.glyph} body={CW.failed} announce />
        <Pill
          label={CW.tryAgain}
          kind="secondary"
          height={tokens.sizeHit}
          onPress={retry}
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
              today={TODAY}
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
        today={TODAY}
        show={show}
        locale={locale}
        big={big}
        lead={big ? 68 : phone ? 44 : 56}
        maxWidth={phone ? null : 640}
        bottom={bottom}
        scrollRef={agendaRef}
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
              today={TODAY}
              lit={lit}
              pinned={pinned}
              locale={locale}
              show={show}
              start={startIndex}
              bottom={bottom}
              onDay={onDay}
              onTop={onTop}
              listRef={listRef}
            />
          </View>
        )}
        {shell.layout === 'landscape' && (
          <SidePanel open={open != null} opener={dayOpener} testID="calendar.dayPanel">
            {open != null && (
              <DayList
                day={open}
                today={TODAY}
                items={items}
                show={show}
                locale={locale}
                big={big}
                onClose={closeDay}
              />
            )}
          </SidePanel>
        )}
      </View>
    );

  const subscribePanel = feed != null && (
    <SubscribePanel
      key={feeds}
      organisation={SAMPLE.organisation}
      start={feed}
      wide={!phone}
      onClose={() => setFeed(null)}
      onOpenApp={() => {
        setFeed(null);
        tell(CW.openApp);
      }}
    />
  );
  const dayList = loaded && lastDay != null && (
    <DayList
      day={lastDay}
      today={TODAY}
      items={items}
      show={show}
      locale={locale}
      big={big}
      onClose={closeDay}
    />
  );

  const overlays = (
    <>
      <ShowMenu
        at={menuAt}
        show={show}
        opener={showRef}
        onShow={toShow}
        onClose={() => setMenuAt(null)}
      />
      {phone ? (
        <>
          <Sheet
            open={open != null}
            onClose={closeDay}
            opener={dayOpener}
            scrimLabel={CW.close}
            headingTakesFocus
            testID="calendar.daySheet"
          >
            <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
              {dayList}
            </ScrollView>
          </Sheet>
          <Sheet
            open={feed != null}
            onClose={() => setFeed(null)}
            opener={subscribeRef}
            scrimLabel={CW.close}
            headingTakesFocus
            testID="calendar.subscribeSheet"
          >
            <ScrollView bounces={false} contentContainerStyle={styles.sheetBody}>
              {subscribePanel}
            </ScrollView>
          </Sheet>
        </>
      ) : (
        <>
          {shell.layout === 'portrait' && (
            <CentredDialog
              open={open != null}
              onClose={closeDay}
              opener={dayOpener}
              width={560}
              testID="calendar.dayDialog"
            >
              {dayList}
            </CentredDialog>
          )}
          <CentredDialog
            open={feed != null}
            onClose={() => setFeed(null)}
            opener={subscribeRef}
            width={shell.layout === 'portrait' ? 560 : 600}
            testID="calendar.subscribeDialog"
          >
            {subscribePanel}
          </CentredDialog>
        </>
      )}
    </>
  );

  const content = (
    <>
      {title}
      <SwitchedNotice />
      {!none && toolbar}
      {!none && line}
      {body}
    </>
  );

  if (shell.layout === 'landscape')
    return (
      <Landscape
        column={null}
        at="Calendar"
        onEvent={(key) => openEvent(EVENT_OF_KEY[key])}
        overlay={overlays}
      >
        <View style={styles.pane}>{content}</View>
      </Landscape>
    );

  if (shell.layout === 'portrait')
    return (
      <View style={styles.page}>
        <PortraitTop at="Calendar" />
        <View style={styles.portrait}>{content}</View>
        {overlays}
      </View>
    );

  return (
    <View style={styles.page}>
      <View style={{ height: insets.top }} />
      <View style={styles.phone}>
        <View style={styles.orgRow}>
          <OrgPill />
          <View style={styles.grow} />
          <Bell tell={tell} />
        </View>
        {content}
      </View>
      <TabBarFade />
      <PhoneTabBar bottom={foot} onTab={shell.onTab} at="Calendar" />
      {overlays}
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

/** No events at all: the Events first run, in place of the toolbar and the weeks. */
function FirstRun({ wide, onTell }: { wide: boolean; onTell: (words: string) => void }) {
  return (
    <>
      <SummaryCard
        size={wide ? 'wide' : 'page'}
        height={200}
        backdrop={
          <>
            <Cover shade="side" pieces={[]} />
            <CardPieces />
          </>
        }
        testID="calendar.first"
      >
        <CardSays text={W.firstRunTitle} size={wide ? 28 : 24} heading />
        <View style={styles.cardFoot}>
          <StepButton
            label={W.firstRunCreate}
            onPress={() => onTell(`${W.firstRunCreate} has its own design.`)}
            testID="calendar.first.create"
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
    </>
  );
}

function titled(size: number) {
  return { lineHeight: size * 1.12, letterSpacing: size * -0.02 };
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  phone: { flex: 1, paddingTop: tokens.spaceXxs, paddingHorizontal: tokens.spaceXxl },
  portrait: { flex: 1, paddingTop: 26, paddingHorizontal: tokens.space5xl },
  pane: { flex: 1, paddingTop: 26, paddingHorizontal: 30 },
  orgRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spaceSm },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
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
  cardFoot: { marginTop: 'auto' },
  failed: { gap: tokens.spaceLg, paddingTop: tokens.spaceXxs },
  sheetBody: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceSm,
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
