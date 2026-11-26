import { type Card, cardOf } from '../shiftClock/shiftClockModel.ts';
import { EVENT as STATION_EVENT } from '../station/stationModel.ts';
import { type Access, type ShiftStation, openButton } from '../station/wayIn.ts';

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
  'app_event',
  'kitchen',
  'kitchen_pass',
  'kitchen_checkin',
  'kitchen_floor',
  'kitchen_dishes_none',
  'kitchen_browser',
] as const;

export type MyNightState = (typeof MY_NIGHT_STATES)[number];

export type Lead = { name: string; phone: string | null; floor: boolean };
export type Guest = { name: string; diet: string | null };
export type Table = { name: string; guests: readonly Guest[] };
export type Moment = { at: string; what: string; for: 'staff' | 'guests' };

export type Night = {
  state: MyNightState;
  event: string;
  linkEnds: string;
  linkEndsDay: string;
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
  /** What the station on this shift is (sc-3910), and the level the job carries (sc-4002). */
  kind: ShiftStation;
  access: Access;
  /** Where Open {station} goes, by the station's own sample. */
  opens: string | null;
  /** The job's level opens check-in at the door (sc-28230). */
  checksIn: boolean;
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
  opensAt: (time: string) => `Shown when doors open, at ${time}`,
  updated: (station: string) => `Updated: you’re now on ${station}`,
  staleTitle: 'Cannot reach Soirely',
  staleBody: (time: string) => `This is your night as it was at ${time}.`,
  tryAgain: 'Try again',
  loading: 'Loading your night…',
  signedInAs: (name: string) => `Signed in as ${name}`,
  yoursAlone: (when: string) =>
    `This link is yours alone. You are signed in until ${when}. Nothing stays on this device.`,
  signOut: 'Sign out',
  signOutLands:
    'Sign out returns to Confirm it’s you with “Signed out.” (sc-4235). That page is in the web’s demo, /demo/staff-sign-in?state=signed-out.',
  backToDemo: 'Back to the demo list',
  overview: 'Overview',
  demoMove: 'Demo: the organiser moves Grace to Section C',
  demoMoveButton: 'Move Grace to Section C',
  demoMoveBody: 'The page changes within 10 seconds and says so to screen readers.',
  demoKitchenMoveButton: 'Move Gbenga to the Grill',
  checkIn: 'Check-in',
} as const;

export function guestCount(table: Table): string {
  return table.guests.length === 1 ? '1 guest' : `${table.guests.length} guests`;
}

export function headingOf(night: Night): string {
  return night.station ?? night.job;
}

export function signedInUntil(night: Night): string {
  return `${night.linkEndsDay}, ${night.linkEnds}`;
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
  linkEnds: '02:00',
  linkEndsDay: 'Sun, Nov 29',
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
  kind: { kind: 'section', name: 'Section B' },
  access: 'Can work the floor',
  opens: null,
  checksIn: false,
};

const RONKE: Lead = { name: 'Ronke Alade', phone: '+2348034567890', floor: false };

/** Gbenga Salami on the Fryer, on the station's own sample (sc-4015). */
const KITCHEN: Night = {
  ...NIGHT,
  state: 'kitchen',
  event: STATION_EVENT,
  name: 'Gbenga Salami',
  station: 'Fryer',
  job: 'Cook',
  lead: RONKE,
  tables: null,
  inApp: true,
  kind: { kind: 'kitchen', name: 'Fryer', dishes: 2 },
  access: 'Can work the pass',
  opens: '/demo/kitchen-station?from=night&on=fryer',
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
      return { ...night, station: null, kind: null, lead: KEMI, tables: null };
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
    case 'app_event':
      return { ...night, inApp: true };
    case 'kitchen':
      return { ...KITCHEN, state };
    case 'kitchen_pass':
      return {
        ...KITCHEN,
        state,
        name: 'Ronke Alade',
        station: 'Pass',
        job: 'Pass lead',
        lead: { name: 'Bimpe Ojo', phone: '+2348091112223', floor: true },
        kind: { kind: 'kitchen', name: 'Pass', dishes: 2 },
        opens: '/demo/kitchen-station?from=night&on=pass',
      };
    case 'kitchen_checkin':
      return {
        ...KITCHEN,
        state,
        name: 'Ronke Alade',
        station: 'Pass',
        job: 'Pass lead',
        lead: { name: 'Bimpe Ojo', phone: '+2348091112223', floor: true },
        kind: { kind: 'kitchen', name: 'Pass', dishes: 2 },
        access: 'Lead',
        opens: '/demo/kitchen-station?from=night&on=pass',
        checksIn: true,
      };
    case 'kitchen_floor':
      return { ...KITCHEN, state, access: 'Can work the floor' };
    case 'kitchen_dishes_none':
      return {
        ...KITCHEN,
        state,
        station: 'Dessert table',
        kind: { kind: 'kitchen', name: 'Dessert table', dishes: 0 },
      };
    case 'kitchen_browser':
      return { ...KITCHEN, state, inApp: false };
    default:
      return night;
  }
}

/** The organiser moves the person to Section C: the heading, their station's lead and their tables change together. */
export function moved(night: Night): Night {
  return { ...night, station: 'Section C', lead: IFEANYI, tables: SECTION_C, updated: 'Section C' };
}

/** Team (sc-36034) moves Gbenga to the Grill: Your shift and Open {station} change together. */
export function movedToGrill(night: Night): Night {
  return {
    ...night,
    station: 'Grill',
    kind: { kind: 'kitchen', name: 'Grill', dishes: 2 },
    opens: '/demo/kitchen-station?from=night&on=grill',
    updated: 'Grill',
  };
}

/** Check-in above Your shift for a job that checks in, as sc-28230 draws it; null shows no button. */
export function checkInOf(night: Night): { label: string; href: string } | null {
  return night.checksIn
    ? { label: MN.checkIn, href: '/demo/guests/check-in?state=door&from=night' }
    : null;
}

/** Open {station} above Your shift, under Check-in as the secondary button when the job checks in too (sc-95382). */
export function openOf(night: Night): { label: string; href: string; primary: boolean } | null {
  const label = openButton(night.kind, night.access, night.inApp);

  return label == null || night.opens == null
    ? null
    : { label, href: night.opens, primary: checkInOf(night) == null };
}

export function fresh(night: Night): Night {
  return { ...night, staleAt: null };
}

const LEAD: Record<MyNightState, readonly [string, string]> = {
  night: ['Tonight, 19:40', 'Doors open, tables open; the demo moves Grace to Section C'],
  before_doors: ['Before doors, 16:20', 'Shown when doors open, at 19:00'],
  early: ['Early, 15:30', 'Clock in opens at 16:00; tables held'],
  two_shifts: ['Two shifts', 'Later: Bartender from 23:00'],
  no_station: ['No station', 'Tonight you’re on Waiter, the floor lead, no tables'],
  no_lead: ['No station lead', 'The floor lead stands in, with Call'],
  no_lead_none: ['No lead at all', 'No lead named yet, no Call'],
  updated: ['Updated', 'Updated: you’re now on Section C; the heading, lead and tables change'],
  sparse: ['Sparse', 'No rules, no timing, no dietary needs, a lead with no phone'],
  stale: ['Cannot reach Soirely', 'Your night as it was at 19:32, with Try again'],
  loading: ['Loading', 'Loading your night…'],
  app: ['In the app', 'Opened from the event’s Overview: ‹ Overview; no link line, Sign out stays'],
  app_event: [
    'In the app, from the event',
    'A staff-link holder’s event: Your night heads Overview’s rows and opens the page',
  ],
  kitchen: [
    'On a kitchen station',
    'Open Fryer above Your shift opens Kitchen station, ‹ Your night; the demo moves Gbenga to the Grill',
  ],
  kitchen_pass: ['On the Pass', 'Open Pass: the Pass dishes, so it opens as a station'],
  kitchen_checkin: [
    'On the Pass, with Check-in',
    'A Lead whose job checks in: Check-in first and primary, Open Pass the secondary button under it',
  ],
  kitchen_floor: ['Can work the floor on a kitchen station', 'No button: the station refuses it'],
  kitchen_dishes_none: ['A station that dishes nothing', 'Dessert table dishes no item: no button'],
  kitchen_browser: [
    'On a kitchen station, in a browser',
    'No button: the station is in the app only',
  ],
};

export const MY_NIGHT_BOARDS = MY_NIGHT_STATES.map((state) => ({
  title: `Your night · ${LEAD[state][0]}`,
  what: LEAD[state][1],
  href: `/demo/my-night?state=${state}`,
}));

/** Your night's row on the event's Overview: where they are, then the shift's times. */
export function rowLineOf(night: Night): string {
  return `${headingOf(night)} · ${MN.times(night.starts, night.ends)}`;
}
