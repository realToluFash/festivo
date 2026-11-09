import type {
  EventCard,
  Moment as Shown,
  Now,
  ShownEvent,
  StripBar,
  StripDay,
} from '../components/today.ts';
import { writtenTime } from './clock.ts';
import { TODAY_IDS as IDS } from './events.ts';
import { type Guests, SAMPLE_GUESTS } from './guestCounts.ts';

export type EventKey = 'wed' | 'ireti' | 'party' | 'draft';
export type MomentName = 'plan' | 'planNow' | 'day' | 'dayNow' | 'quiet' | 'first';

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
}

export const EVENTS: Record<EventKey, SampleEvent> = {
  wed: {
    name: 'Adaeze & Tunde’s wedding',
    first: '2026-11-05',
    last: '2026-11-07',
    place: 'The Landmark, London',
    draft: false,
  },
  ireti: {
    name: 'Ireti at 40',
    first: '2026-11-14',
    last: '2026-11-15',
    place: 'Hackney, London',
    draft: false,
  },
  party: {
    name: 'Ire Events end-of-year party',
    first: '2026-11-28',
    last: '2026-11-28',
    place: 'Clerkenwell, London',
    draft: false,
  },
  draft: {
    name: 'Bisi & Kola’s engagement',
    first: '2027-01-09',
    last: '2027-01-09',
    place: '',
    draft: true,
  },
};

/** Dates as `2026-11-03` and times as `18:00`, written the reader's way. */
export interface Say {
  long(date: string): string;
  day(date: string): string;
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
    long: (date) => long.format(at(date)),
    day: (date) => (Number(date.slice(0, 4)) === thisYear ? day : dayAndYear).format(at(date)),
    weekday: (date) => weekday.format(at(date)),
    weekdayLong: (date) => weekdayLong.format(at(date)),
    number: (date) => number.format(at(date)),
    clock: (hhmm) => writtenTime(hhmm, locale),
    hour: (hhmm) => writtenTime(hhmm, locale),
  };
}

export function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function howFar(today: string, date: string): string {
  const days = daysFrom(today, date);

  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

export function dueWords(today: string, due: string, say: Say): { words: string; late: boolean } {
  const days = daysFrom(today, due);

  if (days < 0) return { words: `${-days} ${days === -1 ? 'day' : 'days'} late`, late: true };
  if (days === 0) return { words: 'Due today', late: false };
  if (days === 1) return { words: 'Due tomorrow', late: false };

  return { words: `Due ${say.day(due)}`, late: false };
}

export interface Need {
  event: EventKey;
  title: string;
  due: string;
  late: boolean;
  action: string;
}

/** The product's Today, and what only the demo draws: Needs you (sc-29884). */
export interface Moment extends Shown {
  name: MomentName;
  time: string;
  /** Null when the product has nothing to say yet; empty when nothing needs you. */
  needs: Need[] | null;
}

/** A sample event as the product's parts draw it: its colour is its key. */
export function shown(key: EventKey): ShownEvent {
  return { id: IDS[key], name: EVENTS[key].name, mesh: key };
}

/** The sample event an id names, for the parts that still take a key. */
export function keyOf(id: string): EventKey {
  return (Object.keys(IDS) as EventKey[]).find((key) => IDS[key] === id) ?? 'draft';
}

type Item = readonly [time: string, title: string, event: EventKey, note: string];

const AGENDA: Record<Exclude<MomentName, 'first'>, readonly (readonly [string, Item[]])[]> = {
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
  dayNow: [
    ['2026-11-06', []],
    ['2026-11-07', [['15:00', 'The wedding ends', 'wed', 'Day 3 of 3']]],
  ],
  quiet: [],
};

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

function greeting(time: string): string {
  const hour = Number(time.slice(0, 2));

  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function eventDates(event: SampleEvent, say: Say): string {
  return event.first === event.last
    ? say.day(event.first)
    : `${say.day(event.first)} – ${say.day(event.last)}`;
}

function card(
  key: EventKey,
  today: string,
  moment: MomentName,
  say: Say,
  guests: GuestsOf,
): EventCard {
  const event = EVENTS[key];
  const until = daysFrom(today, event.first);
  const live = until <= 0 && daysFrom(today, event.last) >= 0;
  const count = event.draft
    ? 'Draft'
    : live
      ? `Day ${1 - until} of ${daysFrom(event.first, event.last) + 1}`
      : until === 1
        ? 'Tomorrow'
        : `In ${until} days`;

  return {
    event: shown(key),
    name: event.name,
    dates: eventDates(event, say),
    count,
    live,
    draft: event.draft,
    stage: !event.draft && !live && until <= 7 ? 'Final week' : null,
    ready:
      READY[moment]?.includes(key) !== true
        ? null
        : moment === 'day' && key === 'wed'
          ? DAY_TWO
          : repliesOf(key, guests),
  };
}

/** Live events and the ones still to come, soonest first, then drafts. */
function cards(today: string, moment: MomentName, say: Say, guests: GuestsOf): EventCard[] {
  return (Object.keys(EVENTS) as EventKey[])
    .filter((key) => daysFrom(today, EVENTS[key].last) >= 0)
    .sort(
      (a, b) =>
        Number(EVENTS[a].draft) - Number(EVENTS[b].draft) ||
        EVENTS[a].first.localeCompare(EVENTS[b].first),
    )
    .map((key) => card(key, today, moment, say, guests));
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
        event: shown(key),
        start,
        span: end - start + 1,
        label: openLeft ? `day ${1 - daysFrom(today, event.first)} of ${length}` : `${length} days`,
        openLeft,
      };
    });
  const covered = (key: EventKey, index: number) =>
    bars.some(
      (bar) => bar.event.id === IDS[key] && index >= bar.start && index < bar.start + bar.span,
    );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const items = agenda.find(([day]) => day === date)?.[1] ?? [];
    const dots = [...new Set(items.map(([, , event]) => event))].filter(
      (event) => !covered(event, index),
    );

    return {
      weekday: say.weekday(date),
      number: say.number(date),
      today: index === 0,
      dots: dots.map(shown),
    };
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

function needs(name: MomentName, today: string, say: Say, guests: GuestsOf): Need[] | null {
  const row = (event: EventKey, title: string, due: string, action: string): Need => {
    const { words, late } = dueWords(today, due, say);

    return { event, title, due: words, late, action };
  };

  if (name === 'plan')
    return [
      guests[IDS.party]?.invited === 0
        ? row('party', 'Send the invitations', '2026-10-31', 'Send')
        : row('party', `Chase ${owedOf('party', guests)} replies`, '2026-10-31', 'Chase'),
      row('wed', 'Final numbers to the caterer', '2026-11-04', 'Review'),
      row('wed', 'Seat the last 12 guests', '2026-11-05', 'Seat'),
      {
        event: 'ireti',
        title: `Chase ${owedOf('ireti', guests)} replies`,
        due: `Replies close ${say.day('2026-11-06')}`,
        late: false,
        action: 'Chase',
      },
    ];
  if (name === 'day')
    return [
      {
        event: 'wed',
        title: 'Choose meals for 3 guests',
        due: `Before dinner at ${say.clock('18:00')}`,
        late: false,
        action: 'Choose',
      },
      row('wed', 'Pay the band’s balance', today, 'Pay'),
    ];

  return name === 'quiet' ? [] : null;
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
    event: shown('wed'),
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

/** `guests` gives the events other guests, as `?invites=none` does. */
export function momentOf(
  name: MomentName,
  say: Say,
  { guests = SAMPLE_GUESTS }: { guests?: GuestsOf | undefined } = {},
): Moment {
  const { date: today, time } = TODAY[name];
  const kind = name === 'planNow' ? 'plan' : name === 'dayNow' ? 'day' : (name as Moment['kind']);
  const full = name !== 'planNow' && name !== 'dayNow';
  const agenda = name === 'first' ? [] : AGENDA[name];
  const { days, bars } = week(today, agenda, say);
  const waiting = needs(name, today, say, guests);
  const wedding = EVENTS.wed.first;
  const party = EVENTS.party;

  return {
    name,
    kind,
    full,
    time,
    eyebrow: say.long(today),
    hello: name === 'first' ? 'Welcome, Folake' : `${greeting(time)}, Folake`,
    lead:
      waiting != null && waiting.length > 0
        ? `${waiting.length} ${waiting.length === 1 ? 'thing needs' : 'things need'} you.`
        : null,
    sub:
      name === 'first'
        ? 'Your first event starts here.'
        : name === 'quiet'
          ? 'Nothing needs you this week.'
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
        title,
        event: shown(event),
        note,
      })),
    })),
    nothing: kind === 'day' ? 'Nothing else today' : 'Nothing today',
    nextUp:
      name === 'quiet'
        ? {
            event: shown('party'),
            name: party.name,
            when: `${say.day(party.first)} · ${howFar(today, party.first)}`,
          }
        : null,
    events: name === 'first' ? [] : cards(today, name, say, guests),
    now: kind === 'day' ? now(today, time, say) : null,
  };
}
