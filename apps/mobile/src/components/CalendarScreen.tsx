import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ListedEvent } from '@soirely/api-client';
import {
  type CalendarShow,
  type CalendarView,
  calendarDays,
  firstDayOfWeek,
  keptCalendarPlace,
  monthOfDay,
  readCalendarPlace,
  roleHolds,
  serverClock,
  shiftMonth,
  wallDay,
} from '@soirely/domain';
import { type Href, Redirect, router } from 'expo-router';
import {
  type ReactNode,
  type RefObject,
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

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import {
  BIG_WEEK,
  type Item,
  PHONE_WEEK,
  WIDE_WEEK,
  type Week,
  agendaMonth,
  agendaOf,
  calEventOf,
  emptyMonth,
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
import { type LayoutKind, useAccessibilitySizes, useLayout } from '../layout/useLayout.ts';
import { motionEase } from '../motion.ts';
import { NOT_OFFLINE, type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { afterFailedLoad } from '../offlineLoad.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { rereadOrganisations, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { Agenda } from './CalendarAgenda.tsx';
import {
  MonthName,
  type ShowChoice,
  ShowButton,
  ShowMenu,
  Spinner,
  Stepper,
  SubscribeRound,
  ViewSwitch,
} from './CalendarControls.tsx';
import { DayList } from './CalendarDay.tsx';
import { CentredDialog, SIDE_GAP, SIDE_PANEL, SidePanel } from './CalendarOverlays.tsx';
import { CalendarFeed, apiFeed } from './CalendarSubscribe.tsx';
import { type GridLook, LoadingWeeks, WeekdayHeads, WeekList } from './CalendarWeeks.tsx';
import { EventsFirstRun } from './EventsList.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Refreshing } from './Refreshing.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import { Sheet } from './Sheet.tsx';
import { type Anchor, anchorUnder } from './Summary.tsx';
import { Text, type TextHandle } from './Text.tsx';

const KEPT = 'soirely.calendar';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; events: ListedEvent[] };

const LOOKS: Record<'big' | 'phone' | 'wide', GridLook> = {
  big: { week: BIG_WEEK, wide: false, big: true },
  phone: { week: PHONE_WEEK, wide: false, big: false },
  wide: { week: WIDE_WEEK, wide: true, big: false },
};

function lookOf(big: boolean, phone: boolean): GridLook {
  return LOOKS[big ? 'big' : phone ? 'phone' : 'wide'];
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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

function openItem(item: Item) {
  const id = encodeURIComponent(item.event.id);
  const href: Href = item.kind === 'event' ? `/events/${id}` : `/events/${id}/dates`;

  router.push(href);
}

/** Calendar, `Calendar-*` (sc-3625): the organisation's events and their milestones as weeks of lanes, or as Agenda, with its band and Refreshing… (sc-27086). */
export function CalendarScreen() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const title = useRef<TextHandle>(null);
  const subscribeRef = useRef<ViewInstance>(null);
  const [offline, setOffline] = useState<ScreenOffline>(NOT_OFFLINE);
  const [feed, setFeed] = useState(false);
  const organisationId = organisation?.id;
  const source = useMemo(
    () => (organisationId == null ? null : apiFeed(organisationId)),
    [organisationId],
  );
  const reads = organisation != null && roleHolds(organisation, 'events.read');

  if (organisation != null && !reads) return <Redirect href={DESTINATION_HREF.home} />;

  const subscribe = () => setFeed(true);

  return (
    <AppFrame
      current="calendar"
      title={t('calendar.title')}
      titleRef={title}
      offline={offline.stale}
      besideTitle={
        <View style={styles.beside}>
          {offline.refreshing && <Refreshing testID="calendar.refreshing" />}
          {organisation != null &&
            (kind === 'phone' ? (
              <SubscribeRound onPress={subscribe} ref={subscribeRef} />
            ) : (
              <Pill
                label={t('calendarFeed.open')}
                kind="secondary"
                glyph="calendar"
                height={tokens.sizeHit}
                full={false}
                onPress={subscribe}
                ref={subscribeRef}
                testID="calendarFeed.open"
              />
            ))}
        </View>
      }
    >
      {organisation != null && (
        <CalendarOf
          key={organisation.id}
          organisationId={organisation.id}
          creates={roleHolds(organisation, 'events.create')}
          kind={kind}
          heading={title}
          onOffline={setOffline}
        />
      )}
      {organisation != null && source != null && (
        <CalendarFeed
          key={organisation.id}
          open={feed}
          onClose={() => setFeed(false)}
          opener={subscribeRef}
          phone={kind === 'phone'}
          upright={kind === 'tabletPortrait'}
          organisationName={organisation.name}
          source={source}
        />
      )}
    </AppFrame>
  );
}

function CalendarOf({
  organisationId,
  creates,
  kind,
  heading,
  onOffline,
}: {
  organisationId: string;
  creates: boolean;
  kind: LayoutKind;
  heading: RefObject<TextHandle | null>;
  onOffline: (offline: ScreenOffline) => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const big = useAccessibilitySizes();
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const locale = dateLocale();
  const firstDay = firstDayOfWeek(locale);
  const [zone] = useState(readerZone);
  const [today] = useState(() => wallDay(serverClock.now(), zone));

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState<CalendarView | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [show, setShow] = useState<CalendarShow>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [lastDay, setLastDay] = useState<string | null>(null);
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

  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(heading.current),
  });

  useHandOffline(onOffline, { stale, refreshing });

  useEffect(() => {
    let live = true;
    const land = (kept: ReturnType<typeof readCalendarPlace>) => {
      setView((was) => was ?? kept?.view ?? 'month');
      setAt((was) => was ?? (kept == null ? today : landingOf(kept.month, today)));
    };

    AsyncStorage.getItem(KEPT).then(
      (read) => live && land(readCalendarPlace(read)),
      () => live && land(null),
    );

    return () => {
      live = false;
    };
  }, [today]);

  useEffect(() => {
    let live = true;

    watch(api.allEvents(organisationId)).then(
      (events) => live && setLoad({ kind: 'loaded', events }),
      (error: unknown) => live && setLoad((was) => afterFailedLoad(was, error, { kind: 'failed' })),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt, refresh, watch]);

  const choices = useMemo<ShowChoice<CalendarShow>[]>(
    () => [
      { value: 'all', word: t('calendar.showAll') },
      { value: 'events', word: t('calendar.showEvents') },
    ],
    [t],
  );
  const agendaWords = useMemo(
    () => ({
      emptyDay: t('calendar.emptyDay'),
      emptyMonth: (month: { year: number; month: number }) =>
        t('calendar.emptyMonth', { month: monthName(month, locale) }),
    }),
    [t, locale],
  );
  const events = useMemo(() => (load.kind === 'loaded' ? load.events.map(calEventOf) : []), [load]);
  const days = useMemo(() => calendarDays(events, show), [events, show]);
  const weeks = useMemo(
    () => weeksAround(monthOfDay(today), firstDay, days),
    [today, firstDay, days],
  );
  const look = lookOf(big, phone);
  const offsets = useMemo(() => offsetsOf(weeks, look.week), [weeks, look]);
  const entries = useMemo(() => agendaOf(monthOfDay(today), days, today), [today, days]);
  const startIndex = weekIndexOf(weeks, at ?? today);
  const topWeek = weeks[top ?? startIndex];
  const pinned =
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
      KEPT,
      keptCalendarPlace({ view, month: monthOfDay(`${pinnedKey}-01`) }),
    ).catch(() => undefined);
  }, [view, at, pinnedKey]);

  const loaded = load.kind === 'loaded';
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
    if (view === 'agenda') scrollAgenda(today, true);
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
  const toShow = (next: CalendarShow) => {
    if (next === show) return;
    setAt(view === 'agenda' ? landingOf(pinned, today) : (topWeek?.start ?? today));
    setTop(null);
    setAgendaTop(null);
    setShow(next);
  };
  const retry = () => {
    void rereadOrganisations();
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
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

  const bottom = tokens.space3xl;
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
    loaded && view === 'month' && emptyMonth(pinned, days)
      ? t('calendar.emptyMonth', { month: monthWords })
      : null;
  const line =
    load.kind === 'loading' ? (
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
  const dayList = (
    <DayList
      day={lastDay ?? today}
      today={today}
      items={items}
      emptyWords={t('calendar.emptyDay')}
      locale={locale}
      readerZone={zone}
      big={big}
      onOpen={openItem}
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
        <EventsFirstRun
          wide={!phone}
          onCreate={creates ? () => router.push('/events/new') : undefined}
        />
      </ScrollView>
    );
  else if (load.kind === 'failed')
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
          full={false}
          onPress={retry}
          testID="calendar.retry"
        />
      </View>
    );
  else if (load.kind === 'loading')
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
        land={landingIn(entries, at, today)}
        today={today}
        words={agendaWords}
        locale={locale}
        readerZone={zone}
        big={big}
        lead={big ? 68 : phone ? 44 : 56}
        maxWidth={phone ? null : 640}
        bottom={bottom}
        scrollRef={agendaRef}
        onOpen={openItem}
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
            {open != null && dayList}
          </SidePanel>
        )}
      </View>
    );

  return (
    <View style={[styles.page, PAGE[kind]]}>
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
            {loaded && lastDay != null && dayList}
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
            {loaded && lastDay != null && dayList}
          </CentredDialog>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1 },
  beside: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
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

const PAGE: Record<LayoutKind, { paddingHorizontal: number }> = {
  phone: { paddingHorizontal: tokens.spaceXxl },
  tabletPortrait: { paddingHorizontal: tokens.space4xl },
  tabletLandscape: { paddingHorizontal: 30 },
};
