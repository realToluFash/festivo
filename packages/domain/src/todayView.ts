import { wallDay, weekLanes } from './calendar.ts';
import { shownPhase } from './eventStates.ts';
import { type Greeting, type TodayEvent, today } from './today.ts';
import type { Milestone } from './timeline.ts';

export type TodayKind = 'first' | 'day' | 'quiet' | 'plan';

export interface TodayStripDay<E extends TodayEvent> {
  day: string;
  today: boolean;
  dots: E[];
}

export interface TodayBar<E extends TodayEvent> {
  event: E;
  /** Its first day in the week shown, 0 for the reader's today. */
  start: number;
  span: number;
  /** Started before the week shown, so it runs in from the left edge and says which day it is on. */
  openLeft: boolean;
  dayToday: number;
  /** The row it is drawn in, 0 first: bars that share a day never share a row. */
  lane: number;
}

export type TodayAgendaItem<E extends TodayEvent> =
  | { kind: 'milestone'; event: E; milestone: Milestone }
  | {
      kind: 'starts' | 'continues' | 'ends';
      event: E;
      multiDay: boolean;
      day: number;
    };

export interface TodayAgendaDay<E extends TodayEvent> {
  day: string;
  today: boolean;
  daysAway: number;
  items: TodayAgendaItem<E>[];
}

export type TodayCount =
  | { kind: 'draft' }
  | { kind: 'dayOf'; day: number; total: number }
  /** Its first day is today and it has not started yet. A paused event past its first day counts `dayOf`. */
  | { kind: 'today' }
  | { kind: 'inDays'; days: number };

export interface TodayCard<E extends TodayEvent> {
  event: E;
  count: TodayCount;
  draft: boolean;
  live: boolean;
  finalWeek: boolean;
}

export interface TodayNow<E extends TodayEvent> {
  event: E;
  dayToday: number;
  lastDay: string;
  /** 0 when it ends today, 1 tomorrow. */
  endsIn: number;
}

/** The line under the greeting: the first event yet to start. */
export type TodaySub<E extends TodayEvent> =
  | { kind: 'first' }
  | { kind: 'nothingThisWeek' }
  | { kind: 'startsToday'; event: E }
  | { kind: 'startsOn'; event: E; day: string; withinWeek: boolean };

export interface TodayView<E extends TodayEvent> {
  kind: TodayKind;
  greeting: Greeting | 'welcome';
  on: string;
  days: TodayStripDay<E>[];
  bars: TodayBar<E>[];
  agenda: TodayAgendaDay<E>[];
  sub: TodaySub<E>;
  nextUp: { event: E; day: string; daysAway: number } | null;
  cards: TodayCard<E>[];
  now: TodayNow<E> | null;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86_400_000);
}

const FINAL_WEEK = 7;

function hourIn(now: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now),
  );
}

function firstDay(event: TodayEvent): string {
  return wallDay(event.startsAt, event.timeZone);
}

function lastDay(event: TodayEvent): string {
  return wallDay(event.endsAt, event.timeZone);
}

/** Today on both clients (sc-29090, sc-30413): which days, bars, cards and lines it shows, for each client to put into its own words. */
export function todayView<E extends TodayEvent>(
  loaded: { events: readonly E[]; at: Date },
  now: Date,
  reader: { timeZone: string; locale: string },
): TodayView<E> {
  const shown = today(loaded, now, { ...reader, hour: hourIn(now, reader.timeZone) });
  const on = wallDay(now, reader.timeZone);
  const first = loaded.events.length === 0;
  const empty = shown.week.every(({ items }) => items.length === 0);
  const kind: TodayKind = first ? 'first' : shown.now != null ? 'day' : empty ? 'quiet' : 'plan';
  const dayOf = (event: E, day: string) => daysBetween(firstDay(event), day) + 1;

  const lanes = weekLanes(shown.week.map(({ items }) => items));
  const bars: TodayBar<E>[] = [];
  for (const { items } of shown.week)
    for (const item of items) {
      if (item.kind !== 'event' || !item.multiDay) continue;
      if (bars.some((bar) => bar.event.id === item.event.id)) continue;

      const start = Math.max(0, daysBetween(on, firstDay(item.event)));
      const end = Math.min(shown.week.length - 1, daysBetween(on, lastDay(item.event)));

      bars.push({
        event: item.event,
        start,
        span: end - start + 1,
        openLeft: start === 0 && !item.first,
        dayToday: dayOf(item.event, on),
        lane: lanes.get(item.event.id) ?? 0,
      });
    }

  const covered = (id: string, index: number) =>
    bars.some((bar) => bar.event.id === id && index >= bar.start && index < bar.start + bar.span);
  const days = shown.week.map(({ day, today: isToday, items }, index) => ({
    day,
    today: isToday,
    dots: [...new Map(items.map((item) => [item.event.id, item.event])).values()].filter(
      (event) => !covered(event.id, index),
    ),
  }));

  const agenda = shown.week
    .filter(({ today: isToday, items }) => isToday || items.length > 0)
    .map(({ day, today: isToday, items }) => ({
      day,
      today: isToday,
      daysAway: daysBetween(on, day),
      items: items
        // The event's own start and end are Today's own rows; the timeline's copy of them would say each twice.
        .filter((item) => item.kind !== 'milestone' || item.milestone.owner !== 'event')
        .map((item): TodayAgendaItem<E> =>
          item.kind === 'milestone'
            ? { kind: 'milestone', event: item.event, milestone: item.milestone }
            : {
                kind: item.first ? 'starts' : item.last ? 'ends' : 'continues',
                event: item.event,
                multiDay: item.multiDay,
                day: dayOf(item.event, item.day),
              },
        ),
    }));

  const soonest = shown.events
    .filter(
      (event) =>
        event.status !== 'draft' &&
        event !== shown.now &&
        Date.parse(event.startsAt) > now.getTime(),
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const soonestDay = soonest == null ? null : firstDay(soonest);
  const sub: TodaySub<E> =
    kind === 'first'
      ? { kind: 'first' }
      : soonest == null || soonestDay == null
        ? { kind: 'nothingThisWeek' }
        : soonestDay === on
          ? { kind: 'startsToday', event: soonest }
          : {
              kind: 'startsOn',
              event: soonest,
              day: soonestDay,
              withinWeek: daysBetween(on, soonestDay) < shown.week.length,
            };

  const cards = shown.events.map((event): TodayCard<E> => {
    const until = daysBetween(on, firstDay(event));
    const draft = event.status === 'draft';
    const live = shownPhase(event, loaded.at, now) === 'happening_now';

    return {
      event,
      count: draft
        ? { kind: 'draft' }
        : live || until < 0
          ? { kind: 'dayOf', day: 1 - until, total: event.dayCount }
          : until === 0
            ? { kind: 'today' }
            : { kind: 'inDays', days: until },
      draft,
      live,
      finalWeek: !draft && !live && until > 0 && until <= FINAL_WEEK,
    };
  });

  const nextUpDay = shown.nextUp == null ? null : firstDay(shown.nextUp);

  return {
    kind,
    greeting: kind === 'first' ? 'welcome' : shown.greeting,
    on,
    days,
    bars,
    agenda,
    sub,
    nextUp:
      shown.nextUp == null || nextUpDay == null
        ? null
        : { event: shown.nextUp, day: nextUpDay, daysAway: daysBetween(on, nextUpDay) },
    cards,
    now:
      shown.now == null
        ? null
        : {
            event: shown.now,
            dayToday: dayOf(shown.now, on),
            lastDay: lastDay(shown.now),
            endsIn: daysBetween(on, lastDay(shown.now)),
          },
  };
}
