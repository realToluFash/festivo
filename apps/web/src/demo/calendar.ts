import {
  type CalendarItem,
  type CalendarPlace,
  type CalendarView,
  type Milestone,
  calledOff,
  dayDate,
  inMonth,
  wallDay,
} from '@soirely/domain';

import { type Item as CalItem, firstOf } from '../components/calendarWeeks.ts';
import { type CardPhoto } from '../eventsList.ts';
import { CLOCKS, type SampleEvent, type Shown, localTime, shownOf } from './events.ts';
import type { DemoLink } from './settings.ts';

export const READER_ZONE = 'Europe/London';

export const TODAY = wallDay(CLOCKS.rest, READER_ZONE);

export interface Listed extends Omit<SampleEvent, 'photo'> {
  photo: CardPhoto | null;
  dayCount: number;
  milestones: readonly Milestone[];
  shown: Shown;
  permissions?: readonly string[];
}

export type Item = CalendarItem<Listed>;

/** The demo's own words: Only what needs you (sc-32803), and the dates its sample stands in for the API's. */
export const CAL_WORDS = {
  showNeedsYou: 'Only what needs you',
  emptyNeedsMonth: (month: string) => `Nothing needs you in ${month}.`,
  emptyNeedsDay: 'Nothing needs you on this day.',
  overdue: 'Overdue',
  needsRowLabel: (title: string, event: string, time: string) => `${title}, ${event}, ${time}`,
  needsRowLabelOverdue: (title: string, event: string, time: string) =>
    `${title}, ${event}, ${time}, overdue`,
  starts: (name: string) => `${name} starts`,
  ends: (name: string) => `${name} ends`,
  calledOff: (name: string) => `${name} called off`,
} as const;

const W = CAL_WORDS;

export type Show = 'all' | 'events' | 'needs';

export const SHOWS: readonly Show[] = ['all', 'events', 'needs'];

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
    photo: event.photo ? 'standIn' : null,
  }));
}

/** An event opens its page; a milestone its action's link, or else its event's All dates. */
export function itemLink(item: CalItem): string {
  return item.kind === 'event'
    ? `/demo/events/${item.event.id}`
    : (item.milestone.action?.link ?? `/demo/events/${item.event.id}/dates`);
}

export const FEED_LINK =
  'https://soirely.app/api/calendar-feeds/pV3kQ8sLm2Xr7TnB0cYw5Hd9JfAe4GuZ1oKi6bRtNqM.ics';

export const NEW_FEED_LINK =
  'https://soirely.app/api/calendar-feeds/Xc7Rt2LwQ9mB4kZp1VyN8sHd3JfGe6TuA0oKi5bWnEq.ics';

/** What Open in calendar app says in the demo, which follows no webcal link. */
export const OPENED_IN_APP = 'In Soirely, this opens your calendar app with the link.';

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

export function calendarStateOf(value: string | null): CalendarState | null {
  return CALENDAR_STATES.find((state) => state === value) ?? null;
}

export type Feed = 'open' | 'refused' | 'reset';

export type NeedsSeed = 'owner' | 'readOnly' | 'todayEmpty';

export interface CalendarStart {
  view: CalendarView;
  at: string;
  show: Show;
  menu: boolean;
  open: string | null;
  reunion: boolean;
  none: boolean;
  load: 'loading' | 'failed' | 'loaded';
  feed: Feed | null;
  needs: NeedsSeed | null;
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
  needs: null,
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
  needsMenu: { show: 'needs', menu: true, needs: 'owner' },
  needsMonth: { show: 'needs', needs: 'owner' },
  needsDay: { show: 'needs', needs: 'owner', open: TODAY },
  needsAgenda: { view: 'agenda', show: 'needs', needs: 'owner' },
  needsEmptyMonth: { show: 'needs', needs: 'owner', at: '2026-12-01' },
  needsEmptyDay: { show: 'needs', needs: 'owner', open: '2026-11-14' },
  needsReadOnly: { show: 'needs', needs: 'readOnly', open: '2026-11-04' },
  needsTodayEmpty: { view: 'agenda', show: 'needs', needs: 'todayEmpty' },
};

export function calendarStart(
  state: CalendarState | null,
  place: CalendarPlace | null,
): CalendarStart {
  if (state != null) return { ...AT_REST, ...STARTS[state] };
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
    name: 'Only what needs you',
    states: [
      at('needsMenu', 'Show’s menu, Only what needs you chosen'),
      at('needsMonth', 'Only what needs you, the month'),
      at('needsDay', 'Today open, one overdue'),
      at('needsAgenda', 'Agenda, on today'),
      at('needsEmptyMonth', 'A month with nothing for you'),
      at('needsEmptyDay', 'A day with events and nothing for you'),
      at('needsReadOnly', 'A reader who can only view'),
      at('needsTodayEmpty', 'Agenda with nothing today'),
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
