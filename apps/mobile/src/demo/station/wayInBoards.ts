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
} from './wayIn.ts';

const ROW_STATES = [
  'own_course',
  'own_before',
  'answering',
  'offline',
  'past_midnight',
  'last_pick',
  'pick',
  'day_before',
  'finished',
  'floor',
  'view',
  'floor_alone',
  'pass_alone',
  'run_floor',
  'run_floor_alone',
] as const;

const ORGANISER_STATES = ['org_night', 'org_no_night', 'org_day_before'] as const;

export const WAY_IN_STATES = [...ROW_STATES, ...ORGANISER_STATES] as const;

export type WayInState = (typeof WAY_IN_STATES)[number];
type RowState = (typeof ROW_STATES)[number];
type OrganiserState = (typeof ORGANISER_STATES)[number];

const DAY: EventDay = {
  startDay: '2026-11-28',
  timeZone: 'Africa/Lagos',
  finished: false,
  calledOff: false,
};

const TONIGHT = new Date('2026-11-28T18:40:00Z');

/** The organiser's Overview draws the Events sample's own wedding, in London. */
export const ORGANISER_EVENT = 'evt-wed-4';

const ORGANISER_DAY: EventDay = {
  startDay: '2026-11-05',
  timeZone: 'Europe/London',
  finished: false,
  calledOff: false,
};

interface Sample {
  role: InsideLevel;
  who: string;
  /** On the event's roster, so Your night heads Overview (sc-3915). */
  rostered: boolean;
  night: MyNightState;
  now: Date;
  finished: boolean;
  where: Where;
  opens: string;
  stationState: string;
  /** The stations read has not answered yet: no row until it does. */
  answering?: boolean;
  /** No connection: the last answered read, kept with its time. */
  lastRead?: Date;
}

const GBENGA: Sample = {
  role: 'Can work the pass',
  who: 'Gbenga Salami',
  rostered: true,
  night: 'kitchen',
  now: TONIGHT,
  finished: false,
  where: { own: 'Fryer', lastPick: null, course: 'Mains' },
  opens: 'fryer',
  stationState: 'here',
};

const ADA: Sample = {
  ...GBENGA,
  who: 'Ada Nnaji',
  rostered: false,
  where: { own: null, lastPick: 'Grill', course: 'Mains' },
  opens: 'picked-grill',
};

const DAY_BEFORE = new Date('2026-11-27T22:59:00Z');

const FUNMI: Sample = {
  ...GBENGA,
  role: 'Can work the floor',
  who: 'Funmi Bakare',
  rostered: false,
  night: 'night',
};

const KUNLE: Sample = { ...ADA, role: 'Can run the floor', who: 'Kunle Adeyemi' };

const SAMPLES: Record<RowState, Sample> = {
  own_course: GBENGA,
  own_before: {
    ...GBENGA,
    where: { ...GBENGA.where, course: null },
    stationState: 'noCourse',
  },
  answering: { ...GBENGA, answering: true },
  offline: { ...GBENGA, lastRead: new Date('2026-11-28T18:38:00Z') },
  past_midnight: { ...GBENGA, now: new Date('2026-11-28T23:30:00Z') },
  last_pick: ADA,
  pick: { ...ADA, where: { ...ADA.where, lastPick: null }, opens: 'none' },
  day_before: { ...GBENGA, now: DAY_BEFORE },
  finished: { ...GBENGA, now: new Date('2026-11-29T01:10:00Z'), finished: true },
  floor: { ...FUNMI, rostered: true },
  view: { ...ADA, role: 'Can view', who: 'Ngozi Obi' },
  floor_alone: FUNMI,
  pass_alone: { ...ADA, now: DAY_BEFORE },
  run_floor: KUNLE,
  run_floor_alone: { ...KUNLE, now: DAY_BEFORE },
};

/** An Owner, an Admin, anyone else in the organisation, or Can edit: the organiser's page of cards. */
interface OrganiserSample {
  role: 'Lead' | 'Admin';
  rostered: boolean;
  now: Date;
  where: Where;
  opens: string;
  /** Your night's own sample, for a member with a shift. */
  night: 'kitchen_checkin';
}

const RONKE: OrganiserSample = {
  role: 'Lead',
  rostered: true,
  now: new Date('2026-11-05T20:40:00Z'),
  where: { own: 'Pass', lastPick: null, course: 'Mains' },
  opens: 'pass',
  night: 'kitchen_checkin',
};

const ORGANISER: Record<OrganiserState, OrganiserSample> = {
  org_night: RONKE,
  org_no_night: {
    ...RONKE,
    role: 'Admin',
    rostered: false,
    where: { own: null, lastPick: 'Grill', course: 'Mains' },
    opens: 'picked-grill',
  },
  org_day_before: { ...RONKE, now: new Date('2026-11-04T23:59:00Z') },
};

/** How long the demo's stations read takes to answer, for the `answering` state. */
export const READ_ANSWERS_IN = 1500;

type StationLink = { line: string; href: string; answersIn?: number } | null;

export type WayInOverview =
  | {
      page: 'rows';
      role: InsideLevel;
      who: string;
      rostered: boolean;
      night: MyNightState;
      station: StationLink;
    }
  | {
      page: 'organiser';
      role: OrganiserSample['role'];
      rostered: boolean;
      now: Date;
      night: OrganiserSample['night'];
      station: StationLink;
    };

export function wayInStateOf(raw: string | undefined): WayInState {
  return WAY_IN_STATES.find((state) => state === raw) ?? 'own_course';
}

function isOrganiser(state: WayInState): state is OrganiserState {
  return ORGANISER_STATES.some((one) => one === state);
}

function linkOf(where: Where, stationState: string, opens: string): NonNullable<StationLink> {
  return {
    line: rowLine(where),
    href: `/demo/kitchen-station?state=${stationState}&from=overview&on=${opens}`,
  };
}

function sampleLink(sample: Sample): StationLink {
  const link = linkOf(sample.where, sample.stationState, sample.opens);
  if (sample.lastRead != null) {
    return { ...link, line: KS.asOf(link.line, readAt(sample.lastRead, DAY.timeZone)) };
  }

  return sample.answering === true ? { ...link, answersIn: READ_ANSWERS_IN } : link;
}

export function overviewOf(state: WayInState): WayInOverview {
  if (isOrganiser(state)) {
    const organiser = ORGANISER[state];

    return {
      page: 'organiser',
      role: organiser.role,
      rostered: organiser.rostered,
      now: organiser.now,
      night: organiser.night,
      station:
        opensStations(organiser.role) && rowShows(ORGANISER_DAY, organiser.now)
          ? linkOf(organiser.where, 'here', organiser.opens)
          : null,
    };
  }

  const sample = SAMPLES[state];
  const shows =
    opensStations(sample.role) && rowShows({ ...DAY, finished: sample.finished }, sample.now);

  return {
    page: 'rows',
    role: sample.role,
    who: sample.who,
    rostered: sample.rostered,
    night: sample.night,
    station: shows ? sampleLink(sample) : null,
  };
}

const WHAT: Record<WayInState, readonly [string, string]> = {
  own_course: ['Their own station', 'Kitchen station · Fryer · Mains, under Your night'],
  own_before: ['Before any course is fired', 'Kitchen station · Fryer'],
  answering: [
    'The stations read not yet answered',
    'No row and no placeholder, then Kitchen station · Fryer · Mains fades in over 200 ms; none under Reduce motion',
  ],
  offline: ['No connection', 'Kitchen station · Fryer · Mains · as of 19:38, its last line kept'],
  past_midnight: ['Past midnight', '00:30 on Sunday, before the end: the row stays'],
  last_pick: [
    'A join code, a last pick',
    'No Your night row: Kitchen station · Grill · Mains is first',
  ],
  pick: ['A join code, nothing picked', 'Kitchen station · Pick a station, first, opens the list'],
  day_before: ['23:59 the day before', 'Your night only: the row shows from 00:00 on the day'],
  finished: ['Finished', 'Your night only: the row goes once the event is Finished'],
  floor: ['Can work the floor', 'The card and Your night: no Kitchen station, Guests or People'],
  view: ['Can view', 'No row: Guests and People as today, Guests a tab on the phone'],
  floor_alone: [
    'Can work the floor, no shift',
    'The card alone: no row, no placeholder, and only Overview and More in the tabs',
  ],
  pass_alone: [
    'Can work the pass, no shift, the day before',
    'The card alone: Kitchen station shows from 00:00 on the day',
  ],
  run_floor: [
    'Can run the floor, invited, no shift',
    'The card, then Kitchen station · Grill · Mains: no Your night, Guests or People',
  ],
  run_floor_alone: [
    'Can run the floor, no shift, the day before',
    'The card alone, its level line with no job',
  ],
  org_night: [
    'The organiser’s Overview, a Lead on the Pass',
    'Kitchen station · Pass · Mains directly under Your night, above the guest numbers card; first in the right-hand column on its side',
  ],
  org_no_night: [
    'The organiser’s Overview, an Admin with no shift',
    'No Your night row: Kitchen station · Grill · Mains takes its place, under the event’s card',
  ],
  org_day_before: [
    'The organiser’s Overview, 23:59 the day before',
    'Your night only: the row shows from 00:00 on the day, as on the row list',
  ],
};

export const KITCHEN_WAY_IN_BOARDS = WAY_IN_STATES.map((state) => ({
  title: `Kitchen station on Overview · ${WHAT[state][0]}`,
  what: WHAT[state][1],
  href: `/demo/kitchen-way-in?state=${state}`,
}));
