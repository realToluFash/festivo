import type { Milestone } from './timeline.ts';

export type CalendarView = 'month' | 'agenda';

export type CalendarShow = 'all' | 'events';

export const CALENDAR_SHOWS: readonly CalendarShow[] = ['all', 'events'];

/** A calendar month, `month` counted from 1. */
export interface CalendarMonth {
  year: number;
  month: number;
}

export interface CalendarEvent {
  id: string;
  startsAt: string;
  timeZone: string;
  dayCount: number;
  milestones: readonly Milestone[];
}

export type CalendarItem<E extends CalendarEvent> =
  | { kind: 'event'; event: E; day: string; first: boolean; last: boolean; multiDay: boolean }
  | { kind: 'milestone'; event: E; milestone: Milestone; day: string };

export interface CalendarCell<E extends CalendarEvent> {
  day: string;
  inMonth: boolean;
  /** Multi-day events in the lane they hold across the week, a gap where another day's lane is, then the rest. */
  slots: (CalendarItem<E> | null)[];
  items: CalendarItem<E>[];
}

/** The calendar day in `timeZone`, `2026-11-14`: each date sits on its event's own day, never the reader's (sc-98). */
export function wallDay(moment: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(typeof moment === 'string' ? new Date(moment) : moment);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDays(day: string, count: number): string {
  const date = dayDate(day);

  date.setUTCDate(date.getUTCDate() + count);

  return date.toISOString().slice(0, 10);
}

export function monthOfDay(day: string): CalendarMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

export function shiftMonth({ year, month }: CalendarMonth, count: number): CalendarMonth {
  const index = year * 12 + month - 1 + count;

  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function inMonth(day: string, { year, month }: CalendarMonth): boolean {
  return day.startsWith(`${year}-${String(month).padStart(2, '0')}-`);
}

/** A day as a moment at its midnight in UTC, so `Intl` with `timeZone: 'UTC'` writes that day whatever the reader's zone. */
export function dayDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function calendarDays<E extends CalendarEvent>(
  events: readonly E[],
  show: CalendarShow,
): Map<string, CalendarItem<E>[]> {
  const days = new Map<string, Ranked<E>[]>();
  const add = (day: string, ranked: Ranked<E>) => {
    const items = days.get(day) ?? [];

    items.push(ranked);
    days.set(day, items);
  };

  for (const event of events) {
    const first = wallDay(event.startsAt, event.timeZone);
    const count = Math.max(1, event.dayCount);
    const starts = new Date(event.startsAt).getTime();

    for (let index = 0; index < count; index++) {
      const day = addDays(first, index);

      add(day, {
        rank: count > 1 ? 0 : 1,
        time: starts,
        name: event.id,
        item: {
          kind: 'event',
          event,
          day,
          first: index === 0,
          last: index === count - 1,
          multiDay: count > 1,
        },
      });
    }

    if (show === 'events') continue;

    for (const milestone of event.milestones) {
      const day = wallDay(milestone.at, event.timeZone);

      add(day, {
        rank: 2,
        time: new Date(milestone.at).getTime(),
        name: milestone.title,
        item: { kind: 'milestone', event, milestone, day },
      });
    }
  }

  return new Map(
    [...days].map(([day, ranked]) => [
      day,
      ranked
        .sort((a, b) => a.rank - b.rank || a.time - b.time || a.name.localeCompare(b.name))
        .map(({ item }) => item),
    ]),
  );
}

/** The weeks a month grid shows, each starting on `firstDay` (0 Sunday to 6 Saturday), with a multi-day event in one lane across its week. */
export function monthGrid<E extends CalendarEvent>(
  month: CalendarMonth,
  firstDay: number,
  days: ReadonlyMap<string, CalendarItem<E>[]>,
): CalendarCell<E>[][] {
  const first = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
  const lead = (dayDate(first).getUTCDay() - firstDay + 7) % 7;
  const weeks: CalendarCell<E>[][] = [];

  for (let start = addDays(first, -lead); weeks.length === 0 || inMonth(start, month);) {
    const week = Array.from({ length: 7 }, (_, index) => addDays(start, index));

    weeks.push(laidOut(week, month, days));
    start = addDays(start, 7);
  }

  return weeks;
}

/** The first `fit` slots a cell has room for, and how many items did not fit. */
export function cellShown<E extends CalendarEvent>(
  cell: CalendarCell<E>,
  fit: number,
): { shown: (CalendarItem<E> | null)[]; more: number } {
  const aligned = [...cell.slots];

  while (aligned.length > 0 && aligned[aligned.length - 1] == null) aligned.pop();

  if (aligned.length <= fit) return { shown: aligned, more: 0 };

  const shown = cell.items.slice(0, fit);

  return { shown, more: cell.items.length - shown.length };
}

export function agendaDays<E extends CalendarEvent>(
  month: CalendarMonth,
  days: ReadonlyMap<string, CalendarItem<E>[]>,
): { day: string; items: CalendarItem<E>[] }[] {
  return [...days]
    .filter(([day, items]) => inMonth(day, month) && items.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items }));
}

export function namesBar(day: string, first: boolean, firstDay: number): boolean {
  return first || dayDate(day).getUTCDay() === firstDay;
}

const SUNDAY_FIRST = new Set(
  'AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
    ' ',
  ),
);

const SATURDAY_FIRST = new Set('AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' '));

const LIKELY_REGION: Record<string, string> = { en: 'US', es: 'ES', fr: 'FR', pt: 'BR' };

/** The locale's first day of the week as CLDR has it, 0 Sunday to 6 Saturday; `Intl.Locale`'s week info where the engine has it. */
export function firstDayOfWeek(locale: string): number {
  let parsed: Intl.Locale | null = null;

  try {
    parsed = new Intl.Locale(locale);
  } catch {
    parsed = null;
  }

  const weekInfo =
    (parsed as WithWeekInfo | null)?.getWeekInfo?.() ?? (parsed as WithWeekInfo | null)?.weekInfo;

  if (weekInfo?.firstDay != null) return weekInfo.firstDay % 7;

  const language = parsed?.language ?? locale.split('-')[0] ?? 'en';
  const region = parsed?.region ?? maximisedRegion(parsed) ?? LIKELY_REGION[language] ?? 'US';

  return SUNDAY_FIRST.has(region) ? 0 : SATURDAY_FIRST.has(region) ? 6 : 1;
}

export function weekdayNames(
  locale: string,
  firstDay: number,
  weekday: 'long' | 'short' | 'narrow',
): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday, timeZone: 'UTC' });
  const aSunday = '2026-11-01';

  return Array.from({ length: 7 }, (_, index) =>
    format.format(dayDate(addDays(aSunday, firstDay + index))),
  );
}

export interface CalendarPlace {
  view: CalendarView;
  month: CalendarMonth;
}

export function readCalendarPlace(kept: string | null): CalendarPlace | null {
  if (kept == null) return null;

  try {
    const read: unknown = JSON.parse(kept);

    if (typeof read !== 'object' || read == null) return null;

    const { view, month } = read as { view?: unknown; month?: unknown };

    if ((view !== 'month' && view !== 'agenda') || typeof month !== 'string') return null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;

    return { view, month: monthOfDay(`${month}-01`) };
  } catch {
    return null;
  }
}

export function keptCalendarPlace({ view, month }: CalendarPlace): string {
  return JSON.stringify({ view, month: `${month.year}-${String(month.month).padStart(2, '0')}` });
}

interface Ranked<E extends CalendarEvent> {
  rank: number;
  time: number;
  name: string;
  item: CalendarItem<E>;
}

interface WithWeekInfo {
  getWeekInfo?: () => { firstDay?: number };
  weekInfo?: { firstDay?: number };
}

function maximisedRegion(locale: Intl.Locale | null): string | undefined {
  try {
    return locale?.maximize().region;
  } catch {
    return undefined;
  }
}

function laidOut<E extends CalendarEvent>(
  week: string[],
  month: CalendarMonth,
  days: ReadonlyMap<string, CalendarItem<E>[]>,
): CalendarCell<E>[] {
  const lanes = new Map<string, number>();
  const taken: Set<number>[] = week.map(() => new Set());

  week.forEach((day, at) => {
    for (const item of days.get(day) ?? []) {
      if (item.kind !== 'event' || !item.multiDay || lanes.has(item.event.id)) continue;

      let lane = 0;
      const span = week
        .slice(at)
        .findIndex(
          (later) =>
            !(days.get(later) ?? []).some(
              (one) => one.kind === 'event' && one.event.id === item.event.id,
            ),
        );
      const reach = span === -1 ? week.length : at + span;

      while (taken.slice(at, reach).some((lanesTaken) => lanesTaken.has(lane))) lane++;
      for (let index = at; index < reach; index++) taken[index]?.add(lane);
      lanes.set(item.event.id, lane);
    }
  });

  return week.map((day) => {
    const items = days.get(day) ?? [];
    const multi = items.filter((item) => item.kind === 'event' && item.multiDay);
    const rest = items.filter((item) => !(item.kind === 'event' && item.multiDay));
    const width = Math.max(-1, ...multi.map((item) => lanes.get(item.event.id) ?? 0)) + 1;
    const slots: (CalendarItem<E> | null)[] = Array.from({ length: width }, () => null);

    for (const item of multi) slots[lanes.get(item.event.id) ?? 0] = item;

    return { day, inMonth: inMonth(day, month), slots: [...slots, ...rest], items };
  });
}
