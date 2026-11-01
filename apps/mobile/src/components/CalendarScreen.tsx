import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ListedEvent } from '@soirely/api-client';
import {
  addDays,
  agendaDays,
  CALENDAR_SHOWS,
  type CalendarCell,
  type CalendarItem,
  type CalendarMonth,
  type CalendarPlace,
  type CalendarShow,
  type CalendarView,
  calendarDays,
  cellShown,
  dayDate,
  firstDayOfWeek,
  formatEventClock,
  formatWallDay,
  keptCalendarPlace,
  monthGrid,
  monthOfDay,
  namesBar,
  namesZone,
  PHASE_LOOK,
  readCalendarPlace,
  roleHolds,
  serverClock,
  shiftMonth,
  wallDay,
  weekdayNames,
} from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { PHASE_WORD } from '../kit/makeLive.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { EventState, EventsFailed, NoEvents } from './Events.tsx';
import { Screen, useBroughtIntoViewOn } from './Screen.tsx';
import { Sheet } from './Sheet.tsx';
import { useReadOut } from './ReadOut.tsx';
import { type TextHandle, Text } from './Text.tsx';

const KEPT = 'soirely.calendar';

const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const SHOW_WORD: Record<CalendarShow, string> = {
  all: 'calendar.showAll',
  events: 'calendar.showEvents',
};

const OWNER_WORD = {
  event: 'timeline.owner_event',
  you: 'timeline.owner_you',
  automatic: 'timeline.owner_automatic',
} as const;

const OWNER_SHAPE = { event: '▦', you: '●', automatic: '→' } as const;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; events: ListedEvent[] };

type Item = CalendarItem<ListedEvent>;

/** Calendar, `Calendar-*` (sc-3625): the organisation's events and their milestones, by month or by day. */
export function CalendarScreen() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const reads = organisation != null && roleHolds(organisation, 'events.read');

  if (organisation != null && !reads) return <Redirect href={DESTINATION_HREF.home} />;

  return (
    <AppFrame current="calendar" title={t('calendar.title')}>
      {organisation != null && (
        <CalendarOf
          key={organisation.id}
          organisationId={organisation.id}
          creates={roleHolds(organisation, 'events.create')}
          kind={kind}
        />
      )}
    </AppFrame>
  );
}

function CalendarOf({
  organisationId,
  creates,
  kind,
}: {
  organisationId: string;
  creates: boolean;
  kind: LayoutKind;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const today = wallDay(serverClock.now(), readerZone());
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [kept, setKept] = useState<CalendarPlace | null>(null);
  const [show, setShow] = useState<CalendarShow>('all');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [todayAsked, setTodayAsked] = useState(0);
  const opener = useRef<ViewInstance>(null);
  const view: CalendarView = kept?.view ?? (phone ? 'agenda' : 'month');
  const month: CalendarMonth = kept?.month ?? monthOfDay(today);

  useEffect(() => {
    let live = true;

    AsyncStorage.getItem(KEPT).then(
      (read) => live && setKept((before) => before ?? readCalendarPlace(read)),
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;

    api.allEvents(organisationId).then(
      (events) => live && setLoad({ kind: 'loaded', events }),
      () => live && setLoad({ kind: 'failed' }),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt]);

  const keep = (place: CalendarPlace) => {
    setKept(place);
    setOpenDay(null);
    void AsyncStorage.setItem(KEPT, keptCalendarPlace(place)).catch(() => undefined);
  };
  const closeDay = () => setOpenDay(null);

  if (load.kind === 'loaded' && load.events.length === 0) {
    return (
      <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
        <NoEvents
          kind={kind}
          createLabel={t('eventsScreen.newEvent')}
          onCreate={creates ? () => router.push('/events/new') : undefined}
        />
      </Screen>
    );
  }

  const days = load.kind === 'loaded' ? calendarDays(load.events, show) : new Map<string, Item[]>();
  const firstDay = firstDayOfWeek(locale);
  const openItems = openDay == null ? [] : (days.get(openDay) ?? []);
  const dayList =
    openDay == null ? null : (
      <DayList day={openDay} today={today} items={openItems} onClose={closeDay} />
    );

  return (
    <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
      <Toolbar
        phone={phone}
        month={month}
        view={view}
        show={show}
        onMonth={(next) => keep({ view, month: next })}
        onToday={() => {
          keep({ view, month: monthOfDay(today) });
          setTodayAsked((n) => n + 1);
        }}
        onView={(next) => keep({ view: next, month })}
        onShow={setShow}
      />
      {load.kind === 'loading' && (
        <View style={cardFrame(kind)}>
          <Text size={tokens.typeBodyPhone.size} muted accessibilityRole="text">
            {t('calendar.loading')}
          </Text>
        </View>
      )}
      {load.kind === 'failed' && (
        <EventsFailed
          words={t('calendar.failed')}
          onRetry={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
          testID="calendar.retry"
        />
      )}
      {load.kind === 'loaded' && view === 'month' && (
        <View style={landscape && openDay != null ? styles.split : styles.stack}>
          <MonthGrid
            weeks={monthGrid(month, firstDay, days)}
            firstDay={firstDay}
            phone={phone}
            today={today}
            opener={opener}
            openDay={openDay}
            onOpen={setOpenDay}
          />
          {landscape && dayList != null && (
            <View style={[cardFrame(kind), styles.panel]}>{dayList}</View>
          )}
        </View>
      )}
      {load.kind === 'loaded' && view === 'agenda' && (
        <Agenda
          kind={kind}
          month={month}
          days={agendaDays(month, days)}
          today={today}
          todayAsked={todayAsked}
        />
      )}
      {!landscape && (
        <Sheet
          open={openDay != null}
          onClose={closeDay}
          scrimLabel={t('calendar.close')}
          opener={opener}
          testID="calendar.daySheet"
        >
          {dayList}
        </Sheet>
      )}
    </Screen>
  );
}

function Toolbar({
  phone,
  month,
  view,
  show,
  onMonth,
  onToday,
  onView,
  onShow,
}: {
  phone: boolean;
  month: CalendarMonth;
  view: CalendarView;
  show: CalendarShow;
  onMonth: (month: CalendarMonth) => void;
  onToday: () => void;
  onView: (view: CalendarView) => void;
  onShow: (show: CalendarShow) => void;
}) {
  const { t } = useTranslation();
  const shownMonth = monthName(month, dateLocale());

  useReadOut(shownMonth, { quietAtMount: true });

  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarRow}>
        <Step
          label={t('calendar.previous')}
          glyph="‹"
          onPress={() => onMonth(shiftMonth(month, -1))}
          testID="calendar.previous"
        />
        <SecondaryButton label={t('calendar.today')} onPress={onToday} testID="calendar.today" />
        <Step
          label={t('calendar.next')}
          glyph="›"
          onPress={() => onMonth(shiftMonth(month, 1))}
          testID="calendar.next"
        />
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.monthName}
          testID="calendar.month"
        >
          {shownMonth}
        </Text>
      </View>
      <View style={[styles.toolbarRow, phone && styles.column]}>
        <Segments
          options={(['month', 'agenda'] as const).map((one) => ({
            value: one,
            word: t(one === 'month' ? 'calendar.month' : 'calendar.agenda'),
          }))}
          label={t('calendar.view')}
          chosen={view}
          onChoose={onView}
          testID="calendar.view"
        />
        <Segments
          options={CALENDAR_SHOWS.map((one) => ({ value: one, word: t(SHOW_WORD[one]) }))}
          label={t('calendar.show')}
          chosen={show}
          onChoose={onShow}
          testID="calendar.show"
        />
      </View>
    </View>
  );
}

function Step({
  label,
  glyph,
  onPress,
  testID,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      style={styles.step}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text size={tokens.typeTitleSection.size} weight="bold" {...HIDDEN}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function Segments<V extends string>({
  options,
  label,
  chosen,
  onChoose,
  testID,
}: {
  options: { value: V; word: string }[];
  label: string;
  chosen: V;
  onChoose: (value: V) => void;
  testID: string;
}) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(({ value, word }) => {
        const on = value === chosen;

        return (
          <Pressable
            key={value}
            style={[styles.segment, on && styles.segmentOn]}
            onPress={() => onChoose(value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            testID={`${testID}.${value}`}
          >
            <Text
              size={tokens.typeButton.size}
              weight="semibold"
              style={on ? styles.ink : styles.secondaryInk}
            >
              {word}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthGrid({
  weeks,
  firstDay,
  phone,
  today,
  opener,
  openDay,
  onOpen,
}: {
  weeks: CalendarCell<ListedEvent>[][];
  firstDay: number;
  phone: boolean;
  today: string;
  opener: RefObject<ViewInstance | null>;
  openDay: string | null;
  onOpen: (day: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const heads = weekdayNames(locale, firstDay, phone ? 'narrow' : 'short');

  return (
    <View style={styles.grid} testID="calendar.grid">
      <View style={styles.week} {...HIDDEN}>
        {heads.map((name, index) => (
          <Text key={index} size={tokens.typeMeta.size} weight="semibold" muted style={styles.head}>
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]?.day} style={styles.week}>
          {week.map((cell) => {
            const { shown, more } = cellShown(cell, phone ? 1 : 2);
            const isToday = cell.day === today;

            return (
              <Pressable
                key={cell.day}
                ref={cell.day === openDay ? opener : undefined}
                style={({ pressed }) => [
                  styles.cell,
                  phone && styles.cellPhone,
                  pressed && styles.pressed,
                ]}
                onPress={() => onOpen(cell.day)}
                accessibilityRole="button"
                accessibilityLabel={dayName(t, cell.day, today, cell.items.length, locale)}
                testID={`calendar.day.${cell.day}`}
              >
                <View {...HIDDEN} style={styles.cellInside}>
                  <View style={[styles.number, isToday && styles.numberToday]}>
                    <Text
                      size={tokens.typeMeta.size}
                      weight="semibold"
                      style={
                        isToday ? styles.onAccent : cell.inMonth ? styles.ink : styles.tertiaryInk
                      }
                    >
                      {dayDate(cell.day).getUTCDate()}
                    </Text>
                  </View>
                  {shown.map((item, index) =>
                    item == null ? (
                      <View key={`gap-${index}`} style={styles.bar} />
                    ) : (
                      <CellItem key={itemKey(item)} item={item} firstDay={firstDay} phone={phone} />
                    ),
                  )}
                  {more > 0 && (
                    <Text size={tokens.typeMeta.size} muted numberOfLines={1}>
                      {t('calendar.more', { count: more })}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function CellItem({ item, firstDay, phone }: { item: Item; firstDay: number; phone: boolean }) {
  const { t } = useTranslation();

  if (item.kind === 'milestone') {
    return (
      <Text size={tokens.typeMeta.size} numberOfLines={1}>
        {OWNER_SHAPE[item.milestone.owner]}{' '}
        {formatEventClock(item.milestone.at, item.event.timeZone, dateLocale())}
        {!phone && ` ${item.milestone.title}`}
      </Text>
    );
  }

  const tone = PHASE_LOOK[item.event.phase].tone;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: BAR[tone] },
        !item.first && styles.barCarried,
        !item.last && styles.barCarries,
      ]}
    >
      {namesBar(item.day, item.first, firstDay) && (
        <Text size={tokens.typeMeta.size} weight="semibold" numberOfLines={1}>
          {phone ? item.event.name : `${item.event.name} · ${t(PHASE_WORD[item.event.phase])}`}
        </Text>
      )}
    </View>
  );
}

function DayList({
  day,
  today,
  items,
  onClose,
}: {
  day: string;
  today: string;
  items: Item[];
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack} testID="calendar.dayList">
      <View style={styles.listHead}>
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.fill}
        >
          {day === today ? t('calendar.todayDay', { day: weekdayDay(day) }) : weekdayDay(day)}
        </Text>
        <QuietButton
          label={t('calendar.close')}
          onPress={onClose}
          testID="calendar.dayList.close"
        />
      </View>
      {items.length === 0 ? (
        <Text size={tokens.typeBody.size} muted>
          {t('calendar.emptyDay')}
        </Text>
      ) : (
        <Rows items={items} onLeave={onClose} />
      )}
    </View>
  );
}

function Agenda({
  kind,
  month,
  days,
  today,
  todayAsked,
}: {
  kind: LayoutKind;
  month: CalendarMonth;
  days: { day: string; items: Item[] }[];
  today: string;
  todayAsked: number;
}) {
  const { t } = useTranslation();
  const { shown, read } = useBroughtIntoViewOn<TextHandle>(todayAsked);
  const landing = (days.find(({ day }) => day >= today) ?? days.at(-1))?.day;

  if (days.length === 0) {
    return (
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeBody.size} muted>
          {t('calendar.emptyMonth', { month: monthName(month, dateLocale()) })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack} testID="calendar.agenda">
      {days.map(({ day, items }) => (
        <View key={day} ref={day === landing ? shown : undefined} style={styles.agendaDay}>
          <Text
            ref={day === landing ? read : undefined}
            size={tokens.typeTitleSection.size}
            weight="bold"
            accessibilityRole="header"
          >
            {day === today ? t('calendar.todayDay', { day: weekdayDay(day) }) : weekdayDay(day)}
          </Text>
          <View style={cardFrame(kind)}>
            <Rows items={items} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Rows({ items, onLeave }: { items: Item[]; onLeave?: () => void }) {
  return (
    <View role="list">
      {items.map((item, index) => (
        <Row key={itemKey(item)} item={item} first={index === 0} onLeave={onLeave} />
      ))}
    </View>
  );
}

/** A milestone opens its event's All dates: its action's link is the web's, and nowhere in the app is yet. */
function Row({
  item,
  first,
  onLeave,
}: {
  item: Item;
  first: boolean;
  onLeave?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const { event } = item;
  const locale = dateLocale();
  const at = item.kind === 'event' ? event.startsAt : item.milestone.at;
  const time = formatEventClock(at, event.timeZone, locale);
  const when = namesZone(event.timeZone, readerZone())
    ? t('calendar.timeInZone', { time, timeZone: event.timeZone })
    : time;
  const firstDay = wallDay(event.startsAt, event.timeZone);
  const range =
    item.kind === 'event' && item.multiDay
      ? t('calendar.range', {
          from: formatWallDay(firstDay, locale),
          to: formatWallDay(addDays(firstDay, event.dayCount - 1), locale),
        })
      : null;
  const href =
    item.kind === 'event'
      ? `/events/${encodeURIComponent(event.id)}`
      : `/events/${encodeURIComponent(event.id)}/dates`;

  return (
    <Pressable
      role="listitem"
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.pressed]}
      onPress={() => {
        onLeave?.();
        router.push(href);
      }}
      accessibilityRole="link"
      testID={`calendar.row.${itemKey(item)}`}
    >
      <View style={styles.rowMarks}>
        {item.kind === 'event' ? (
          <EventState phase={event.phase} />
        ) : (
          <View style={[styles.owner, item.milestone.owner === 'you' && styles.ownerYou]}>
            <Text
              size={tokens.typeSmall.size}
              weight="semibold"
              style={item.milestone.owner === 'you' ? styles.attentionInk : styles.secondaryInk}
            >
              {OWNER_SHAPE[item.milestone.owner]} {t(OWNER_WORD[item.milestone.owner])}
            </Text>
          </View>
        )}
        <Text size={tokens.typeSmall.size} muted>
          {range == null ? when : `${when} · ${range}`}
        </Text>
      </View>
      <Text size={tokens.typeRowTitle.size} weight="semibold">
        {item.kind === 'event' ? event.name : item.milestone.title}
      </Text>
    </Pressable>
  );
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function monthName({ year, month }: CalendarMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function weekdayDay(day: string): string {
  return new Intl.DateTimeFormat(dateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dayDate(day));
}

function dayName(t: TFunction, day: string, today: string, count: number, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dayDate(day));
  const named = day === today ? t('calendar.todayDay', { day: date }) : date;

  return count === 0 ? named : t('calendar.dayWithItems', { day: named, count });
}

function itemKey(item: Item): string {
  return item.kind === 'event'
    ? `event-${item.event.id}`
    : `milestone-${item.event.id}-${item.milestone.at}-${item.milestone.title}`;
}

const BAR = {
  accent: tokens.colorAccentTint,
  attention: tokens.colorAttentionTint,
  paused: tokens.colorPausedTint,
  broken: tokens.colorBrokenTint,
  neutral: tokens.colorNeutralFill,
} as const;

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  split: { flexDirection: 'row', gap: tokens.spaceXl, alignItems: 'flex-start' },
  panel: { width: tokens.sizePanel },
  fill: { flex: 1 },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  toolbar: { gap: tokens.spaceMd },
  toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  monthName: { flex: 1, minWidth: 120 },
  step: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusField,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  segments: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  segment: {
    flex: 1,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  segmentOn: { backgroundColor: tokens.colorCard },
  grid: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: tokens.radiusCardDesktop,
    backgroundColor: tokens.colorCard,
  },
  week: { flexDirection: 'row' },
  head: { flex: 1, paddingVertical: tokens.spaceSm, textAlign: 'center' },
  cell: {
    flex: 1,
    minHeight: 96,
    padding: tokens.spaceXxs,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: tokens.colorBorder,
  },
  cellPhone: { minHeight: 56, padding: 2 },
  cellInside: { gap: 2 },
  pressed: { backgroundColor: tokens.colorRowHover },
  number: {
    alignSelf: 'flex-start',
    minWidth: tokens.sizeMark,
    minHeight: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
  },
  numberToday: { backgroundColor: tokens.colorAccent },
  bar: {
    minHeight: tokens.sizePill,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: tokens.radiusSmall,
    overflow: 'hidden',
  },
  barCarried: { marginLeft: -tokens.spaceXxs, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  barCarries: {
    marginRight: -tokens.spaceXxs,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  agendaDay: { gap: tokens.spaceSm },
  row: {
    minHeight: 60,
    gap: tokens.spaceXxs,
    paddingVertical: tokens.spaceSm,
    justifyContent: 'center',
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  rowMarks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  owner: {
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: 2,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorNeutralFill,
  },
  ownerYou: { backgroundColor: tokens.colorAttentionTint },
  ink: { color: tokens.colorInk },
  secondaryInk: { color: tokens.colorInkSecondary },
  tertiaryInk: { color: tokens.colorInkTertiary },
  attentionInk: { color: tokens.colorAttentionText },
  onAccent: { color: tokens.colorInkOnDark },
});

const CONTENT: Record<LayoutKind, { gap: number; padding: number }> = {
  phone: { gap: tokens.spaceLg, padding: tokens.spaceXl },
  tabletPortrait: { gap: tokens.spaceXl, padding: tokens.space4xl },
  tabletLandscape: { gap: tokens.spaceXl, padding: tokens.space3xl },
};
