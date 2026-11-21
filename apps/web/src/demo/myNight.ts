import { type Card, cardOf } from './shiftClock.ts';
import { CW, signedOutTime } from './doorCheckIn.ts';

export const MY_NIGHT_STATES = [
  'night',
  'before_doors',
  'early',
  'two_shifts',
  'no_station',
  'no_lead',
  'no_lead_none',
  'updated',
  'sparse',
  'stale',
  'loading',
  'app',
] as const;

export type MyNightState = (typeof MY_NIGHT_STATES)[number];

export type Lead = { name: string; phone: string | null; floor: boolean };
export type Guest = { name: string; diet: string | null };
export type Table = { name: string; guests: readonly Guest[] };
export type Moment = { at: string; what: string; for: 'staff' | 'guests' };

export type Night = {
  state: MyNightState;
  event: string;
  now: string;
  linkEndsAt: string;
  name: string;
  station: string | null;
  job: string;
  starts: string;
  ends: string;
  endsOn: string | null;
  later: { job: string; from: string } | null;
  lead: Lead | null;
  rules: string | null;
  timing: readonly Moment[] | null;
  doorsAt: string;
  doorsOpen: boolean;
  tables: readonly Table[] | null;
  clock: Card;
  updated: string | null;
  staleAt: string | null;
  loading: boolean;
  inApp: boolean;
};

export const MN = {
  title: 'Your night',
  only: (time: string) => `Tonight only · ends ${time}`,
  onTonight: 'Tonight you’re on',
  yourShift: 'Your shift',
  times: (starts: string, ends: string) => `${starts} to ${ends}`,
  endsOn: (day: string, time: string) => `Ends on ${day} at ${time}`,
  later: (job: string, from: string) => `Later: ${job} from ${from}`,
  yourLead: 'Your lead',
  floorLead: 'Floor lead',
  call: 'Call',
  callLabel: (lead: Lead) => (lead.floor ? `Call ${lead.name}, floor lead` : `Call ${lead.name}`),
  noLead: 'No lead named yet',
  beforeYouStart: 'Before you start',
  timing: 'Tonight’s timing',
  staff: 'Staff',
  guests: 'Guests',
  yourTables: 'Your tables',
  opensAt: (time: string) => `Opens at ${time} when doors open`,
  updated: (station: string) => `Updated: you’re now on ${station}`,
  staleTitle: 'Couldn’t reach Soirely',
  staleBody: (time: string) => `This is your night as it was at ${time}.`,
  tryAgain: 'Try again',
  loading: 'Loading your night…',
  signedInAs: (name: string) => `Signed in as ${name}`,
  signOut: 'Sign out',
  events: 'Events',
  demoMove: 'Demo: the organiser moves Grace to Section C',
  demoMoveButton: 'Move Grace to Section C',
  demoMoveBody: 'The page changes within 10 seconds and says so to screen readers.',
} as const;

export function guestCount(table: Table): string {
  return table.guests.length === 1 ? '1 guest' : `${table.guests.length} guests`;
}

export function headingOf(night: Night): string {
  return night.station ?? night.job;
}

export function yoursAlone(night: Night): string {
  return CW.shift.signedOutAt(signedOutTime(night.linkEndsAt, night.now));
}

const g = (name: string, diet: string | null = null): Guest => ({ name, diet });

const SECTION_B: readonly Table[] = [
  {
    name: 'Table 7',
    guests: [
      g('Folake Adeyemi', 'Vegetarian'),
      g('Chidi Nwosu'),
      g('Amara Eze', 'No nuts'),
      g('Kunle Ajayi'),
    ],
  },
  { name: 'Table 8', guests: [g('Ngozi Obi'), g('Seun Bakare', 'Halal'), g('Ifeoma Uche')] },
];

const SECTION_C: readonly Table[] = [
  { name: 'Table 11', guests: [g('Tolu Ade'), g('Bisi Lawal', 'Gluten free'), g('Emeka Okoro')] },
];

const RULES =
  'Black shirt, black trousers, closed shoes.\nPhones stay in the staff room during service.\nAsk the guest before clearing a plate.\nAnything spilled or broken: tell your lead first.';

const TIMING: readonly Moment[] = [
  { at: '18:30', what: 'Staff briefing at the service door', for: 'staff' },
  { at: '19:00', what: 'Doors open', for: 'guests' },
  { at: '20:00', what: 'Dinner is served', for: 'guests' },
  { at: '21:30', what: 'Toasts', for: 'guests' },
  { at: '23:30', what: 'Last orders at the bar', for: 'staff' },
];

const DAYO: Lead = { name: 'Dayo Okafor', phone: '+2348031234567', floor: false };
const KEMI: Lead = { name: 'Kemi Adeyinka', phone: '+2348059876543', floor: true };
const IFEANYI: Lead = { name: 'Ifeanyi Obi', phone: '+2348027654321', floor: false };

const NIGHT: Night = {
  state: 'night',
  event: 'Adébáyọ̀ at 60',
  now: '2026-11-14T19:40:00Z',
  linkEndsAt: '2026-11-15T02:00:00Z',
  name: 'Grace Okon',
  station: 'Section B',
  job: 'Waiter',
  starts: '17:00',
  ends: '01:00',
  endsOn: 'Sunday',
  later: null,
  lead: DAYO,
  rules: RULES,
  timing: TIMING,
  doorsAt: '19:00',
  doorsOpen: true,
  tables: SECTION_B,
  clock: cardOf('clocked_in'),
  updated: null,
  staleAt: null,
  loading: false,
  inApp: false,
};

export function myNightStateOf(raw: string | null | undefined): MyNightState {
  return MY_NIGHT_STATES.find((state) => state === raw) ?? 'night';
}

export function nightOf(state: MyNightState): Night {
  const night = { ...NIGHT, state };

  switch (state) {
    case 'before_doors':
      return { ...night, doorsOpen: false, clock: { ...cardOf('ready'), now: 16 * 60 + 20 } };
    case 'early':
      return { ...night, doorsOpen: false, clock: cardOf('before') };
    case 'two_shifts':
      return {
        ...night,
        ends: '23:00',
        endsOn: null,
        later: { job: 'Bartender', from: '23:00' },
        clock: { ...cardOf('clocked_in'), end: 23 * 60 },
      };
    case 'no_station':
      return { ...night, station: null, lead: KEMI, tables: null };
    case 'no_lead':
      return { ...night, lead: KEMI };
    case 'no_lead_none':
      return { ...night, lead: null };
    case 'updated':
      return moved(night);
    case 'sparse':
      return {
        ...night,
        lead: { ...DAYO, phone: null },
        rules: null,
        timing: null,
        tables: SECTION_B.map((table) => ({
          ...table,
          guests: table.guests.map((guest) => ({ ...guest, diet: null })),
        })),
      };
    case 'stale':
      return { ...night, staleAt: '19:32' };
    case 'loading':
      return { ...night, loading: true };
    case 'app':
      return { ...night, inApp: true };
    default:
      return night;
  }
}

/** The organiser moves the person to Section C: the heading, their station's lead and their tables change together. */
export function moved(night: Night): Night {
  return { ...night, station: 'Section C', lead: IFEANYI, tables: SECTION_C, updated: 'Section C' };
}

export function fresh(night: Night): Night {
  return { ...night, staleAt: null };
}

const named: Record<MyNightState, string> = {
  night: 'Tonight, 19:40: doors open, tables open',
  before_doors: 'Before doors, 16:20: Opens at 19:00 when doors open',
  early: 'Early, 15:30: Clock in opens at 16:00',
  two_shifts: 'Two shifts: Later: Bartender from 23:00',
  no_station: 'No station: Tonight you’re on Waiter, the floor lead, no tables',
  no_lead: 'No station lead: the floor lead stands in, with Call',
  no_lead_none: 'No lead at all: No lead named yet',
  updated: 'Updated: you’re now on Section C, announced',
  sparse: 'Sparse: no rules, no timing, no dietary needs, no phone for the lead',
  stale: 'Couldn’t reach Soirely: your night as it was at 19:32',
  loading: 'Loading',
  app: 'In the app: no link line, Sign out stays',
};

export const MY_NIGHT_PAGES: readonly {
  name: string;
  states: readonly { to: string; name: string }[];
}[] = [
  {
    name: 'The staff member’s page, 390 to 1280',
    states: MY_NIGHT_STATES.map((state) => ({
      to: `/demo/my-night?state=${state}`,
      name: named[state],
    })),
  },
];
