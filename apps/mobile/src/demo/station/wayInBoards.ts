import { type CodeChoice } from '../doorCode/DoorCodeModel.ts';
import { type EventDay, type Where, opensStations, rowLine, rowShows } from './wayIn.ts';

export const WAY_IN_STATES = [
  'own_course',
  'own_before',
  'past_midnight',
  'last_pick',
  'pick',
  'day_before',
  'finished',
  'floor',
  'view',
] as const;

export type WayInState = (typeof WAY_IN_STATES)[number];

const DAY: EventDay = {
  startDay: '2026-11-28',
  timeZone: 'Africa/Lagos',
  finished: false,
  calledOff: false,
};

const TONIGHT = new Date('2026-11-28T18:40:00Z');

interface Sample {
  role: CodeChoice;
  who: string;
  /** On the event's roster, so Your night heads Overview (sc-3915). */
  rostered: boolean;
  now: Date;
  finished: boolean;
  where: Where;
  opens: string;
  stationState: string;
}

const GBENGA: Sample = {
  role: 'Can work the pass',
  who: 'Gbenga Salami',
  rostered: true,
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

const SAMPLES: Record<WayInState, Sample> = {
  own_course: GBENGA,
  own_before: {
    ...GBENGA,
    where: { ...GBENGA.where, course: null },
    stationState: 'noCourse',
  },
  past_midnight: { ...GBENGA, now: new Date('2026-11-28T23:30:00Z') },
  last_pick: ADA,
  pick: { ...ADA, where: { ...ADA.where, lastPick: null }, opens: 'none' },
  day_before: { ...GBENGA, now: new Date('2026-11-27T22:59:00Z') },
  finished: { ...GBENGA, now: new Date('2026-11-29T01:10:00Z'), finished: true },
  floor: { ...GBENGA, role: 'Can work the floor', who: 'Funmi Bakare' },
  view: { ...ADA, role: 'Can view', who: 'Ngozi Obi' },
};

export interface WayInOverview {
  role: CodeChoice;
  who: string;
  rostered: boolean;
  station: { line: string; href: string } | null;
}

export function wayInStateOf(raw: string | undefined): WayInState {
  return WAY_IN_STATES.find((state) => state === raw) ?? 'own_course';
}

export function overviewOf(state: WayInState): WayInOverview {
  const sample = SAMPLES[state];
  const shows =
    opensStations(sample.role) && rowShows({ ...DAY, finished: sample.finished }, sample.now);

  return {
    role: sample.role,
    who: sample.who,
    rostered: sample.rostered,
    station: shows
      ? {
          line: rowLine(sample.where),
          href: `/demo/kitchen-station?state=${sample.stationState}&from=overview&on=${sample.opens}`,
        }
      : null,
  };
}

const WHAT: Record<WayInState, readonly [string, string]> = {
  own_course: ['Their own station', 'Kitchen station · Fryer · Mains, under Your night'],
  own_before: ['Before any course is fired', 'Kitchen station · Fryer'],
  past_midnight: ['Past midnight', '00:30 on Sunday, before the end: the row stays'],
  last_pick: [
    'A join code, a last pick',
    'No Your night row: Kitchen station · Grill · Mains is first',
  ],
  pick: ['A join code, nothing picked', 'Kitchen station · Pick a station, first, opens the list'],
  day_before: ['23:59 the day before', 'Your night only: the row shows from 00:00 on the day'],
  finished: ['Finished', 'Your night only: the row goes once the event is Finished'],
  floor: ['Can work the floor', 'Your night only: Overview as it is today'],
  view: ['Can view', 'No row: Overview as it is today'],
};

export const KITCHEN_WAY_IN_BOARDS = WAY_IN_STATES.map((state) => ({
  title: `Kitchen station on Overview · ${WHAT[state][0]}`,
  what: WHAT[state][1],
  href: `/demo/kitchen-way-in?state=${state}`,
}));
