import {
  type CalendarItem,
  type CalendarMonth,
  type CalendarShow,
  type CalendarView,
  type Milestone,
  agendaDays,
  calendarDays,
  monthOfDay,
  wallDay,
} from '@soirely/domain';
import { t } from 'i18next';

import {
  type AgendaEntry,
  type CalEvent as ProductCalEvent,
  type Days as ProductDays,
  type Item as ProductItem,
  agendaOf as productAgendaOf,
  barWords as productBarWords,
  dayHeading as productDayHeading,
  dayLabel as productDayLabel,
  monthKey,
  rowTitle,
  rowWhen as productRowWhen,
} from '../../kit/calendar.ts';
import { type Shown, dayCount, eventHref, shownEvent } from '../events/EventsModel.ts';
import { CLOCKS, EVENTS, READER_ZONE, REUNION, type SampleEvent } from '../events/EventsSample.ts';
import { say as eventSay } from '../events/EventsWords.ts';
import { needOrder, isYours } from '../today/needsYou.ts';
import { CW, say } from './CalendarWords.ts';

export {
  BIG_WEEK,
  PHONE_WEEK,
  WIDE_WEEK,
  type AgendaEntry,
  type Week,
  agendaMonth,
  emptyMonth,
  firstNamed,
  firstOf,
  landingIn,
  landingOf,
  monthKey,
  monthName,
  pinnedOf,
  piecesOf,
  shownIn,
  weekHeight,
  weekIndexOf,
  weeksAround,
} from '../../kit/calendar.ts';

export interface CalEvent extends Shown, ProductCalEvent {
  milestones: readonly Milestone[];
  permissions: readonly string[];
}

export type Show = CalendarShow | 'needs';

export const SHOWS: readonly Show[] = ['all', 'events', 'needs'];

export const NOW = new Date(CLOCKS.reader);

export type Item = CalendarItem<CalEvent>;
export type Days = ReadonlyMap<string, Item[]>;

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
  'noneAsk',
  'loading',
  'failed',
  'subscribe',
  'subscribeRefused',
  'subscribeLoading',
  'subscribeUnreadable',
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
    case 'subscribeLoading':
    case 'subscribeUnreadable':
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
  if (state === 'none' || state === 'noneAsk') return [];

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

function atOf(item: ProductItem): number {
  return Date.parse(item.kind === 'milestone' ? item.milestone.at : item.event.startsAt);
}

type NeedItem = Extract<Item, { kind: 'milestone' }>;

function keyOf({ event, milestone }: NeedItem) {
  return { at: milestone.at, title: milestone.title, startsAt: event.startsAt, name: event.name };
}

/** Only what needs you: Today's isYours milestones, each on its event's own day, in Today's needOrder. */
export function needsDays(events: readonly CalEvent[]): Days {
  const days = new Map<string, NeedItem[]>();

  for (const event of events)
    for (const milestone of event.milestones) {
      if (!isYours(milestone, event.permissions)) continue;
      const day = wallDay(milestone.at, event.timeZone);
      days.set(day, [...(days.get(day) ?? []), { kind: 'milestone', event, milestone, day }]);
    }

  for (const items of days.values()) items.sort((a, b) => needOrder(keyOf(a), keyOf(b)));

  return days;
}

export function daysOf(events: readonly CalEvent[], show: Show): Days {
  return show === 'needs' ? needsDays(events) : calendarDays(events, show);
}

/** Overdue is said only under Only what needs you, on the row's own day. */
export function overdueIn(item: ProductItem, show: Show, now: Date = NOW): boolean {
  return show === 'needs' && item.kind === 'milestone' && atOf(item) <= now.getTime();
}

/** Where Today and Agenda land under needs: the day asked for when it holds a row, else the month's next that does, else its last, else its empty line. */
export function needsLanding(days: ProductDays, from: string): string {
  const month = monthOfDay(from);
  const held = agendaDays(month, days).map(({ day }) => day);

  return held.find((day) => day >= from) ?? held.at(-1) ?? `month-${monthKey(month)}`;
}

export function rowWhen(item: ProductItem, locale: string): string {
  return productRowWhen(item, locale, READER_ZONE, t);
}

export function needsWhen(item: ProductItem, locale: string, now: Date = NOW): string {
  const when = rowWhen(item, locale);

  return overdueIn(item, 'needs', now) ? say.timeThen(when, CW.overdue) : when;
}

export function needsLabel(item: ProductItem, locale: string, now: Date = NOW): string {
  const words = overdueIn(item, 'needs', now) ? say.needsRowLabelOverdue : say.needsRowLabel;

  return words(rowTitle(item), item.event.name, rowWhen(item, locale));
}

/** The words the demo's board says for an empty day and an empty month, under each Show option. */
export function showWords(show: Show): { emptyDay: string; emptyMonth: (month: string) => string } {
  return show === 'needs'
    ? { emptyDay: CW.emptyNeedsDay, emptyMonth: say.emptyNeedsMonth }
    : {
        emptyDay: t('calendar.emptyDay'),
        emptyMonth: (month: string) => t('calendar.emptyMonth', { month }),
      };
}

export function barWords(event: Shown, wide: boolean, columns: number): string {
  return productBarWords(event, wide, columns, t);
}

export function dayLabel(day: string, today: string, count: number, locale: string): string {
  return productDayLabel(day, today, count, locale, t);
}

export function dayHeading(day: string, today: string, locale: string): string {
  return productDayHeading(day, today, locale, t);
}

/** Under needs, an empty today has no heading and a month with no rows says so. */
export function agendaOf(
  month: CalendarMonth,
  days: Days,
  today: string,
  show: Show = 'all',
  reach?: number,
): AgendaEntry[] {
  return productAgendaOf(month, days, today, show === 'needs', reach);
}

/** An event opens its page; a milestone its action's link, or else its event's dates, which the demo's Schedule stands for. */
export function itemHref(item: ProductItem): string {
  if (item.kind === 'event') return eventHref(item.event.id);

  return item.milestone.action?.link ?? eventHref(item.event.id, { area: 'schedule' });
}
