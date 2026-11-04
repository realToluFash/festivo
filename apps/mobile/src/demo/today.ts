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
    first: '2026-11-06',
    last: '2026-11-08',
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
  const clock = format({ hour: 'numeric', minute: '2-digit' });
  const hour = format({ hour: 'numeric' });
  const at = (date: string) => new Date(`${date}T00:00Z`);
  const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}Z`);

  return {
    long: (date) => long.format(at(date)),
    day: (date) => (Number(date.slice(0, 4)) === thisYear ? day : dayAndYear).format(at(date)),
    weekday: (date) => weekday.format(at(date)),
    weekdayLong: (date) => weekdayLong.format(at(date)),
    number: (date) => number.format(at(date)),
    clock: (hhmm) => clock.format(time(hhmm)),
    hour: (hhmm) => (hhmm.endsWith(':00') ? hour : clock).format(time(hhmm)),
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

export interface AgendaItem {
  time: string;
  title: string;
  event: EventKey;
  note: string;
}

export interface AgendaDay {
  date: string;
  day: string;
  when: string;
  today: boolean;
  items: AgendaItem[];
}

export interface StripDay {
  weekday: string;
  number: string;
  today: boolean;
  dots: EventKey[];
}

export interface StripBar {
  event: EventKey;
  start: number;
  span: number;
  label: string;
  /** Started before the week shown, so it runs in from the left edge. */
  openLeft: boolean;
}

export interface EventCard {
  event: EventKey;
  name: string;
  dates: string;
  count: string;
  live: boolean;
  draft: boolean;
  stage: string | null;
  ready: { words: string; percent: number } | null;
}

export interface RailStop {
  time: string;
  name: string;
  state: 'done' | 'now' | 'next' | 'later';
}

export interface Now {
  event: EventKey;
  name: string;
  live: string;
  happening: string;
  until: string;
  behind: string;
  next: { time: string; title: string };
  arrived: number;
  expected: number;
  rail: RailStop[];
  /** Where the moment sits along the rail, from 0 at its first stop to 1 at its last. */
  at: number;
  ends: string;
}

export interface Moment {
  name: MomentName;
  kind: 'plan' | 'day' | 'quiet' | 'first';
  /** False draws only what the product can show today, from the events' own dates. */
  full: boolean;
  time: string;
  eyebrow: string;
  hello: string;
  lead: string | null;
  sub: string;
  /** Null when the product has nothing to say yet; empty when nothing needs you. */
  needs: Need[] | null;
  days: StripDay[];
  bars: StripBar[];
  agenda: AgendaDay[];
  nothing: string;
  nextUp: { event: EventKey; name: string; when: string } | null;
  events: EventCard[];
  now: Now | null;
}

type Item = readonly [time: string, title: string, event: EventKey, note: string];

const AGENDA: Record<Exclude<MomentName, 'first'>, readonly (readonly [string, Item[]])[]> = {
  plan: [
    [
      '2026-11-03',
      [['10:00', 'Reminder goes to the 21 who haven’t replied', 'ireti', 'Automatic']],
    ],
    ['2026-11-05', [['09:00', 'Meal choices close', 'wed', 'Automatic']]],
    [
      '2026-11-06',
      [
        ['19:00', 'Welcome dinner', 'wed', 'Day 1 of 3'],
        ['23:59', 'Replies close', 'ireti', 'Automatic'],
      ],
    ],
    ['2026-11-07', [['14:00', 'Ceremony', 'wed', 'Day 2 of 3']]],
    ['2026-11-08', [['11:00', 'Farewell brunch', 'wed', 'Day 3 of 3']]],
    ['2026-11-09', [['10:00', 'Thank-you messages go out', 'wed', 'Automatic']]],
  ],
  planNow: [
    ['2026-11-03', []],
    ['2026-11-06', [['19:00', 'The wedding starts', 'wed', 'Day 1 of 3']]],
    ['2026-11-07', [['', 'The wedding, day 2', 'wed', 'Day 2 of 3']]],
    ['2026-11-08', [['14:00', 'The wedding ends', 'wed', 'Day 3 of 3']]],
  ],
  day: [
    ['2026-11-07', []],
    [
      '2026-11-08',
      [
        ['11:00', 'Farewell brunch', 'wed', 'Day 3 of 3'],
        ['14:00', 'The wedding ends', 'wed', ''],
      ],
    ],
    ['2026-11-09', [['10:00', 'Thank-you messages go out', 'wed', 'Automatic']]],
    ['2026-11-13', [['09:00', 'Meal choices close', 'ireti', 'Automatic']]],
  ],
  dayNow: [
    ['2026-11-07', []],
    ['2026-11-08', [['14:00', 'The wedding ends', 'wed', 'Day 3 of 3']]],
  ],
  quiet: [],
};

const READY: Partial<Record<MomentName, Partial<Record<EventKey, readonly [string, number]>>>> = {
  plan: {
    wed: ['152 coming · 91% replied', 91],
    ireti: ['36 coming · 65% replied', 65],
    party: ['Invitations not sent', 0],
  },
  day: {
    wed: ['141 of 152 arrived', 93],
    ireti: ['44 coming · 80% replied', 80],
    party: ['Invitations not sent', 0],
  },
  quiet: { party: ['112 coming · 70% replied', 70] },
};

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

function card(key: EventKey, today: string, moment: MomentName, say: Say): EventCard {
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
  const ready = READY[moment]?.[key];

  return {
    event: key,
    name: event.name,
    dates: eventDates(event, say),
    count,
    live,
    draft: event.draft,
    stage: !event.draft && !live && until <= 7 ? 'Final week' : null,
    ready: ready == null ? null : { words: ready[0], percent: ready[1] },
  };
}

/** Live events and the ones still to come, soonest first, then drafts. */
function cards(today: string, moment: MomentName, say: Say): EventCard[] {
  return (Object.keys(EVENTS) as EventKey[])
    .filter((key) => daysFrom(today, EVENTS[key].last) >= 0)
    .sort(
      (a, b) =>
        Number(EVENTS[a].draft) - Number(EVENTS[b].draft) ||
        EVENTS[a].first.localeCompare(EVENTS[b].first),
    )
    .map((key) => card(key, today, moment, say));
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
        event: key,
        start,
        span: end - start + 1,
        label: openLeft ? `day ${1 - daysFrom(today, event.first)} of ${length}` : `${length} days`,
        openLeft,
      };
    });
  const covered = (key: EventKey, index: number) =>
    bars.some((bar) => bar.event === key && index >= bar.start && index < bar.start + bar.span);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const items = agenda.find(([day]) => day === date)?.[1] ?? [];
    const dots = [...new Set(items.map(([, , event]) => event))].filter(
      (event) => !covered(event, index),
    );

    return { weekday: say.weekday(date), number: say.number(date), today: index === 0, dots };
  });

  return { days, bars };
}

const TODAY: Record<MomentName, { date: string; time: string }> = {
  plan: { date: '2026-11-03', time: '09:41' },
  planNow: { date: '2026-11-03', time: '09:41' },
  day: { date: '2026-11-07', time: '16:10' },
  dayNow: { date: '2026-11-07', time: '16:10' },
  quiet: { date: '2026-11-18', time: '09:41' },
  first: { date: '2026-11-03', time: '09:41' },
};

function needs(name: MomentName, today: string, say: Say): Need[] | null {
  const row = (event: EventKey, title: string, due: string, action: string): Need => {
    const { words, late } = dueWords(today, due, say);

    return { event, title, due: words, late, action };
  };

  if (name === 'plan')
    return [
      row('party', 'Send the invitations', '2026-10-31', 'Send'),
      row('wed', 'Final numbers to the caterer', '2026-11-04', 'Review'),
      row('wed', 'Seat the last 12 guests', '2026-11-05', 'Seat'),
      {
        event: 'ireti',
        title: 'Chase 21 replies',
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
    event: 'wed',
    name: event.name,
    live: `Day ${daysFrom(event.first, today) + 1} of ${daysFrom(event.first, event.last) + 1} · ${event.place}`,
    happening: 'Drinks reception',
    until: `until ${say.clock('17:30')}`,
    behind: '10 min behind',
    next: { time: say.clock('18:00'), title: 'Dinner is served' },
    arrived: 141,
    expected: 152,
    rail: RAIL.map(([stop, name], index) => ({
      time: say.hour(stop),
      name,
      state: index < on ? 'done' : index === on ? 'now' : index === on + 1 ? 'next' : 'later',
    })),
    at,
    ends:
      event.last === tomorrow
        ? `Ends tomorrow, ${say.day(event.last)} at ${say.clock('14:00')}`
        : `Ends ${say.day(event.last)} at ${say.clock('14:00')}`,
  };
}

export function momentOf(name: MomentName, say: Say): Moment {
  const { date: today, time } = TODAY[name];
  const kind = name === 'planNow' ? 'plan' : name === 'dayNow' ? 'day' : (name as Moment['kind']);
  const full = name !== 'planNow' && name !== 'dayNow';
  const agenda = name === 'first' ? [] : AGENDA[name];
  const { days, bars } = week(today, agenda, say);
  const waiting = needs(name, today, say);
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
        event,
        note,
      })),
    })),
    nothing: kind === 'day' ? 'Nothing else today' : 'Nothing today',
    nextUp:
      name === 'quiet'
        ? {
            event: 'party',
            name: party.name,
            when: `${say.day(party.first)} · ${howFar(today, party.first)}`,
          }
        : null,
    events: name === 'first' ? [] : cards(today, name, say),
    now: kind === 'day' ? now(today, time, say) : null,
  };
}
