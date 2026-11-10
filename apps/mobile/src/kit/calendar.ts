import type { ListedEvent } from '@soirely/api-client';
import {
  type CalendarCell,
  type CalendarItem,
  type CalendarMonth,
  type Milestone,
  addDays,
  agendaDays,
  dayDate,
  formatEventClock,
  formatWallDay,
  monthGrid,
  monthOfDay,
  namesZone,
  shiftMonth,
  wallDay,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { RowTag } from '../components/SummaryRows.tsx';
import { type Shown, listEventOf, shownEvent } from './eventsList.ts';

export interface CalEvent extends Omit<Shown, 'milestones'> {
  milestones: readonly Milestone[];
  dayCount: number;
}

export type Item = CalendarItem<CalEvent>;
export type Cell = CalendarCell<CalEvent>;
export type Days = ReadonlyMap<string, Item[]>;
export type MilestoneItem = Extract<Item, { kind: 'milestone' }>;

export interface Week {
  start: string;
  cells: Cell[];
}

export function calEventOf(event: ListedEvent): CalEvent {
  return {
    ...shownEvent(listEventOf(event), event.phase),
    milestones: event.milestones,
    dayCount: event.dayCount,
  };
}

export const REACH_MONTHS = 24;

/** The weeks from `reach` months before `month` to `reach` after, one after another, each laid out by main's monthGrid. */
export function weeksAround(
  month: CalendarMonth,
  firstDay: number,
  days: Days,
  reach = REACH_MONTHS,
): Week[] {
  const weeks: Week[] = [];
  let last = '';

  for (let shift = -reach; shift <= reach; shift++) {
    for (const cells of monthGrid(shiftMonth(month, shift), firstDay, days)) {
      const start = cells[0]?.day ?? '';

      if (start <= last) continue;
      weeks.push({ start, cells });
      last = start;
    }
  }

  return weeks;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weekIndexOf(weeks: readonly Week[], day: string): number {
  const first = weeks[0];

  if (first == null) return 0;

  const index = Math.floor((dayDate(day).getTime() - dayDate(first.start).getTime()) / WEEK_MS);

  return Math.min(Math.max(index, 0), weeks.length - 1);
}

export function firstOf({ year, month }: CalendarMonth): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function monthKey({ year, month }: CalendarMonth): string {
  return firstOf({ year, month }).slice(0, 7);
}

export function landingOf(month: CalendarMonth, today: string): string {
  return monthKey(month) === today.slice(0, 7) ? today : firstOf(month);
}

/** The month the top week pins: its last day's, so it turns as the week holding the 1st reaches the top. */
export function pinnedOf(week: Week | undefined, fallback: CalendarMonth): CalendarMonth {
  const last = week?.cells[week.cells.length - 1]?.day;

  return last == null ? fallback : monthOfDay(last);
}

export function emptyMonth(month: CalendarMonth, days: Days): boolean {
  return agendaDays(month, days).length === 0;
}

/** The slots a day has room for, with each bar left in its lane; "+n more" counts every item not drawn. */
export function shownIn(cell: Cell, fit: number): { shown: (Item | null)[]; more: number } {
  const aligned = [...cell.slots];

  while (aligned.length > 0 && aligned[aligned.length - 1] == null) aligned.pop();

  const shown = aligned.slice(0, fit);

  return { shown, more: cell.items.length - shown.filter((item) => item != null).length };
}

export interface WeekLook {
  numH: number;
  numGap: number;
  rowH: number;
  gap: number;
  fit: number;
  moreH: number;
  padT: number;
  padB: number;
  minH: number;
}

export const PHONE_WEEK: WeekLook = {
  numH: 24,
  numGap: 3,
  rowH: 18,
  gap: 3,
  fit: 3,
  moreH: 17,
  padT: 4,
  padB: 6,
  minH: 52,
};

export const WIDE_WEEK: WeekLook = {
  numH: 26,
  numGap: 4,
  rowH: 22,
  gap: 4,
  fit: 3,
  moreH: 19,
  padT: 6,
  padB: 8,
  minH: 72,
};

export const BIG_WEEK: WeekLook = {
  numH: 36,
  numGap: 4,
  rowH: 14,
  gap: 4,
  fit: 2,
  moreH: 30,
  padT: 4,
  padB: 6,
  minH: 60,
};

export function rowsTop(look: WeekLook): number {
  return look.padT + look.numH + look.numGap;
}

export function weekHeight(week: Week, look: WeekLook): number {
  const days = week.cells.map((cell) => shownIn(cell, look.fit));
  const rows = Math.max(0, ...days.map((day) => day.shown.length));
  const over = days.some((day) => day.more > 0);

  return Math.max(
    look.minH,
    rowsTop(look) + rows * (look.rowH + look.gap) + (over ? look.moreH : 0) + look.padB,
  );
}

export function offsetsOf(weeks: readonly Week[], look: WeekLook): number[] {
  const offsets = [0];

  for (const week of weeks)
    offsets.push((offsets[offsets.length - 1] ?? 0) + weekHeight(week, look));

  return offsets;
}

export function topIndex(offsets: readonly number[], y: number): number {
  let low = 0;
  let high = Math.max(0, offsets.length - 2);

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);

    if ((offsets[middle] ?? 0) <= y + 1) low = middle;
    else high = middle - 1;
  }

  return low;
}

export type Piece =
  | {
      kind: 'bar';
      event: CalEvent;
      lane: number;
      from: number;
      to: number;
      first: boolean;
      last: boolean;
    }
  | { kind: 'mark'; item: MilestoneItem; lane: number; col: number };

function sameEvent(item: Item | null | undefined, id: string): boolean {
  return item?.kind === 'event' && item.event.id === id;
}

export function piecesOf(week: Week, fit: number): Piece[] {
  const pieces: Piece[] = [];
  const drawn = new Set<string>();

  week.cells.forEach((cell, col) => {
    shownIn(cell, fit).shown.forEach((item, lane) => {
      if (item == null) return;
      if (item.kind === 'milestone') {
        pieces.push({ kind: 'mark', item, lane, col });
        return;
      }
      if (drawn.has(item.event.id)) return;
      drawn.add(item.event.id);

      let to = col;
      while (sameEvent(week.cells[to + 1]?.slots[lane], item.event.id)) to++;
      const end = week.cells[to]?.slots[lane];

      pieces.push({
        kind: 'bar',
        event: item.event,
        lane,
        from: col,
        to,
        first: item.first,
        last: end?.kind === 'event' ? end.last : item.last,
      });
    });
  });

  return pieces;
}

/** Live is the rule and carries no word; every other phase has its shape and its word, as the Events list's tags. */
export function offRule(event: Shown, t: TFunction): RowTag | null {
  if (event.phase === 'draft') return { kind: 'notyet', word: t('eventsScreen.draft') };
  if (event.phase === 'paused') return { kind: 'paused', word: t('eventsScreen.paused') };
  if (event.calledOff) return { kind: 'ended', word: t('eventsScreen.calledOff') };
  if (event.phase === 'finished') return { kind: 'ended', word: t('eventsScreen.finished') };

  return null;
}

export type BarLook = 'tint' | 'draft' | 'sunk';

export function barLook(event: Shown): BarLook {
  if (event.calledOff || event.phase === 'finished') return 'sunk';

  return event.phase === 'draft' ? 'draft' : 'tint';
}

/** On a wide day the word follows the name; on the phone it leads where the bar holds two days, and a one-day bar keeps its mark and name. */
export function barWords(event: Shown, wide: boolean, columns: number, t: TFunction): string {
  const off = offRule(event, t);

  if (off == null) return event.name;
  if (wide) return t('calendar.barStatus', { name: event.name, status: off.word });

  return columns >= 2
    ? t('calendar.barStatusFirst', { name: event.name, status: off.word })
    : event.name;
}

export function isYou(item: Item): boolean {
  return item.kind === 'milestone' && item.milestone.owner === 'you';
}

export function clockOf(item: Item, locale: string): string {
  const at = item.kind === 'event' ? item.event.startsAt : item.milestone.at;

  return formatEventClock(at, item.event.timeZone, locale);
}

export function markWords(item: MilestoneItem, wide: boolean, locale: string) {
  const time = clockOf(item, locale);

  return wide ? `${time} ${item.milestone.title}` : time;
}

export function rowWhen(item: Item, locale: string, readerZone: string, t: TFunction): string {
  const time = clockOf(item, locale);
  const when = namesZone(item.event.timeZone, readerZone)
    ? t('calendar.timeInZone', { time, timeZone: item.event.timeZone })
    : time;

  if (item.kind !== 'event' || !item.multiDay) return when;

  const first = wallDay(item.event.startsAt, item.event.timeZone);
  const range = t('calendar.range', {
    from: formatWallDay(first, locale),
    to: formatWallDay(addDays(first, item.event.dayCount - 1), locale),
  });

  return t('calendar.timeAndRange', { time: when, range });
}

export function rowTitle(item: Item): string {
  return item.kind === 'event' ? item.event.name : item.milestone.title;
}

export function itemKey(item: Item): string {
  return item.kind === 'event'
    ? `event-${item.event.id}`
    : `milestone-${item.event.id}-${item.milestone.at}-${item.milestone.title}`;
}

function format(locale: string, options: Intl.DateTimeFormatOptions, day: string): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(dayDate(day));
}

export function dayLabel(
  day: string,
  today: string,
  count: number,
  locale: string,
  t: TFunction,
): string {
  const date = format(locale, { weekday: 'long', month: 'long', day: 'numeric' }, day);
  const named = day === today ? t('calendar.todayDay', { day: date }) : date;

  return count === 0 ? named : t('calendar.dayWithItems', { day: named, count });
}

export function dayHeading(day: string, today: string, locale: string, t: TFunction): string {
  const date = format(locale, { weekday: 'long', month: 'short', day: 'numeric' }, day);

  return day === today ? t('calendar.todayDay', { day: date }) : date;
}

export function monthName({ year, month }: CalendarMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function firstNamed(day: string, locale: string): string {
  return format(locale, { month: 'short', day: 'numeric' }, day);
}

export function dayNumber(day: string, locale: string): string {
  return format(locale, { day: 'numeric' }, day);
}

export function weekdayShort(day: string, locale: string): string {
  return format(locale, { weekday: 'short' }, day);
}

export type AgendaEntry =
  | { kind: 'month'; key: string; month: CalendarMonth }
  | { kind: 'empty'; key: string; month: CalendarMonth }
  | { kind: 'day'; key: string; day: string; items: Item[] };

/** Agenda's months, each named where it turns: today is listed even with nothing on it; `everyMonth` instead lists every month, an empty one with its line, and today only with something on it. */
export function agendaOf(
  month: CalendarMonth,
  days: Days,
  today: string,
  everyMonth = false,
  reach = REACH_MONTHS,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];

  for (let shift = -reach; shift <= reach; shift++) {
    const each = shiftMonth(month, shift);
    const listed = agendaDays(each, days);

    if (
      !everyMonth &&
      monthKey(each) === today.slice(0, 7) &&
      !listed.some(({ day }) => day === today)
    )
      listed.push({ day: today, items: [] });
    if (listed.length === 0 && !everyMonth) continue;

    entries.push({ kind: 'month', key: `month-${monthKey(each)}`, month: each });
    if (listed.length === 0)
      entries.push({ kind: 'empty', key: `empty-${monthKey(each)}`, month: each });
    for (const { day, items } of listed.sort((a, b) => a.day.localeCompare(b.day)))
      entries.push({ kind: 'day', key: day, day, items });
  }

  return entries;
}

/** The month Previous or Next goes to from `month`, the nearest with days listed where Agenda has none in between. */
export function agendaMonth(
  entries: readonly AgendaEntry[],
  month: CalendarMonth,
  step: -1 | 1,
): CalendarMonth | null {
  const here = monthKey(month);
  const months = entries.flatMap((entry) => (entry.kind === 'month' ? [entry.month] : []));
  const found =
    step === 1
      ? months.find((each) => monthKey(each) > here)
      : months.filter((each) => monthKey(each) < here).pop();

  return found ?? null;
}

/** Where Agenda lands as it opens: today, or the month asked for, or the next month listed after it. */
export function landingIn(
  entries: readonly AgendaEntry[],
  at: string | null,
  today: string,
): string {
  if (at == null || at === today) return today;
  const key = monthKey(monthOfDay(at));
  const found = entries.find((entry) => entry.kind === 'month' && monthKey(entry.month) >= key);

  return found?.key ?? today;
}
