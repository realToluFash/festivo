import { type InsideLevel } from '../doorCode/RedeemModel.ts';
import { type MyNightState } from '../myNight/myNightModel.ts';
import {
  type EventDay,
  KS,
  type Where,
  opensStations,
  readAt,
  rowLine,
  rowShows,
} from '../station/wayIn.ts';
import { READ_ANSWERS_IN, type ServiceLink, type WayInOverview } from '../station/wayInShown.ts';
import { type FloorState } from './FloorModel.ts';
import { type OnFloor, floorLine, opensFloor } from './floorWayIn.ts';

const ROW_STATES = [
  'one_section',
  'before_fire',
  'two_sections',
  'two_sections_fr',
  'all_tables',
  'no_section',
  'moving',
  'answering',
  'offline',
  'reconnects',
  'past_midnight',
  'day_before',
  'finished',
  'pass',
  'view',
  'check_in',
] as const;

const ORGANISER_STATES = ['org_lead', 'org_admin', 'org_waiter', 'org_day_before'] as const;

export const FLOOR_WAY_IN_STATES = [...ROW_STATES, ...ORGANISER_STATES] as const;

export type FloorWayInState = (typeof FLOOR_WAY_IN_STATES)[number];
type RowState = (typeof ROW_STATES)[number];
type OrganiserState = (typeof ORGANISER_STATES)[number];

const DAY: EventDay = {
  startDay: '2026-11-28',
  timeZone: 'Africa/Lagos',
  finished: false,
  calledOff: false,
};

const ORGANISER_DAY: EventDay = { ...DAY, startDay: '2026-11-05', timeZone: 'Europe/London' };

const TONIGHT = new Date('2026-11-28T18:40:00Z');
const DAY_BEFORE = new Date('2026-11-27T22:59:00Z');

/** How long the demo waits before the floor lead moves Grace to Section D, for the `moving` state. */
export const MOVES_IN = 3000;

export const LAST_READ = new Date('2026-11-28T18:38:00Z');

/** {time} is the device's zone, not the event's (sc-98893's With no connection). */
export function deviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface Sample<Role = InsideLevel | 'Lead' | 'Admin'> {
  role: Role;
  who: string;
  /** On the event's roster, so Your night heads Overview (sc-3915). */
  rostered: boolean;
  night: MyNightState;
  now: Date;
  finished: boolean;
  /** Where Kitchen station opens, for an account whose access opens the stations too (sc-95382). */
  kitchen: { where: Where; on: string } | null;
  on: OnFloor;
  locale: string;
  floor: FloorState;
  /** The floor lead moves the person while Overview is open (sc-36034). */
  movesTo?: OnFloor;
  answering?: boolean;
  /** Reads are failing: the row keeps its last line, "as of" this read. */
  lastRead?: Date;
  reconnects?: boolean;
}

const SECTION_B: OnFloor = { sections: ['Section B'], manages: false, course: 'Mains' };
const ALL_TABLES: OnFloor = { sections: [], manages: true, course: 'Mains' };

const GRACE: Sample<InsideLevel> = {
  role: 'Can work the floor',
  who: 'Grace Okon',
  rostered: true,
  night: 'app',
  now: TONIGHT,
  finished: false,
  kitchen: null,
  on: SECTION_B,
  locale: 'en',
  floor: 'yours',
};

const TWO: OnFloor = { ...SECTION_B, sections: ['Section B', 'Section D'] };

const ROWS: Record<RowState, Sample<InsideLevel>> = {
  one_section: GRACE,
  before_fire: { ...GRACE, on: { ...SECTION_B, course: null } },
  two_sections: { ...GRACE, on: TWO, floor: 'asWell' },
  two_sections_fr: { ...GRACE, on: TWO, floor: 'asWell', locale: 'fr' },
  all_tables: {
    ...GRACE,
    role: 'Can run the floor',
    who: 'Kunle Adeyemi',
    rostered: false,
    night: 'kitchen',
    kitchen: { where: { own: null, lastPick: 'Grill', course: 'Mains' }, on: 'picked-grill' },
    on: ALL_TABLES,
    floor: 'manage',
  },
  no_section: {
    ...GRACE,
    who: 'Funmi Bakare',
    rostered: false,
    night: 'night',
    on: { sections: [], manages: false, course: 'Mains' },
    floor: 'noSection',
  },
  moving: { ...GRACE, movesTo: { ...SECTION_B, sections: ['Section D'] }, floor: 'moved' },
  answering: { ...GRACE, answering: true },
  offline: { ...GRACE, lastRead: LAST_READ },
  reconnects: { ...GRACE, lastRead: LAST_READ, reconnects: true },
  past_midnight: { ...GRACE, now: new Date('2026-11-28T23:30:00Z') },
  day_before: { ...GRACE, now: DAY_BEFORE },
  finished: { ...GRACE, now: new Date('2026-11-29T01:10:00Z'), finished: true },
  pass: {
    ...GRACE,
    role: 'Can work the pass',
    who: 'Gbenga Salami',
    night: 'kitchen',
    kitchen: { where: { own: 'Fryer', lastPick: null, course: 'Mains' }, on: 'fryer' },
  },
  view: { ...GRACE, role: 'Can view', who: 'Ngozi Obi', rostered: false, night: 'night' },
  check_in: { ...GRACE, role: 'Can check guests in', who: 'Bola Ade', night: 'section_door' },
};

const RONKE: Sample = {
  ...GRACE,
  role: 'Lead',
  who: 'Ronke Alade',
  night: 'kitchen_checkin',
  now: new Date('2026-11-05T20:40:00Z'),
  kitchen: { where: { own: 'Pass', lastPick: null, course: 'Mains' }, on: 'pass' },
  on: ALL_TABLES,
  floor: 'manage',
};

const ORGANISER: Record<OrganiserState, Sample> = {
  org_lead: RONKE,
  org_admin: {
    ...RONKE,
    role: 'Admin',
    rostered: false,
    kitchen: { where: { own: null, lastPick: 'Grill', course: 'Mains' }, on: 'picked-grill' },
  },
  org_waiter: { ...GRACE, now: RONKE.now },
  org_day_before: { ...RONKE, now: new Date('2026-11-04T23:59:00Z') },
};

type Shown = Omit<WayInOverview, 'page' | 'role'>;

export function floorWayInStateOf(raw: string | undefined): FloorWayInState {
  return FLOOR_WAY_IN_STATES.find((state) => state === raw) ?? 'one_section';
}

function isOrganiser(state: FloorWayInState): state is OrganiserState {
  return ORGANISER_STATES.some((one) => one === state);
}

function floorLink(sample: Sample, zone: string): ServiceLink {
  const line = floorLine(sample.on, sample.locale);
  const href = `/demo/floor?state=${sample.floor}&from=overview`;

  if (sample.lastRead != null) {
    const stale = { line: KS.asOf(line, readAt(sample.lastRead, zone)), href };

    return sample.reconnects === true ? { ...stale, moves: { line, in: MOVES_IN } } : stale;
  }
  if (sample.answering === true) return { line, href, answersIn: READ_ANSWERS_IN };

  return sample.movesTo == null
    ? { line, href }
    : { line, href, moves: { line: floorLine(sample.movesTo, sample.locale), in: MOVES_IN } };
}

function shownOf(sample: Sample, day: EventDay, zone: string): Shown {
  const today = rowShows(day, sample.now);
  const kitchen = sample.kitchen;

  return {
    who: sample.who,
    rostered: sample.rostered,
    night: sample.night,
    now: sample.now,
    station:
      kitchen != null && today && opensStations(sample.role)
        ? {
            line: rowLine(kitchen.where),
            href: `/demo/kitchen-station?state=here&from=overview&on=${kitchen.on}`,
          }
        : null,
    floor: today && opensFloor(sample.role) ? floorLink(sample, zone) : null,
  };
}

export function floorOverviewOf(
  state: FloorWayInState,
  zone: string = deviceZone(),
): WayInOverview {
  if (isOrganiser(state)) {
    const sample = ORGANISER[state];

    return { ...shownOf(sample, ORGANISER_DAY, zone), page: 'organiser', role: sample.role };
  }
  const sample = ROWS[state];

  return {
    ...shownOf(sample, { ...DAY, finished: sample.finished }, zone),
    page: 'rows',
    role: sample.role,
  };
}

const WHAT: Record<FloorWayInState, readonly [string, string]> = {
  one_section: ['One section', 'Floor · Section B · Mains, directly under Your night'],
  before_fire: ['Before any course is fired', 'Floor · Section B'],
  two_sections: ['Two sections', 'Floor · Section B and Section D · Mains, one list'],
  two_sections_fr: [
    'Two sections, in French',
    'The list in fr from CLDR: Section B et Section D · Mains (the demo’s other words stay English)',
  ],
  all_tables: [
    'Can run the floor, no section',
    'Kitchen station · Grill · Mains, then Floor · All tables · Mains directly under it',
  ],
  no_section: [
    'Can work the floor, no shift',
    'The card, then Floor · No section yet: on the event’s day this row is the one addition',
  ],
  moving: [
    'The section moves',
    'Floor · Section B · Mains becomes Section D · Mains a few seconds in, while Overview is open',
  ],
  answering: [
    'The Floor read not yet answered',
    'No row and no placeholder, then Floor · Section B · Mains fades in over 200 ms; none under Reduce motion',
  ],
  offline: [
    'No connection',
    'Floor · Section B · Mains · as of {time}, its last line kept; {time} in this device’s zone',
  ],
  reconnects: [
    'The connection comes back',
    'Floor · Section B · Mains · as of {time}, then the next read drops “as of” a few seconds in',
  ],
  past_midnight: ['Past midnight', '00:30 on Sunday, before the end: the row stays'],
  day_before: ['23:59 the day before', 'Your night only: the row shows from 00:00 on the day'],
  finished: ['Finished', 'Your night only: the row goes once the event is Finished'],
  pass: ['Can work the pass', 'Kitchen station only: the level does not open the floor'],
  view: ['Can view', 'No row: Guests and People as today'],
  check_in: ['Can check guests in', 'Your night only: no Floor row'],
  org_lead: [
    'The organiser’s Overview, a Lead on the Pass',
    'Your night, Kitchen station, then Floor · All tables · Mains, in the one card',
  ],
  org_admin: [
    'The organiser’s Overview, an Admin with no shift',
    'Kitchen station in Your night’s place, then Floor under it',
  ],
  org_waiter: [
    'The organiser’s Overview, a member waiting tables',
    'No Kitchen station: Floor · Section B · Mains directly under Your night',
  ],
  org_day_before: [
    'The organiser’s Overview, 23:59 the day before',
    'Your night only: neither row before 00:00 on the day',
  ],
};

export const FLOOR_WAY_IN_BOARDS = FLOOR_WAY_IN_STATES.map((state) => ({
  title: `Floor on Overview · ${WHAT[state][0]}`,
  what: WHAT[state][1],
  href: `/demo/floor-way-in?state=${state}`,
}));
