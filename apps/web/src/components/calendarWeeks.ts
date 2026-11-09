import {
  type CalendarCell,
  type CalendarEvent,
  type CalendarItem,
  type CalendarMonth,
  type CalendarPlace,
  addDays,
  agendaDays,
  dayDate,
  formatEventClock,
  formatWallDay,
  inMonth,
  monthGrid,
  monthOfDay,
  namesZone,
  readCalendarPlace,
  shiftMonth,
  wallDay,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type ReactNode, createContext } from 'react';

import { type Mesh } from '../mesh.ts';
import { type Shown, SHOWN_WORD } from './eventShown.ts';

export const KEPT = 'soirely.calendar';

export const ROWS = 3;

const WEEK_TOP = 36;
const ROW = 26;
const MORE_LINE = 19;
const WEEK_FOOT = 8;
const QUIET_WEEK = 72;

/** An event as the Calendar draws it: its days and dates, its phase as a list shows it, and its cover or colour. */
export interface CalEvent extends CalendarEvent {
  name: string;
  shown: Shown;
  mesh: Mesh;
  photo: boolean | string;
}

export type Item = CalendarItem<CalEvent>;
export type EventItem = Extract<Item, { kind: 'event' }>;
export type MarkItem = Extract<Item, { kind: 'milestone' }>;
export type Cell = CalendarCell<CalEvent>;

export function readKept(): CalendarPlace | null {
  try {
    return readCalendarPlace(window.localStorage.getItem(KEPT));
  } catch {
    return null;
  }
}

export function keep(place: string): boolean {
  try {
    window.localStorage.setItem(KEPT, place);

    return true;
  } catch {
    return false;
  }
}

export function itemKey(item: Item): string {
  return item.kind === 'event'
    ? `event|${item.event.id}`
    : `mark|${item.event.id}|${item.milestone.at}|${item.milestone.title}`;
}

/** The rows a day shows: every bar in the lane it holds across the week, and "+‹n› more" for the rest (main's cellShown re-packs instead). */
export function fitted(cell: Cell, fit = ROWS): { slots: (Item | null)[]; more: number } {
  const slots = [...cell.slots];

  while (slots.length > 0 && slots[slots.length - 1] == null) slots.pop();

  if (slots.length <= fit) return { slots, more: 0 };

  const kept = slots.slice(0, fit);

  return { slots: kept, more: cell.items.length - kept.filter((item) => item != null).length };
}

export interface Bar {
  kind: 'bar';
  key: string;
  item: EventItem;
  row: number;
  from: number;
  span: number;
  starts: boolean;
  ends: boolean;
}

export interface Mark {
  kind: 'mark';
  key: string;
  item: MarkItem;
  row: number;
  from: number;
}

export type Piece = Bar | Mark;

export interface WeekDay {
  day: string;
  count: number;
  more: number;
  keys: string[];
}

export interface Week {
  start: string;
  days: WeekDay[];
  pieces: Piece[];
  rows: number;
  over: boolean;
  height: number;
}

function eventOn(cell: Cell | undefined, id: string): EventItem | undefined {
  return cell?.items.find(
    (item): item is EventItem => item.kind === 'event' && item.event.id === id,
  );
}

export function weekOf(cells: readonly Cell[]): Week {
  const fits = cells.map((cell) => fitted(cell));
  const pieces: Piece[] = [];

  fits.forEach(({ slots }, at) => {
    slots.forEach((item, row) => {
      if (item == null) return;
      if (item.kind === 'milestone') {
        pieces.push({ kind: 'mark', key: itemKey(item), item, row, from: at });
        return;
      }
      if (at > 0 && !item.first) return;

      let span = 1;

      while (eventOn(cells[at + span], item.event.id) != null) span++;

      const last = eventOn(cells[at + span - 1], item.event.id) ?? item;

      pieces.push({
        kind: 'bar',
        key: itemKey(item),
        item,
        row,
        from: at,
        span,
        starts: item.first,
        ends: last.last,
      });
    });
  });

  const days = cells.map((cell, at) => {
    const fit = fits[at] ?? { slots: [], more: 0 };
    const shown = new Set(fit.slots.flatMap((item) => (item == null ? [] : [itemKey(item)])));

    return {
      day: cell.day,
      count: cell.items.length,
      more: fit.more,
      keys: cell.items.map(itemKey).filter((key) => shown.has(key)),
    };
  });
  const rows = Math.max(0, ...fits.map((fit) => fit.slots.length));
  const over = days.some((day) => day.more > 0);

  return {
    start: cells[0]?.day ?? '',
    days,
    pieces,
    rows,
    over,
    height: Math.max(QUIET_WEEK, WEEK_TOP + ROW * rows + (over ? MORE_LINE : 0) + WEEK_FOOT),
  };
}

export function monthIndex({ year, month }: CalendarMonth): number {
  return year * 12 + month - 1;
}

export function monthKey({ year, month }: CalendarMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function firstOf(month: CalendarMonth): string {
  return `${monthKey(month)}-01`;
}

export function sameMonth(a: CalendarMonth, b: CalendarMonth): boolean {
  return monthIndex(a) === monthIndex(b);
}

export function weekStart(day: string, firstDay: number): string {
  return addDays(day, -((dayDate(day).getUTCDay() - firstDay + 7) % 7));
}

export function weeksOf(
  from: CalendarMonth,
  to: CalendarMonth,
  firstDay: number,
  days: ReadonlyMap<string, Item[]>,
): Week[] {
  const weeks = new Map<string, Week>();

  for (let month = from; monthIndex(month) <= monthIndex(to); month = shiftMonth(month, 1)) {
    for (const cells of monthGrid(month, firstDay, days)) {
      const start = cells[0]?.day;

      if (start != null && !weeks.has(start)) weeks.set(start, weekOf(cells));
    }
  }

  return [...weeks.values()];
}

export function topsOf(weeks: readonly Week[]): number[] {
  let top = 0;

  return weeks.map((week) => {
    const at = top;
    top += week.height;

    return at;
  });
}

/** The pinned name: the month of the top week's last day. */
export function pinnedOf(
  weeks: readonly Week[],
  tops: readonly number[],
  scrollTop: number,
): CalendarMonth | null {
  let at = 0;

  tops.forEach((top, index) => {
    if (top <= scrollTop + 0.5) at = index;
  });

  const day = weeks[at]?.days[6]?.day;

  return day == null ? null : monthOfDay(day);
}

function monthOn(day: string, count: number): string {
  const month = shiftMonth(monthOfDay(day), count);
  const last = Number(addDays(firstOf(shiftMonth(month, 1)), -1).slice(8));

  return `${monthKey(month)}-${String(Math.min(Number(day.slice(8)), last)).padStart(2, '0')}`;
}

export function movedDay(day: string, key: string, firstDay: number): string | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(day, -1);
    case 'ArrowRight':
      return addDays(day, 1);
    case 'ArrowUp':
      return addDays(day, -7);
    case 'ArrowDown':
      return addDays(day, 7);
    case 'Home':
      return weekStart(day, firstDay);
    case 'End':
      return addDays(weekStart(day, firstDay), 6);
    case 'PageUp':
      return monthOn(day, -1);
    case 'PageDown':
      return monthOn(day, 1);
    default:
      return null;
  }
}

export interface AgendaEntry {
  day: string;
  items: Item[];
  turn: CalendarMonth | null;
  empty: boolean;
}

/** The same scroll as a list of days: each day with something on it, today even when it has nothing, and a line for a month with nothing. */
export function agendaOf(
  from: CalendarMonth,
  to: CalendarMonth,
  days: ReadonlyMap<string, Item[]>,
  today: string,
  withToday = true,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];

  for (let month = from; monthIndex(month) <= monthIndex(to); month = shiftMonth(month, 1)) {
    const listed = agendaDays(month, days);

    if (withToday && inMonth(today, month) && !listed.some(({ day }) => day === today))
      listed.push({ day: today, items: [] });
    listed.sort((a, b) => a.day.localeCompare(b.day));

    if (listed.length === 0)
      entries.push({ day: firstOf(month), items: [], turn: month, empty: true });
    listed.forEach(({ day, items }, index) =>
      entries.push({ day, items, turn: index === 0 ? month : null, empty: false }),
    );
  }

  return entries;
}

/** Where Tab enters Agenda (sc-31222): the first row on or after the day the list was sent to; sent past the last row, that last row. */
export function agendaStop(
  entries: readonly AgendaEntry[],
  from: string,
): { entry: AgendaEntry; row: number } | undefined {
  const listed = entries.filter((entry) => entry.items.length > 0);
  const next = listed.find((entry) => entry.day >= from);
  const last = listed.at(-1);

  if (next != null) return { entry: next, row: 0 };

  return last == null ? undefined : { entry: last, row: last.items.length - 1 };
}

export function monthHasItems(month: CalendarMonth, days: ReadonlyMap<string, Item[]>): boolean {
  return agendaDays(month, days).length > 0;
}

export function monthName(month: CalendarMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dayDate(firstOf(month)));
}

function written(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(dayDate(day));
}

export function dayLabel(
  t: TFunction,
  day: string,
  today: string,
  count: number,
  locale: string,
): string {
  const date = written(day, locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const named = day === today ? t('calendar.todayDay', { day: date }) : date;

  return count === 0 ? named : t('calendar.dayWithItems', { day: named, count });
}

export function dayTitle(day: string, locale: string): string {
  return written(day, locale, { weekday: 'long', day: 'numeric', month: 'short' });
}

export function agendaLabel(t: TFunction, day: string, today: string, locale: string): string {
  const title = dayTitle(day, locale);

  return day === today ? t('calendar.todayDay', { day: title }) : title;
}

export function dayNumber(day: string, locale: string): string {
  return written(day, locale, { day: 'numeric' });
}

export function monthEdge(day: string, locale: string): string {
  return written(day, locale, { month: 'short', day: 'numeric' });
}

export function weekdayShort(day: string, locale: string): string {
  return written(day, locale, { weekday: 'short' });
}

/** A time on the event's own clock, its zone named when the reader is elsewhere. */
export function timeOf(
  t: TFunction,
  event: CalEvent,
  moment: string,
  zone: string,
  locale: string,
): string {
  const time = formatEventClock(moment, event.timeZone, locale);

  return namesZone(event.timeZone, zone)
    ? t('calendar.timeInZone', { time, timeZone: event.timeZone })
    : time;
}

export function daysOf(t: TFunction, item: EventItem, locale: string): string {
  const first = wallDay(item.event.startsAt, item.event.timeZone);

  return item.multiDay
    ? t('calendar.range', {
        from: formatWallDay(first, locale),
        to: formatWallDay(addDays(first, item.event.dayCount - 1), locale),
      })
    : formatWallDay(first, locale);
}

export function rowLine(t: TFunction, item: Item, zone: string, locale: string): string {
  if (item.kind === 'milestone') return timeOf(t, item.event, item.milestone.at, zone, locale);

  const time = timeOf(t, item.event, item.event.startsAt, zone, locale);

  return item.multiDay ? `${time} · ${daysOf(t, item, locale)}` : time;
}

/** Live is the rule: every other status is a word on the bar and a mark before it. */
export function barOffRule(shown: Shown): boolean {
  return shown !== 'live' && shown !== 'happening_now';
}

export function barWords(t: TFunction, event: CalEvent): string {
  return barOffRule(event.shown)
    ? t('calendar.barStatus', { name: event.name, status: t(SHOWN_WORD[event.shown]) })
    : event.name;
}

export function barLabel(t: TFunction, item: EventItem, zone: string, locale: string): string {
  return t('calendar.barLabel', {
    name: item.event.name,
    status: t(SHOWN_WORD[item.event.shown]),
    time: timeOf(t, item.event, item.event.startsAt, zone, locale),
    days: daysOf(t, item, locale),
  });
}

export function markWords(item: MarkItem, locale: string): string {
  return `${formatEventClock(item.milestone.at, item.event.timeZone, locale)} ${item.milestone.title}`;
}

export function markLabel(t: TFunction, item: MarkItem, zone: string, locale: string): string {
  return t('calendar.markLabel', {
    title: item.milestone.title,
    time: timeOf(t, item.event, item.milestone.at, zone, locale),
  });
}

/** main's motionEase, cubic-bezier(0.2, 0, 0, 1), for the scroll Previous, Next and Today run. */
export function eased(progress: number): number {
  const curve = (at: number, one: number, two: number) =>
    3 * (1 - at) * (1 - at) * at * one + 3 * (1 - at) * at * at * two + at * at * at;
  let low = 0;
  let high = 1;

  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;

    if (curve(middle, 0.2, 0) < progress) low = middle;
    else high = middle;
  }

  return curve((low + high) / 2, 0, 1);
}

/** Where the Calendar is read from: today and the reader's zone, and where an item opens. */
export interface CalendarFrame {
  today: string;
  zone: string;
  linkOf: (item: Item) => string;
}

export const CalendarFrameContext = createContext<CalendarFrame>({
  today: '',
  zone: 'UTC',
  linkOf: () => '',
});

/** A narrower Show, such as the demo's Only what needs you: how its marks and rows read, its empty lines, and where Today lands. */
export interface CalendarLens {
  late: (item: MarkItem) => boolean;
  label: (item: MarkItem) => string;
  lines: (item: MarkItem) => ReactNode[];
  emptyDay: string;
  emptyMonth: (month: string) => string;
  landing: (days: ReadonlyMap<string, Item[]>, day: string) => string;
}
