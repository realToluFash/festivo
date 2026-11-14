import {
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type EventFormField,
  type EventType,
  HOST_NAME_MAXIMUM,
  VENUE_ADDRESS_MAXIMUM,
  VENUE_NAME_MAXIMUM,
  eventFormProblems,
  firstRefusedOf,
  hostProblems,
  newEventHosts,
} from '@soirely/domain';

import { EVENT_WORDS as W, type Wall } from './events.ts';

/** New event's states at a desk (sc-48607), each a ?state= on /demo/events/new. */
export const NEW_EVENT_STATES = [
  'filled',
  'refused',
  'creating',
  'notCreated',
  'server',
  'offline',
  'leave',
  'moved',
  'skipped',
  'created',
  'photo',
  'photoRefused',
] as const;
export type NewEventState = (typeof NEW_EVENT_STATES)[number];

export function newEventStateOf(raw: string | null): NewEventState | null {
  return NEW_EVENT_STATES.find((one) => one === raw) ?? null;
}

export const NEW_WORDS = {
  aboutHeading: 'About the event',
  whenHeading: 'When',
  venueHeading: 'Venue',
  zoneHeading: 'Time zone and currency',
  typePlaceholder: 'Choose what kind of event',
  typeMissing: 'Choose what kind of event it is.',
  startMissing: 'Choose when the event starts.',
  endMissing: 'Choose when the event ends.',
  venueNameTooLong: `Shorten the venue name to ${VENUE_NAME_MAXIMUM} characters or fewer.`,
  venueAddressTooLong: `Shorten the address to ${VENUE_ADDRESS_MAXIMUM} characters or fewer.`,
  currencyBlank: 'Choose a currency.',
  zoneRefused: 'Choose a time zone.',
  create: 'Create event',
  creating: 'Creating…',
  notCreated: 'Not created. Nothing was saved. Try again.',
  created: 'Created. Opening the event.',
  leaveTitle: 'Leave without saving?',
  leave: 'Leave without saving',
  leaveBody: 'What you typed for this event will be lost.',
  problems: (count: number) =>
    count === 1
      ? '1 field needs fixing, so nothing was sent.'
      : `${count} fields need fixing, so nothing was sent.`,
  defaultsHint: (organisation: string) => `Filled in from ${organisation}’s settings.`,
  createdWithout: (reason: string) => `The event is saved without its photo. ${reason}`,
  clocksSkip: (time: string, day: string, zone: string, savedAs: string) =>
    `There is no ${time} on ${day} in ${zone}: the clocks go forward that night. It will be saved as ${savedAs}.`,
};

export interface NewTyped {
  name: string;
  type: EventType | '';
  hosts: string[];
  photo: boolean;
  start: Wall;
  end: Wall;
  venueName: string;
  venueAddress: string;
  timeZone: string;
  currency: string;
}

export const ORG_DEFAULTS = { timeZone: 'Africa/Lagos', currency: 'NGN' };

export const BLANK: NewTyped = {
  name: '',
  type: '',
  hosts: [''],
  photo: false,
  start: { date: '', time: '' },
  end: { date: '', time: '' },
  venueName: '',
  venueAddress: '',
  ...ORG_DEFAULTS,
};

export const FILLED: NewTyped = {
  name: 'Adaeze & Tunde’s wedding',
  type: 'wedding',
  hosts: ['Adaeze Obi', 'Tunde Bakare'],
  photo: false,
  start: { date: '2027-03-13', time: '14:00' },
  end: { date: '2027-03-13', time: '23:00' },
  venueName: 'Eko Hotel',
  venueAddress: 'Adetokunbo Ademola Street, Victoria Island, Lagos',
  ...ORG_DEFAULTS,
};

/** Four refusals at once: the name blank, no type, a blank second host and an end before the start. */
const REFUSED: NewTyped = {
  ...FILLED,
  name: '',
  type: '',
  hosts: ['Adaeze Obi', ''],
  start: { date: '2027-03-13', time: '18:00' },
  end: { date: '2027-03-13', time: '15:00' },
};

/** 01:30 on the night London's clocks go forward in 2027, which does not exist there. */
const SKIPPED: NewTyped = {
  ...FILLED,
  name: 'Ireti’s 30th',
  type: 'birthday',
  hosts: ['Ireti Adeyemi'],
  start: { date: '2027-03-28', time: '01:30' },
  end: { date: '2027-03-28', time: '05:00' },
  venueName: 'The Landmark',
  venueAddress: '222 Marylebone Road, London NW1 6JQ',
  timeZone: 'Europe/London',
  currency: 'GBP',
};

export const MOVED: NewTyped = {
  ...FILLED,
  start: { date: '2027-03-14', time: '14:00' },
  end: { date: '2027-03-14', time: '23:00' },
};

export function typedFor(state: NewEventState | null): NewTyped {
  switch (state) {
    case null:
      return BLANK;
    case 'refused':
      return REFUSED;
    case 'skipped':
      return SKIPPED;
    case 'moved':
      return MOVED;
    case 'photo':
    case 'photoRefused':
      return { ...FILLED, photo: true };
    default:
      return FILLED;
  }
}

export function draftOf(typed: NewTyped): EventDraft {
  return {
    name: typed.name,
    type: typed.type,
    startDate: typed.start.date,
    startTime: typed.start.time,
    endDate: typed.end.date,
    endTime: typed.end.time,
  };
}

export type Refusals = Partial<Record<EventFormField, string>>;

const WORDS: Record<string, string> = {
  nameBlank: W.nameBlank,
  nameTooLong: W.nameTooLong(EVENT_NAME_MAXIMUM),
  typeMissing: NEW_WORDS.typeMissing,
  startMissing: NEW_WORDS.startMissing,
  endMissing: NEW_WORDS.endMissing,
  endBeforeStart: W.endBeforeStart,
  venueNameTooLong: NEW_WORDS.venueNameTooLong,
  venueAddressTooLong: NEW_WORDS.venueAddressTooLong,
  currencyBlank: NEW_WORDS.currencyBlank,
};

export function refusalsOf(typed: NewTyped): Refusals {
  const found: Refusals = {};
  for (const one of eventFormProblems({
    draft: draftOf(typed),
    venue: { name: typed.venueName, address: typed.venueAddress, addressId: null },
    timeZone: typed.timeZone,
    currency: typed.currency,
  }))
    found[one.field] = WORDS[one.problem] ?? one.problem;

  return found;
}

/** Each host row's refusal: a repeat or an overlong name as typed, a blank one only once Create was pressed. */
export function hostWords(hosts: readonly string[], tried: boolean): (string | null)[] {
  if (newEventHosts(hosts.map((name, key) => ({ key, name }))).length === 0)
    return hosts.map(() => null);

  return hostProblems(hosts).map((problem) =>
    problem == null
      ? null
      : problem.problem === 'hostBlank'
        ? tried
          ? W.hostBlank
          : null
        : problem.problem === 'hostTooLong'
          ? W.hostTooLong(HOST_NAME_MAXIMUM, problem.length)
          : W.hostDuplicate(problem.name),
  );
}

export function checkOf(
  typed: NewTyped,
  server: Refusals = {},
): {
  refusals: Refusals;
  hosts: (string | null)[];
  count: number;
} {
  const refusals = { ...refusalsOf(typed), ...server };
  const hosts = hostWords(typed.hosts, true);

  return {
    refusals,
    hosts,
    count: Object.keys(refusals).length + hosts.filter((one) => one != null).length,
  };
}

/** Where focus lands on a refusal, by the domain's order: Event name and Type before the hosts, the rest after them (sc-22143). */
export function firstRefused(
  refusals: Refusals,
  hosts: readonly (string | null)[],
): { field: EventFormField } | { host: number } | null {
  const rows = hosts.map((_, key) => ({ key, name: '' }));
  const hostErrors = Object.fromEntries(
    hosts.flatMap((one, key) => (one == null ? [] : [[key, one]])),
  );

  return firstRefusedOf(refusals, hostErrors, rows);
}

export function typedSomething(typed: NewTyped): boolean {
  return JSON.stringify(typed) !== JSON.stringify(BLANK);
}
