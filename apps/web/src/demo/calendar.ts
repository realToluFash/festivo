import {
  type CalendarCell,
  type CalendarItem,
  type CalendarMonth,
  type CalendarShow,
  type CalendarView,
  type Milestone,
  addDays,
  agendaDays,
  calledOff,
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

import { CLOCKS, type SampleEvent, type Shown, localTime, phaseWord, shownOf } from './events.ts';
import type { DemoLink } from './settings.ts';

export const READER_ZONE = 'Europe/London';

export const TODAY = wallDay(CLOCKS.rest, READER_ZONE);

export const KEPT = 'soirely.calendar';

export const ROWS = 3;

const WEEK_TOP = 36;
const ROW = 26;
const MORE_LINE = 19;
const WEEK_FOOT = 8;
const QUIET_WEEK = 72;

export interface Listed extends SampleEvent {
  dayCount: number;
  milestones: readonly Milestone[];
  shown: Shown;
}

export type Item = CalendarItem<Listed>;
export type EventItem = Extract<Item, { kind: 'event' }>;
export type MarkItem = Extract<Item, { kind: 'milestone' }>;
export type Cell = CalendarCell<Listed>;

export const CAL_WORDS = {
  title: 'Calendar',
  previous: 'Previous',
  next: 'Next',
  today: 'Today',
  todayDay: (day: string) => `Today, ${day}`,
  dayWithItems: (day: string, count: number) =>
    count === 1 ? `${day}, 1 item` : `${day}, ${count} items`,
  view: 'View',
  month: 'Month',
  agenda: 'Agenda',
  show: 'Show',
  showAll: 'Events and milestones',
  showEvents: 'Events only',
  chosen: (name: string, word: string) => `${name}: ${word}`,
  close: 'Close',
  timeInZone: (time: string, zone: string) => `${time} ${zone}`,
  range: (from: string, to: string) => `${from} to ${to}`,
  loading: 'Loading the calendar…',
  failed: 'The calendar did not load. Check your connection, then try again. Nothing has changed.',
  retry: 'Try again',
  emptyMonth: (month: string) => `Nothing on the calendar in ${month}.`,
  emptyDay: 'Nothing on this day.',
  starts: (name: string) => `${name} starts`,
  ends: (name: string) => `${name} ends`,
  calledOff: (name: string) => `${name} called off`,
  event: 'Event',
  allDates: 'All dates',
  more: (count: number) => `+${count} more`,
  barStatus: (name: string, status: string) => `${name} · ${status}`,
  barLabel: (name: string, status: string, time: string, days: string) =>
    `${name}, ${status}, ${time}, ${days}`,
  markLabel: (title: string, time: string) => `${title}, ${time}`,
  allDatesComing: 'All dates for this event are coming.',
} as const;

const W = CAL_WORDS;

/** The API's EventDayCount: the days its start and end fall on in its zone, an end at midnight closing the day before. */
export function dayCountOf({ startsAt, endsAt, timeZone }: SampleEvent): number {
  const first = dayDate(wallDay(startsAt, timeZone)).getTime();
  const last = dayDate(wallDay(endsAt, timeZone)).getTime();
  const midnight =
    Date.parse(endsAt) > Date.parse(startsAt) && localTime(endsAt, timeZone) === '00:00';

  return Math.max(1, Math.round((last - first) / 86_400_000) + (midnight ? 0 : 1));
}

/** The API's EventDates: its start, its end when it runs over more than one day, or the moment it was called off. */
export function milestonesOf(event: SampleEvent): Milestone[] {
  const made = (at: string, title: string): Milestone => ({
    at,
    title,
    note: null,
    owner: 'event',
    area: 'events',
    action: null,
  });

  if (calledOff(event) && event.concludedAt != null)
    return [made(event.concludedAt, W.calledOff(event.name))];

  const dates = [made(event.startsAt, W.starts(event.name))];

  if (dayCountOf(event) > 1)
    dates.push(made(event.concludedAt ?? event.endsAt, W.ends(event.name)));

  return dates;
}

export function listedOf(events: readonly SampleEvent[], now: Date): Listed[] {
  return events.map((event) => ({
    ...event,
    dayCount: dayCountOf(event),
    milestones: milestonesOf(event),
    shown: shownOf(event, now),
  }));
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
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];

  for (let month = from; monthIndex(month) <= monthIndex(to); month = shiftMonth(month, 1)) {
    const listed = agendaDays(month, days);

    if (inMonth(today, month) && !listed.some(({ day }) => day === today))
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

/** Where Tab enters Agenda (sc-31222): the first day with a row on or after the day the list was sent to, else the last one. */
export function agendaStop(entries: readonly AgendaEntry[], from: string): AgendaEntry | undefined {
  const listed = entries.filter((entry) => entry.items.length > 0);

  return listed.find((entry) => entry.day >= from) ?? listed.at(-1);
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

export function dayLabel(day: string, count: number, locale: string): string {
  const date = written(day, locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const named = day === TODAY ? W.todayDay(date) : date;

  return count === 0 ? named : W.dayWithItems(named, count);
}

export function dayTitle(day: string, locale: string): string {
  return written(day, locale, { weekday: 'long', day: 'numeric', month: 'short' });
}

export function agendaLabel(day: string, locale: string): string {
  const title = dayTitle(day, locale);

  return day === TODAY ? W.todayDay(title) : title;
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

export function timeOf(event: Listed, moment: string, locale: string): string {
  const time = formatEventClock(moment, event.timeZone, locale);

  return namesZone(event.timeZone, READER_ZONE) ? W.timeInZone(time, event.timeZone) : time;
}

export function daysOf(item: EventItem, locale: string): string {
  const first = wallDay(item.event.startsAt, item.event.timeZone);

  return item.multiDay
    ? W.range(
        formatWallDay(first, locale),
        formatWallDay(addDays(first, item.event.dayCount - 1), locale),
      )
    : formatWallDay(first, locale);
}

export function rowLine(item: Item, locale: string): string {
  if (item.kind === 'milestone') return timeOf(item.event, item.milestone.at, locale);

  const time = timeOf(item.event, item.event.startsAt, locale);

  return item.multiDay ? `${time} · ${daysOf(item, locale)}` : time;
}

/** Live is the rule: every other status is a word on the bar and a mark before it. */
export function barOffRule(shown: Shown): boolean {
  return shown !== 'live' && shown !== 'happening_now';
}

export function barWords(event: Listed): string {
  return barOffRule(event.shown) ? W.barStatus(event.name, phaseWord(event.shown)) : event.name;
}

export function barLabel(item: EventItem, locale: string): string {
  return W.barLabel(
    item.event.name,
    phaseWord(item.event.shown),
    timeOf(item.event, item.event.startsAt, locale),
    daysOf(item, locale),
  );
}

export function markWords(item: MarkItem, locale: string): string {
  return `${formatEventClock(item.milestone.at, item.event.timeZone, locale)} ${item.milestone.title}`;
}

export function markLabel(item: MarkItem, locale: string): string {
  return W.markLabel(item.milestone.title, timeOf(item.event, item.milestone.at, locale));
}

/** An event opens its page; a milestone its action's link, or else its event's All dates. */
export function itemLink(item: Item): string {
  return item.kind === 'event'
    ? `/demo/events/${item.event.id}`
    : (item.milestone.action?.link ?? `/demo/events/${item.event.id}/dates`);
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

export const FEED_LINK =
  'https://soirely.app/api/calendar-feeds/pV3kQ8sLm2Xr7TnB0cYw5Hd9JfAe4GuZ1oKi6bRtNqM.ics';

export const NEW_FEED_LINK =
  'https://soirely.app/api/calendar-feeds/Xc7Rt2LwQ9mB4kZp1VyN8sHd3JfGe6TuA0oKi5bWnEq.ics';

export const FEED_WORDS = {
  open: 'Subscribe in your calendar app',
  close: 'Close',
  intro: (organisation: string) =>
    `Events and milestones from ${organisation} show in Google Calendar, Apple Calendar or Outlook, and stay up to date when a date moves. Your calendar app checks for changes every few hours.`,
  linkLabel: 'Your private link',
  copy: 'Copy link',
  copied: 'Copied',
  copiedAnnounce: 'Link copied.',
  copyRefused: 'Could not copy here. The link is selected: press Ctrl+C or Command+C.',
  openInApp: 'Open in calendar app',
  openedInApp: 'In Soirely, this opens your calendar app with the link.',
  private:
    'Keep this link to yourself. Anyone who has it can see these events’ names, times and venues.',
  inTitle: 'What’s in it',
  inFeed: [
    'Each event’s name and status word',
    'Its start and end, in its own time zone',
    'The venue line',
    'Milestone titles, with a link back to Soirely',
  ],
  outTitle: 'Never in it',
  neverInFeed: ['Guest names', 'Contact details', 'Dietary notes', 'Amounts of money'],
  access:
    'It shows only what you can see in Soirely. If you leave the organisation or lose access, the link stops working.',
  resetTitle: 'Shared it by mistake?',
  resetBody: 'Reset the link and the old one stops working straight away.',
  reset: 'Reset link',
  resetOpen: 'Reset link…',
  confirmTitle: 'Reset your link?',
  confirmBody:
    'The current link stops working at once. Any calendar subscribed with it stops updating, and you’ll need to subscribe again with the new link.',
  keep: 'Keep this link',
  kept: 'Link unchanged.',
  newLink: 'New link made. The old one has stopped working, so subscribe again with this one.',
} as const;

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
] as const;

export type CalendarState = (typeof CALENDAR_STATES)[number];

export function calendarStateOf(value: string | null): CalendarState | null {
  return CALENDAR_STATES.find((state) => state === value) ?? null;
}

export type Feed = 'open' | 'refused' | 'reset';

export interface CalendarStart {
  view: CalendarView;
  at: string;
  show: CalendarShow;
  menu: boolean;
  open: string | null;
  reunion: boolean;
  none: boolean;
  load: 'loading' | 'failed' | 'loaded';
  feed: Feed | null;
}

const AT_REST: CalendarStart = {
  view: 'month',
  at: TODAY,
  show: 'all',
  menu: false,
  open: null,
  reunion: false,
  none: false,
  load: 'loaded',
  feed: null,
};

const STARTS: Record<CalendarState, Partial<CalendarStart>> = {
  populated: {},
  agenda: { view: 'agenda' },
  showMenu: { show: 'events', menu: true },
  eventsOnly: { show: 'events' },
  busyDay: { open: '2026-11-14' },
  monthEdge: { reunion: true, at: '2026-11-15' },
  otherZone: { at: '2026-10-04', open: '2026-10-10' },
  emptyMonth: { at: '2027-02-01' },
  none: { none: true },
  loading: { load: 'loading' },
  failed: { load: 'failed' },
  subscribe: { feed: 'open' },
  subscribeRefused: { feed: 'refused' },
  resetLink: { feed: 'reset' },
};

export function calendarStart(state: CalendarState | null, kept: string | null): CalendarStart {
  if (state != null) return { ...AT_REST, ...STARTS[state] };

  const place = readCalendarPlace(kept);

  if (place == null) return AT_REST;

  return {
    ...AT_REST,
    view: place.view,
    at: inMonth(TODAY, place.month) ? TODAY : firstOf(place.month),
  };
}

const at = (state: CalendarState, name: string): DemoLink => ({
  to: `/demo/calendar?state=${state}`,
  name,
});

export const CALENDAR_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The weeks and Agenda',
    states: [
      at('populated', 'At rest, this week'),
      at('busyDay', 'A busy day open, with +2 more'),
      at('agenda', 'Agenda, on today'),
      at('showMenu', 'Show’s menu, Events only chosen'),
      at('eventsOnly', 'Events only'),
      at('monthEdge', 'A multi-day event across a month’s edge'),
      at('otherZone', 'An event in another zone, on its own day'),
      at('emptyMonth', 'An empty month'),
    ],
  },
  {
    name: 'No events, loading and failing',
    states: [
      at('none', 'No events yet'),
      at('loading', 'Loading'),
      at('failed', 'Failed, with Try again'),
    ],
  },
  {
    name: 'Subscribe in your calendar app',
    states: [
      at('subscribe', 'Subscribe'),
      at('subscribeRefused', 'Subscribe, a refused copy'),
      at('resetLink', 'Reset your link?'),
    ],
  },
  {
    name: 'Choosing from a day',
    states: [
      { to: '/demo/events/evt-gala-4', name: 'An event: the gala' },
      { to: '/demo/events/evt-ireti-2/dates', name: 'A milestone: Ireti at 40 ends, All dates' },
    ],
  },
];
