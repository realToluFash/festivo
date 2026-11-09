import {
  type CalendarCell,
  type CalendarItem,
  type CalendarMonth,
  type CalendarShow,
  type CalendarView,
  type Milestone,
  addDays,
  agendaDays,
  calendarDays,
  dayDate,
  formatEventClock,
  formatWallDay,
  levelOf,
  monthGrid,
  monthOfDay,
  namesZone,
  shiftMonth,
  wallDay,
} from '@soirely/domain';

import { type Shown, dayCount, eventHref, shownEvent } from '../events/EventsModel.ts';
import { CLOCKS, EVENTS, READER_ZONE, REUNION, type SampleEvent } from '../events/EventsSample.ts';
import { W, say as eventSay } from '../events/EventsWords.ts';
import { CW, say } from './CalendarWords.ts';
import type { RowTag } from '../../components/SummaryRows.tsx';

export interface CalEvent extends Shown {
  dayCount: number;
  milestones: readonly Milestone[];
  permissions: readonly string[];
}

export type Show = CalendarShow | 'needs';

export const SHOWS: readonly Show[] = ['all', 'events', 'needs'];

export const NOW = new Date(CLOCKS.reader);

export type Item = CalendarItem<CalEvent>;
export type Cell = CalendarCell<CalEvent>;
export type Days = ReadonlyMap<string, Item[]>;

export interface Week {
  start: string;
  cells: Cell[];
}

export const CALENDAR_STATES = [
  'populated',
  'agenda',
  'showMenu',
  'eventsOnly',
  'busyDay',
  'monthEdge',
  'otherZone',
  'emptyMonth',
  'none',
  'loading',
  'failed',
  'subscribe',
  'subscribeRefused',
  'resetLink',
  'needsMenu',
  'needsMonth',
  'needsDay',
  'needsAgenda',
  'needsEmptyMonth',
  'needsEmptyDay',
  'needsReadOnly',
  'needsTodayEmpty',
] as const;

export type CalendarState = (typeof CALENDAR_STATES)[number];

export function calendarStateOf(value: string | undefined): CalendarState | null {
  return CALENDAR_STATES.find((state) => state === value) ?? null;
}

export type Load = 'loading' | 'failed' | 'loaded';
export type Feed = 'panel' | 'refused' | 'reset';
export type NeedsSeed = 'owner' | 'readOnly' | 'todayEmpty';

export interface Start {
  view: CalendarView | null;
  at: string | null;
  show: Show;
  open: string | null;
  menu: boolean;
  feed: Feed | null;
  load: Load;
  needs: NeedsSeed | null;
}

export function startOf(state: CalendarState | null, today: string): Start {
  const start: Start = {
    view: null,
    at: null,
    show: 'all',
    open: null,
    menu: false,
    feed: null,
    load: 'loaded',
    needs: null,
  };
  const needs: Start = { ...start, view: 'month', at: today, show: 'needs', needs: 'owner' };

  switch (state) {
    case 'populated':
      return { ...start, view: 'month', at: today };
    case 'agenda':
      return { ...start, view: 'agenda', at: today };
    case 'showMenu':
      return { ...start, show: 'events', menu: true };
    case 'eventsOnly':
      return { ...start, show: 'events' };
    case 'busyDay':
      return { ...start, view: 'month', at: today, open: '2026-11-14' };
    case 'monthEdge':
      return { ...start, view: 'month', at: '2026-11-15' };
    case 'otherZone':
      return { ...start, view: 'month', at: '2026-10-04', open: '2026-10-10' };
    case 'emptyMonth':
      return { ...start, view: 'month', at: '2027-02-01' };
    case 'loading':
    case 'failed':
      return { ...start, load: state };
    case 'subscribe':
      return { ...start, feed: 'panel' };
    case 'subscribeRefused':
      return { ...start, feed: 'refused' };
    case 'resetLink':
      return { ...start, feed: 'reset' };
    case 'needsMenu':
      return { ...needs, menu: true };
    case 'needsMonth':
      return needs;
    case 'needsDay':
      return { ...needs, open: today };
    case 'needsAgenda':
      return { ...needs, view: 'agenda' };
    case 'needsEmptyMonth':
      return { ...needs, at: '2026-12-01' };
    case 'needsEmptyDay':
      return { ...needs, open: '2026-11-14' };
    case 'needsReadOnly':
      return { ...needs, needs: 'readOnly', open: '2026-11-04' };
    case 'needsTodayEmpty':
      return { ...needs, view: 'agenda', needs: 'todayEmpty' };
    default:
      return start;
  }
}

export function sampleOf(state: CalendarState | null): readonly SampleEvent[] {
  if (state === 'none') return [];

  return state === 'monthEdge' ? [...EVENTS, REUNION] : EVENTS;
}

export function datesOf(event: Shown): Milestone[] {
  const own = { note: null, owner: 'event', area: 'events', action: null } as const;

  if (event.calledOff && event.concludedAt != null)
    return [{ ...own, at: event.concludedAt, title: say.calledOff(event.name) }];

  const starts = { ...own, at: event.startsAt, title: eventSay.starts(event.name) };

  if (dayCount(event) < 2) return [starts];

  return [
    starts,
    { ...own, at: event.concludedAt ?? event.endsAt, title: eventSay.ends(event.name) },
  ];
}

const AREAS = ['events', 'seating', 'vendors', 'budget', 'menu'] as const;

interface Owed {
  event: string;
  at: string;
  title: string;
  area: (typeof AREAS)[number];
}

const OWED: readonly Owed[] = [
  { event: 'evt-wed-4', at: '2026-11-02T23:59:00Z', title: 'Agree the toasts', area: 'seating' },
  { event: 'evt-wed-4', at: '2026-11-03T09:00:00Z', title: 'Confirm the cake', area: 'vendors' },
  {
    event: 'evt-wed-4',
    at: '2026-11-03T23:59:00Z',
    title: 'Pay the band’s balance',
    area: 'budget',
  },
  { event: 'evt-wed-4', at: '2026-11-04T12:00:00Z', title: 'Confirm the florist', area: 'vendors' },
  {
    event: 'evt-wed-4',
    at: '2026-11-04T18:00:00Z',
    title: 'Send the seating plan to the venue',
    area: 'seating',
  },
  {
    event: 'evt-wed-4',
    at: '2026-11-04T23:59:00Z',
    title: 'Give final numbers to the kitchen',
    area: 'menu',
  },
  {
    event: 'evt-wed-4',
    at: '2026-11-04T23:59:00Z',
    title: 'Seat the last 12 guests',
    area: 'seating',
  },
  {
    event: 'evt-gala-4',
    at: '2026-11-09T17:00:00Z',
    title: 'Pay the venue’s deposit',
    area: 'budget',
  },
  {
    event: 'evt-gala-4',
    at: '2026-11-10T11:00:00Z',
    title: 'Seat the patrons’ tables',
    area: 'seating',
  },
  {
    event: 'evt-ireti-2',
    at: '2026-11-11T23:59:00Z',
    title: 'Give final numbers to the kitchen',
    area: 'menu',
  },
];

/** The Owner changes every area but only reads the gala's seating; the read-only reader reads everything. */
export function heldOn(eventId: string, seed: NeedsSeed | null): string[] {
  if (seed === 'readOnly') return AREAS.map((area) => `${area}.read`);

  return AREAS.map((area) =>
    eventId === 'evt-gala-4' && area === 'seating' ? `${area}.read` : `${area}.manage`,
  );
}

/** The kitchen sheet is the web's (sc-3914), so the app's kitchen milestones carry no action. */
function owedOn(id: string, timeZone: string, seed: NeedsSeed, today: string): Milestone[] {
  return OWED.filter(
    (one) => one.event === id && !(seed === 'todayEmpty' && wallDay(one.at, timeZone) === today),
  ).map(({ at, title, area }) => ({ at, title, note: null, owner: 'you', area, action: null }));
}

/** The You milestones come only with the needs* states, as Today's are seeded, so every other state keeps its sample. */
export function calendarEvents(
  events: readonly SampleEvent[],
  now: Date,
  seed: NeedsSeed | null = null,
): CalEvent[] {
  const today = wallDay(now, READER_ZONE);

  return events.map((event) => {
    const shown = shownEvent(event, now);
    const owed = seed == null ? [] : owedOn(event.id, event.timeZone, seed, today);

    return {
      ...shown,
      dayCount: dayCount(event),
      milestones: [...datesOf(shown), ...owed],
      permissions: heldOn(event.id, seed),
    };
  });
}

const titles = new Intl.Collator('en');

function atOf(item: Item): number {
  return Date.parse(item.kind === 'milestone' ? item.milestone.at : item.event.startsAt);
}

/** Only what needs you: the You milestones whose area the reader changes, each on its event's own day, by time then title as Today's rows. */
export function needsDays(events: readonly CalEvent[]): Days {
  const days = new Map<string, Item[]>();

  for (const event of events)
    for (const milestone of event.milestones) {
      if (milestone.owner !== 'you' || levelOf(event.permissions, milestone.area) !== 'change')
        continue;
      const day = wallDay(milestone.at, event.timeZone);
      days.set(day, [...(days.get(day) ?? []), { kind: 'milestone', event, milestone, day }]);
    }

  for (const items of days.values())
    items.sort((a, b) => atOf(a) - atOf(b) || titles.compare(rowTitle(a), rowTitle(b)));

  return days;
}

export function daysOf(events: readonly CalEvent[], show: Show): Days {
  return show === 'needs' ? needsDays(events) : calendarDays(events, show);
}

export function isYou(item: Item): boolean {
  return item.kind === 'milestone' && item.milestone.owner === 'you';
}

/** Overdue is said only under Only what needs you, on the row's own day. */
export function overdueIn(item: Item, show: Show, now: Date = NOW): boolean {
  return show === 'needs' && item.kind === 'milestone' && atOf(item) <= now.getTime();
}

/** Where Today and Agenda land under needs: the day asked for when it holds a row, else the month's next that does, else its last, else its empty line. */
export function needsLanding(days: Days, from: string): string {
  const month = monthOfDay(from);
  const held = agendaDays(month, days).map(({ day }) => day);

  return held.find((day) => day >= from) ?? held.at(-1) ?? `month-${monthKey(month)}`;
}

export function needsWhen(item: Item, locale: string, now: Date = NOW): string {
  const when = rowWhen(item, locale);

  return overdueIn(item, 'needs', now) ? say.timeThen(when, CW.overdue) : when;
}

export function needsLabel(item: Item, locale: string, now: Date = NOW): string {
  const words = overdueIn(item, 'needs', now) ? say.needsRowLabelOverdue : say.needsRowLabel;

  return words(rowTitle(item), item.event.name, rowWhen(item, locale));
}

export function monthLine(
  load: Load,
  show: Show,
  month: CalendarMonth,
  days: Days,
  name: string,
): string | null {
  if (load !== 'loaded' || !emptyMonth(month, days)) return null;

  return show === 'needs' ? say.emptyNeedsMonth(name) : say.emptyMonth(name);
}

export function dayLine(load: Load, show: Show, items: readonly Item[]): string | null {
  if (load !== 'loaded' || items.length > 0) return null;

  return show === 'needs' ? CW.emptyNeedsDay : CW.emptyDay;
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
  | { kind: 'mark'; item: Extract<Item, { kind: 'milestone' }>; lane: number; col: number };

function sameEvent(item: Item | null | undefined, id: string): boolean {
  return item?.kind === 'event' && item.event.id === id;
}

/** What a week draws: each bar once across the days it holds in its lane, and each day's other items in their slots. */
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
export function offRule(event: Shown): RowTag | null {
  if (event.phase === 'draft') return { kind: 'notyet', word: W.draft };
  if (event.phase === 'paused') return { kind: 'paused', word: W.paused };
  if (event.calledOff) return { kind: 'ended', word: W.calledOff };
  if (event.phase === 'finished') return { kind: 'ended', word: W.finished };

  return null;
}

export type BarLook = 'tint' | 'draft' | 'sunk';

export function barLook(event: Shown): BarLook {
  if (event.calledOff || event.phase === 'finished') return 'sunk';

  return event.phase === 'draft' ? 'draft' : 'tint';
}

/** On a wide day the word follows the name; on the phone it leads where the bar holds two days, and a one-day bar keeps its mark and name. */
export function barWords(event: Shown, wide: boolean, columns: number): string {
  const off = offRule(event);

  if (off == null) return event.name;
  if (wide) return say.barStatus(event.name, off.word);

  return columns >= 2 ? say.barStatusFirst(off.word, event.name) : event.name;
}

export function clockOf(item: Item, locale: string): string {
  const at = item.kind === 'event' ? item.event.startsAt : item.milestone.at;

  return formatEventClock(at, item.event.timeZone, locale);
}

export function markWords(
  item: Extract<Item, { kind: 'milestone' }>,
  wide: boolean,
  locale: string,
) {
  const time = clockOf(item, locale);

  return wide ? `${time} ${item.milestone.title}` : time;
}

export function rowWhen(item: Item, locale: string): string {
  const time = clockOf(item, locale);
  const when = namesZone(item.event.timeZone, READER_ZONE)
    ? say.timeInZone(time, item.event.timeZone)
    : time;

  if (item.kind !== 'event' || !item.multiDay) return when;

  const first = wallDay(item.event.startsAt, item.event.timeZone);
  const range = say.range(
    formatWallDay(first, locale),
    formatWallDay(addDays(first, item.event.dayCount - 1), locale),
  );

  return `${when} · ${range}`;
}

export function rowTitle(item: Item): string {
  return item.kind === 'event' ? item.event.name : item.milestone.title;
}

/** An event opens its page; a milestone its action's link, or else its event's dates, which the demo's Schedule stands for. */
export function itemHref(item: Item): string {
  if (item.kind === 'event') return eventHref(item.event.id);

  return item.milestone.action?.link ?? eventHref(item.event.id, { area: 'schedule' });
}

export function itemKey(item: Item): string {
  return item.kind === 'event'
    ? `event-${item.event.id}`
    : `milestone-${item.event.id}-${item.milestone.at}`;
}

function format(locale: string, options: Intl.DateTimeFormatOptions, day: string): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(dayDate(day));
}

export function dayLabel(day: string, today: string, count: number, locale: string): string {
  const date = format(locale, { weekday: 'long', month: 'long', day: 'numeric' }, day);

  return say.dayWithItems(day === today ? say.todayDay(date) : date, count);
}

export function dayHeading(day: string, today: string, locale: string): string {
  const date = format(locale, { weekday: 'long', month: 'short', day: 'numeric' }, day);

  return day === today ? say.todayDay(date) : date;
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

/** Under needs, an empty today has no heading and a month with no rows says so. */
export function agendaOf(
  month: CalendarMonth,
  days: Days,
  today: string,
  show: Show = 'all',
  reach = REACH_MONTHS,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  const needs = show === 'needs';

  for (let shift = -reach; shift <= reach; shift++) {
    const each = shiftMonth(month, shift);
    const listed = agendaDays(each, days);

    if (!needs && monthKey(each) === today.slice(0, 7) && !listed.some(({ day }) => day === today))
      listed.push({ day: today, items: [] });
    if (listed.length === 0 && !needs) continue;

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
