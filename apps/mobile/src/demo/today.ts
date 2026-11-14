import { greetingAt } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { writtenTime } from './clock.ts';
import { daysWords } from '../kit/eventsList.ts';
import {
  addDays,
  daysFrom,
  type EventCard,
  type MeshKey,
  type Moment,
  type MomentName,
  type Need,
  type Now,
  type ShownEvent,
  type StripBar,
  type StripDay,
} from '../kit/today.ts';
import { EVENT_OF_KEY as IDS } from './events/EventsSample.ts';
import { type Guests, SAMPLE_GUESTS } from './events/GuestCounts.ts';
import { needsOf, type YouEvent } from './today/needsYou.ts';

export type EventKey = 'wed' | 'ireti' | 'party' | 'draft';

export const MOMENTS: readonly MomentName[] = [
  'plan',
  'planNow',
  'day',
  'dayNow',
  'quiet',
  'first',
];

interface SampleEvent {
  name: string;
  first: string;
  last: string;
  place: string;
  draft: boolean;
  mesh: MeshKey;
}

export const EVENTS: Record<EventKey, SampleEvent> = {
  wed: {
    name: 'Adaeze & Tunde’s wedding',
    first: '2026-11-05',
    last: '2026-11-07',
    place: 'The Landmark, London',
    draft: false,
    mesh: 'rose',
  },
  ireti: {
    name: 'Ireti at 40',
    first: '2026-11-14',
    last: '2026-11-15',
    place: 'Hackney, London',
    draft: false,
    mesh: 'teal',
  },
  party: {
    name: 'Ire Events end-of-year party',
    first: '2026-11-28',
    last: '2026-11-28',
    place: 'Clerkenwell, London',
    draft: false,
    mesh: 'accent',
  },
  draft: {
    name: 'Bisi & Kola’s engagement',
    first: '2027-01-09',
    last: '2027-01-09',
    place: '',
    draft: true,
    mesh: 'amber',
  },
};

export function sample(key: EventKey): ShownEvent {
  return { id: key, name: EVENTS[key].name, mesh: EVENTS[key].mesh, photo: null };
}

/** Dates as `2026-11-03` and times as `18:00`, written the reader's way. */
export interface Say {
  locale: string;
  long(date: string): string;
  day(date: string, withYear?: boolean): string;
  weekday(date: string): string;
  weekdayLong(date: string): string;
  number(date: string): string;
  clock(time: string): string;
  hour(time: string): string;
}

export function sayIn(locale: string, thisYear = 2026): Say {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  const long = format({ weekday: 'long', month: 'long', day: 'numeric' });
  const day = format({ weekday: 'short', month: 'short', day: 'numeric' });
  const dayAndYear = format({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const weekday = format({ weekday: 'short' });
  const weekdayLong = format({ weekday: 'long' });
  const number = format({ day: 'numeric' });
  const at = (date: string) => new Date(`${date}T00:00Z`);

  return {
    locale,
    long: (date) => long.format(at(date)),
    day: (date, withYear = Number(date.slice(0, 4)) !== thisYear) =>
      (withYear ? dayAndYear : day).format(at(date)),
    weekday: (date) => weekday.format(at(date)),
    weekdayLong: (date) => weekdayLong.format(at(date)),
    number: (date) => number.format(at(date)),
    clock: (hhmm) => writtenTime(hhmm, locale),
    hour: (hhmm) => writtenTime(hhmm, locale),
  };
}

export function howFar(today: string, date: string): string {
  const days = daysFrom(today, date);

  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

type Item = readonly [time: string, title: string, event: EventKey, note: string];

const AGENDA: Record<
  Exclude<MomentName, 'first' | 'dayNow'>,
  readonly (readonly [string, Item[]])[]
> = {
  plan: [
    [
      '2026-11-03',
      [
        [
          '10:00',
          `Reminder goes to the ${owedOf('ireti')} who haven’t replied`,
          'ireti',
          'Automatic',
        ],
      ],
    ],
    ['2026-11-04', [['09:00', 'Meal choices close', 'wed', 'Automatic']]],
    ['2026-11-05', [['18:00', 'Welcome dinner', 'wed', 'Day 1 of 3']]],
    [
      '2026-11-06',
      [
        ['14:00', 'Ceremony', 'wed', 'Day 2 of 3'],
        ['23:59', 'Replies close', 'ireti', 'Automatic'],
      ],
    ],
    ['2026-11-07', [['11:00', 'Farewell brunch', 'wed', 'Day 3 of 3']]],
    ['2026-11-08', [['10:00', 'Thank-you messages go out', 'wed', 'Automatic']]],
  ],
  planNow: [
    ['2026-11-03', []],
    ['2026-11-05', [['18:00', 'The wedding starts', 'wed', 'Day 1 of 3']]],
    ['2026-11-06', [['', 'The wedding, day 2', 'wed', 'Day 2 of 3']]],
    ['2026-11-07', [['15:00', 'The wedding ends', 'wed', 'Day 3 of 3']]],
  ],
  day: [
    ['2026-11-06', []],
    [
      '2026-11-07',
      [
        ['11:00', 'Farewell brunch', 'wed', 'Day 3 of 3'],
        ['15:00', 'The wedding ends', 'wed', ''],
      ],
    ],
    ['2026-11-08', [['10:00', 'Thank-you messages go out', 'wed', 'Automatic']]],
    ['2026-11-12', [['09:00', 'Meal choices close', 'ireti', 'Automatic']]],
  ],
  quiet: [],
};

/** Built now, the agenda is the wedding's own dates still to come, as on a planning day. */
function builtNow(today: string): readonly (readonly [string, Item[]])[] {
  return [[today, []], ...AGENDA.planNow.filter(([date]) => date > today)];
}

/** To the nearest whole percent, except that 100% means everyone and 0% nobody (sc-29881). */
export function sharePercent(part: number, whole: number): number {
  if (part >= whole) return 100;
  if (part <= 0) return 0;

  return Math.min(99, Math.max(1, Math.round((part / whole) * 100)));
}

type GuestsOf = Readonly<Record<string, Guests>>;

/** `?invites=none`: the planning day before the end-of-year party's invitations have gone out. */
export const INVITES_NOT_SENT: GuestsOf = {
  ...SAMPLE_GUESTS,
  [IDS.party]: { invited: 0, coming: 0, replied: 0 },
};

/** sc-29881's line, from the guests Events' tiles count (sc-23284), so Today and Events agree. */
export function repliesOf(key: EventKey, sample: GuestsOf = SAMPLE_GUESTS): EventCard['ready'] {
  const guests = sample[IDS[key]];

  if (guests == null) return null;
  if (guests.invited === 0) return { words: 'Invitations not sent', percent: 0 };

  const percent = sharePercent(guests.replied, guests.invited);

  return { words: `${guests.coming} coming · ${percent}% replied`, percent };
}

function owedOf(key: EventKey, sample: GuestsOf = SAMPLE_GUESTS): number {
  const guests = sample[IDS[key]];

  return guests == null ? 0 : guests.invited - guests.replied;
}

/** The events whose line each moment draws. */
const READY: Partial<Record<MomentName, readonly EventKey[]>> = {
  plan: ['wed', 'ireti', 'party'],
  day: ['wed', 'ireti', 'party'],
  quiet: ['party'],
};

/** The wedding on day 2 of 3, as Guests A's door reads it then. */
const DAY_TWO = { words: '87 of 99 arrived', percent: 87 };

const RAIL = [
  ['14:00', 'Ceremony'],
  ['15:00', 'Photos'],
  ['16:00', 'Drinks'],
  ['18:00', 'Dinner'],
  ['20:00', 'Speeches'],
  ['21:30', 'First dance'],
] as const;

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The rail's stops are evenly spaced, so the moment sits between the two stops either side of it. */
export function railAt(stops: readonly string[], time: string): number {
  const at = minutes(time);
  const after = stops.findIndex((stop) => minutes(stop) > at);

  if (after <= 0) return after === 0 ? 0 : 1;

  const from = minutes(stops[after - 1] ?? time);
  const share = (at - from) / (minutes(stops[after] ?? time) - from);

  return (after - 1 + share) / (stops.length - 1);
}

/** Events' own words for its days, the product's Today's own function (sc-30413, 11 Nov). */
function eventDates(event: SampleEvent, today: string, say: Say, t: TFunction): string {
  return daysWords(
    {
      status: event.draft ? 'draft' : 'live',
      startsAt: `${event.first}T12:00:00Z`,
      endsAt: `${event.last}T12:00:00Z`,
      timeZone: 'UTC',
      concludedAt: null,
    },
    new Date(`${today}T12:00:00Z`),
    say.locale,
    true,
    t,
  );
}

function card(
  key: EventKey,
  today: string,
  moment: MomentName,
  say: Say,
  t: TFunction,
  guests: GuestsOf,
  later: EventKey | null,
): EventCard {
  const event = EVENTS[key];
  const until = daysFrom(today, event.first);
  const live = until <= 0 && daysFrom(today, event.last) >= 0 && key !== later;
  const count = event.draft
    ? 'Draft'
    : key === later
      ? 'Today'
      : live
        ? `Day ${1 - until} of ${daysFrom(event.first, event.last) + 1}`
        : until === 1
          ? 'Tomorrow'
          : `In ${until} days`;

  return {
    event: sample(key),
    name: event.name,
    dates: eventDates(event, today, say, t),
    count,
    live,
    draft: event.draft,
    stage: !event.draft && !live && until > 0 && until <= 7 ? 'Final week' : null,
    ready:
      READY[moment]?.includes(key) !== true
        ? null
        : moment === 'day' && key === 'wed'
          ? DAY_TWO
          : repliesOf(key, guests),
  };
}

/** Live events and the ones still to come, soonest first, then drafts. */
function cards(
  today: string,
  moment: MomentName,
  say: Say,
  t: TFunction,
  guests: GuestsOf,
  later: EventKey | null = null,
): EventCard[] {
  return (Object.keys(EVENTS) as EventKey[])
    .filter((key) => daysFrom(today, EVENTS[key].last) >= 0)
    .sort(
      (a, b) =>
        Number(EVENTS[a].draft) - Number(EVENTS[b].draft) ||
        EVENTS[a].first.localeCompare(EVENTS[b].first),
    )
    .map((key) => card(key, today, moment, say, t, guests, later));
}

/** One bar for each event on in the week, with its other days' milestones as dots. */
function week(
  today: string,
  agenda: readonly (readonly [string, Item[]])[],
  say: Say,
): { days: StripDay[]; bars: StripBar[] } {
  const last = addDays(today, 6);
  const bars: StripBar[] = (Object.keys(EVENTS) as EventKey[])
    .filter((key) => {
      const event = EVENTS[key];

      return (
        !event.draft && event.first !== event.last && event.first <= last && event.last >= today
      );
    })
    .map((key) => {
      const event = EVENTS[key];
      const start = Math.max(0, daysFrom(today, event.first));
      const end = Math.min(6, daysFrom(today, event.last));
      const length = daysFrom(event.first, event.last) + 1;
      const openLeft = event.first < today;

      return {
        event: sample(key),
        start,
        span: end - start + 1,
        label: openLeft ? `day ${1 - daysFrom(today, event.first)} of ${length}` : `${length} days`,
        openLeft,
      };
    });
  const covered = (key: EventKey, index: number) =>
    bars.some((bar) => bar.event.id === key && index >= bar.start && index < bar.start + bar.span);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const items = agenda.find(([day]) => day === date)?.[1] ?? [];
    const dots = [...new Set(items.map(([, , event]) => event))]
      .filter((event) => !covered(event, index))
      .map(sample);

    return { weekday: say.weekday(date), number: say.number(date), today: index === 0, dots };
  });

  return { days, bars };
}

const TODAY: Record<MomentName, { date: string; time: string }> = {
  plan: { date: '2026-11-03', time: '09:41' },
  planNow: { date: '2026-11-03', time: '09:41' },
  day: { date: '2026-11-06', time: '16:10' },
  dayNow: { date: '2026-11-06', time: '16:10' },
  quiet: { date: '2026-11-18', time: '09:41' },
  first: { date: '2026-11-03', time: '09:41' },
};

/** `?needs=`, the planning day with other rows: every overdue form, one row, none, a long title. */
export const NEEDS_STATES = ['overdue', 'one', 'none', 'long'] as const;

export type NeedsState = (typeof NEEDS_STATES)[number];

export function isNeedsState(state: string | undefined): state is NeedsState {
  return NEEDS_STATES.some((one) => one === state);
}

const KITCHEN = 'Give final numbers to the kitchen';
const LONG_TITLE = 'Confirm the final numbers with the venue’s kitchen and the outside caterer';

type Owed = readonly [event: EventKey, due: string, title?: string];

/** sc-30812's milestone, one to an event and at 23:59 on its date, while the event has yet to start. */
const OWED: Record<'plan' | 'day' | NeedsState, readonly Owed[]> = {
  plan: [
    ['party', '2026-10-31'],
    ['wed', '2026-11-04'],
    ['ireti', '2026-11-06'],
    ['draft', '2027-01-04'],
  ],
  day: [
    ['ireti', '2026-11-12'],
    ['party', '2026-11-06'],
  ],
  overdue: [
    ['party', '2026-11-01'],
    ['ireti', '2026-11-02'],
    ['draft', '2026-11-03'],
    ['wed', '2026-11-04'],
  ],
  one: [['wed', '2026-11-03']],
  none: [],
  long: [['draft', '2027-01-04', LONG_TITLE]],
};

const SAMPLE_ZONE = 'Europe/London';

/** The due day's "Overdue" shows only once its 23:59 has passed. */
const DUE_DAY_LAST_MINUTE = { date: '2026-11-03', time: '23:59' };

function owedOn([key, due, title = KITCHEN]: Owed): YouEvent {
  return {
    shown: sample(key),
    startsAt: `${EVENTS[key].first}T12:00:00Z`,
    timeZone: SAMPLE_ZONE,
    permissions: ['menu.manage'],
    milestones: [
      { at: `${due}T23:59:00Z`, title, note: null, owner: 'you', area: 'menu', action: null },
    ],
  };
}

function needs(
  name: MomentName,
  { date, time }: { date: string; time: string },
  say: Say,
  state: NeedsState | undefined,
): Need[] | null {
  const owed =
    name === 'plan'
      ? OWED[state ?? 'plan']
      : name === 'day'
        ? OWED.day
        : name === 'quiet'
          ? []
          : null;

  // Half a minute into the minute, so a milestone at 23:59 has passed at the demo's 23:59.
  return owed == null ? null : needsOf(owed.map(owedOn), new Date(`${date}T${time}:30Z`), say.day);
}

function now(today: string, time: string, say: Say): Now {
  const event = EVENTS.wed;
  const at = railAt(
    RAIL.map(([stop]) => stop),
    time,
  );
  const on = Math.floor(at * (RAIL.length - 1));
  const tomorrow = addDays(today, 1);

  return {
    event: sample('wed'),
    name: event.name,
    live: `Day ${daysFrom(event.first, today) + 1} of ${daysFrom(event.first, event.last) + 1} · ${event.place}`,
    happening: 'Drinks reception',
    until: `until ${say.clock('17:30')}`,
    behind: '10 min behind',
    next: { time: say.clock('18:00'), title: 'Dinner is served' },
    arrived: 87,
    expected: 99,
    rail: RAIL.map(([stop, name], index) => ({
      time: say.hour(stop),
      name,
      state: index < on ? 'done' : index === on ? 'now' : index === on + 1 ? 'next' : 'later',
    })),
    at,
    ends:
      event.last === tomorrow
        ? `Ends tomorrow, ${say.day(event.last)} at ${say.clock('15:00')}`
        : `Ends ${say.day(event.last)} at ${say.clock('15:00')}`,
  };
}

/** `?starts=later`: the party's own day at 09:41, the party starting at 19:00 (sc-30413). */
export const STARTS_LATER = {
  event: 'party',
  date: '2026-11-28',
  time: '09:41',
  starts: '19:00',
} as const;

const LATER_AGENDA: readonly (readonly [string, Item[]])[] = [
  [STARTS_LATER.date, [[STARTS_LATER.starts, 'The party starts', STARTS_LATER.event, '']]],
];

/** `at` draws the moment on another day and time; `guests` gives the events other guests; `later` draws `?starts=later`. */
export function momentOf(
  name: MomentName,
  say: Say,
  t: TFunction,
  {
    needing,
    later = false,
    at = later && name === 'plan'
      ? STARTS_LATER
      : needing === 'overdue'
        ? DUE_DAY_LAST_MINUTE
        : TODAY[name],
    guests = SAMPLE_GUESTS,
  }: {
    at?: { date: string; time: string } | undefined;
    guests?: GuestsOf | undefined;
    needing?: NeedsState | undefined;
    later?: boolean | undefined;
  } = {},
): Moment {
  const starting = later && name === 'plan';
  const { date: today, time } = at;
  const kind = name === 'planNow' ? 'plan' : name === 'dayNow' ? 'day' : (name as Moment['kind']);
  const full = name !== 'planNow' && name !== 'dayNow';
  const agenda = starting
    ? LATER_AGENDA
    : name === 'first'
      ? []
      : name === 'dayNow'
        ? builtNow(today)
        : AGENDA[name];
  const { days, bars } = week(today, agenda, say);
  const waiting = needs(name, at, say, starting ? 'none' : needing);
  const wedding = EVENTS.wed.first;
  const party = EVENTS.party;

  return {
    name,
    kind,
    full,
    time,
    eyebrow: say.long(today),
    hello: t(
      `todayScreen.helloName.${name === 'first' ? 'welcome' : greetingAt(Number(time.slice(0, 2)))}`,
      { name: 'Folake' },
    ),
    lead:
      waiting != null && waiting.length > 0
        ? `${waiting.length} ${waiting.length === 1 ? 'thing needs' : 'things need'} you.`
        : null,
    sub:
      name === 'first'
        ? 'Your first event starts here.'
        : starting
          ? `${party.name} starts today at ${say.clock(STARTS_LATER.starts)}.`
          : name === 'quiet'
            ? t('todayScreen.startsOnDate', { name: party.name, date: say.day(party.first) })
            : `The wedding starts on ${say.weekdayLong(wedding)}.`,
    needs: waiting,
    days,
    bars,
    agenda: agenda.map(([date, items]) => ({
      date,
      day: date === today ? 'Today' : say.day(date),
      when: date === today ? say.day(date) : howFar(today, date),
      today: date === today,
      items: items.map(([at, title, event, note]) => ({
        time: at === '' ? 'All day' : say.clock(at),
        allDay: at === '',
        title,
        event: sample(event),
        note,
      })),
    })),
    nothing: kind === 'day' ? 'Nothing else today' : 'Nothing today',
    nextUp:
      name === 'quiet'
        ? {
            event: sample('party'),
            name: party.name,
            when: `${say.day(party.first)} · ${howFar(today, party.first)}`,
          }
        : null,
    events:
      name === 'first'
        ? []
        : cards(today, name, say, t, guests, starting ? STARTS_LATER.event : null),
    now: kind === 'day' ? now(today, time, say) : null,
  };
}
