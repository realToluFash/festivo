import { type Card, cardOf } from './shiftClock.ts';
import { DOOR_ZONE, clockOf, readerLocale } from './doorCode.ts';

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
  'section_checkin',
  'section_door',
  'section_pass',
  'section_view',
  'kitchen',
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
  /** The station on this shift is a section station (sc-3910). */
  section: boolean;
  /** The level the job carries (sc-4002), or the person's role. */
  access: Access;
  /** The job's level opens check-in at the door (sc-28230). */
  checksIn: boolean;
};

export type Access =
  'Can work the floor' | 'Can work the pass' | 'Can view' | 'Can check guests in' | 'Lead';

/** sc-4002: of these, who opens the floor; the app's whole list is `opensFloor` in apps/mobile/src/demo/floor/floorWayIn.ts. */
const OPENS_FLOOR: readonly Access[] = ['Can work the floor', 'Lead'];

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
  opensAt: (time: string) => `Shown when doors open, at ${time}`,
  updated: (station: string) => `Updated: you’re now on ${station}`,
  staleTitle: 'Cannot reach Soirely',
  staleBody: (time: string) => `This is your night as it was at ${time}.`,
  tryAgain: 'Try again',
  loading: 'Loading your night…',
  signedInAs: (name: string) => `Signed in as ${name}`,
  signOut: 'Sign out',
  overview: 'Overview',
  demoMove: 'Demo: the organiser moves Grace to Section C',
  demoMoveButton: 'Move Grace to Section C',
  demoMoveBody: 'The page changes within 10 seconds and says so to screen readers.',
  openFloor: 'Open Floor',
  floor: 'Floor',
  floorStandsIn: (name: string) =>
    `Floor in a browser is sc-4021’s, and it has no web demo yet: this page stands in for it, to show the way back. Still signed in as ${name}, with no new sign-in.`,
  yoursAlone: (time: string) =>
    `This link is yours alone. You are signed in until ${time}. Nothing stays on this device.`,
} as const;

export function guestCount(table: Table): string {
  return table.guests.length === 1 ? '1 guest' : `${table.guests.length} guests`;
}

export function headingOf(night: Night): string {
  return night.station ?? night.job;
}

const LISBON_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: DOOR_ZONE });

/** As the product's `atWords` writes it: the clock alone on today's date, else "Sun, Nov 15, 02:00" in the reader's locale. */
export function untilWords(until: string, now: string): string {
  if (LISBON_DAY.format(new Date(until)) === LISBON_DAY.format(new Date(now)))
    return clockOf(until);
  const day = new Intl.DateTimeFormat(readerLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: DOOR_ZONE,
  });

  return `${day.format(new Date(until))}, ${clockOf(until)}`;
}

export function yoursAlone(night: Night): string {
  return MN.yoursAlone(untilWords(night.linkEndsAt, night.now));
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
  section: true,
  access: 'Can work the floor',
  checksIn: false,
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
      return { ...night, station: null, section: false, lead: KEMI, tables: null };
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
    case 'section_checkin':
      return { ...night, access: 'Lead', checksIn: true };
    case 'section_door':
      return { ...night, access: 'Can check guests in', checksIn: true };
    case 'section_pass':
      return { ...night, access: 'Can work the pass' };
    case 'section_view':
      return { ...night, access: 'Can view' };
    case 'kitchen':
      return {
        ...night,
        name: 'Gbenga Salami',
        station: 'Fryer',
        job: 'Cook',
        tables: null,
        section: false,
        access: 'Can work the pass',
      };
    default:
      return night;
  }
}

/** The organiser moves the person to Section C: the heading, their station's lead and their tables change together. */
export function moved(night: Night): Night {
  return { ...night, station: 'Section C', lead: IFEANYI, tables: SECTION_C, updated: 'Section C' };
}

/** Open Floor above Your shift on a section station whose access opens the floor (sc-98893). */
export function openFloorOf(night: Night): { label: string; href: string } | null {
  return night.section && OPENS_FLOOR.includes(night.access)
    ? { label: MN.openFloor, href: `/demo/my-night/floor?state=${night.state}` }
    : null;
}

export function fresh(night: Night): Night {
  return { ...night, staleAt: null };
}

const named: Record<MyNightState, string> = {
  night: 'Tonight, 19:40: doors open, tables open; Open Floor above Your shift',
  before_doors: 'Before doors, 16:20: Shown when doors open, at 19:00',
  early: 'Early, 15:30: Clock in opens at 16:00',
  two_shifts: 'Two shifts: Later: Bartender from 23:00',
  no_station: 'No station: Tonight you’re on Waiter, the floor lead, no tables',
  no_lead: 'No station lead: the floor lead stands in, with Call',
  no_lead_none: 'No lead at all: No lead named yet',
  updated: 'Updated: you’re now on Section C, announced',
  sparse: 'Sparse: no rules, no timing, no dietary needs, no phone for the lead',
  stale: 'Cannot reach Soirely: your night as it was at 19:32',
  loading: 'Loading',
  app: 'In the app: no link line, Sign out stays',
  section_checkin:
    'A Lead whose job checks in: Check-in primary, Open Floor the secondary under it',
  section_door: 'Can check guests in on a section: Check-in alone, no Open Floor',
  section_pass: 'Can work the pass on a section: no Open Floor',
  section_view: 'Can view on a section: no Open Floor',
  kitchen: 'A kitchen station: no Open Floor, and Open {station} is in the app only',
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
