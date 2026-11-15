import type { DemoLink } from './settings.ts';

/** The pass's print controls at a desk (sc-4018, PassPrint.dc.html on page 35): Printing in version B, so no Print when fired. */
export const PW = {
  title: 'Pass · Main',
  event: 'Adébáyọ̀ at 60',
  eventLine: 'Eko Hotel, Lagos · started 19:00',
  happening: 'Happening now',
  tabs: ['To make', 'Plates up', 'All'],
  printing: 'Printing',
  printTickets: 'Print tickets',
  noneInCourse: '· none in Main',
  ticketsHeading: 'Tickets · longest wait first',
  emptyTitle: 'No tickets for Main yet',
  emptyBody:
    'They show here as Main is fired for each table. Print tickets opens once there is one.',
  allergy: 'Allergy',
  preference: 'Preference',
  platesUp: 'Plates up',
  print: 'Print',
  stillToMake: 'Main · still to make',
  close: 'Close',
  which: 'Which tickets',
  noneLeft: 'None left to print',
  staleNote:
    'These print as this screen shows them, as of 20:09. Each ticket carries AS OF 20:09 at the top.',
  cancel: 'Cancel',
  dialogueLine: (roll: string) =>
    `Opens this browser’s print dialogue, laid out for the ${roll} roll.`,
  deviceLine: 'This browser only. Saved as you change it.',
  paperRoll: 'Paper roll',
  whenFired: 'Print when fired',
  needsIpad: 'Print when fired needs the Soirely app on an iPad.',
  dialogueCaption: 'The browser’s print dialogue · a plain stand-in, not Soirely’s',
  newWords: 'New words · [en]',
  asOf: 'as of 20:09',
  connected: 'Connected · up to date 20:09',
  noConnection: 'No connection · as of 20:09',
  demoNote:
    'Demo only: the stand-in shows where the browser’s print dialogue opens. Nothing is printed or stored.',
} as const;

const plural = (n: number, one: string, other: string): string => `${n} ${n === 1 ? one : other}`;

export const printedLine = (at: string): string => `Printed ${at}`;
export const notPrintedYet = (n: number): string =>
  `Not printed yet · ${plural(n, 'ticket', 'tickets')}`;
export const allFor = (n: number): string =>
  `All tickets for Main · ${n} tickets, printed ones again`;
export const forMain = (n: number): string => `${plural(n, 'ticket', 'tickets')} for Main`;
export const printN = (n: number): string => `Print ${plural(n, 'ticket', 'tickets')}`;
export const allergyPlates = (n: number): string =>
  `${plural(n, 'allergy plate', 'allergy plates')} still at the pass`;
export const laidOut = (roll: string, stale: boolean): string =>
  `Laid out as PrintedTicket draws it, for the ${roll} roll${stale ? ', with AS OF 20:09 at the top.' : '.'}`;

export type Tone = 'chicken' | 'fish' | 'suya' | 'tofu' | 'none';
export type Roll = '80' | '58';
export type Which = 'unprinted' | 'all';
export type Connection = 'connected' | 'none';

export const ROLLS: Record<Roll, string> = { '80': '80 mm', '58': '58 mm' };

export interface PassTicket {
  table: string;
  covers: number;
  wait: number;
  allergies: readonly string[];
  lines: readonly { count: number; dish: string; tone: Tone; flag?: string; preference?: true }[];
  preference?: string;
}

/** Page 35's sample pass (Service.dc.html). */
export const TICKETS: readonly PassTicket[] = [
  {
    table: 'T9',
    covers: 10,
    wait: 14,
    allergies: ['Nut · seat 3 · Adaeze O-W', 'Nut · seat 4 · Nneka O-W'],
    lines: [
      { count: 6, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 2, dish: 'Jollof · chicken · plantain', tone: 'chicken', flag: 'No nut' },
      { count: 1, dish: 'Pounded yam · suya · moi moi', tone: 'suya' },
      { count: 1, dish: 'Couscous · tofu · salad', tone: 'tofu', flag: 'Veg', preference: true },
    ],
    preference: '1 halal · seat 7 · covered by chicken',
  },
  {
    table: 'T12',
    covers: 10,
    wait: 6,
    allergies: [],
    lines: [
      { count: 5, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 3, dish: 'Jollof · fish · salad', tone: 'fish' },
      { count: 2, dish: 'Pounded yam · suya · moi moi', tone: 'suya' },
    ],
  },
  {
    table: 'T13',
    covers: 10,
    wait: 4,
    allergies: ['Coeliac · seat 2 · Tomás F-L'],
    lines: [
      { count: 4, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 4, dish: 'Jollof · fish · salad', tone: 'fish' },
      { count: 1, dish: 'Jollof · fish · salad', tone: 'fish', flag: 'No gluten' },
      { count: 1, dish: 'Chef’s choice · no pick', tone: 'none' },
    ],
  },
  {
    table: 'T14',
    covers: 8,
    wait: 3,
    allergies: [],
    lines: [
      { count: 6, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 2, dish: 'Couscous · tofu · salad', tone: 'tofu', flag: 'Veg', preference: true },
    ],
    preference: '2 vegetarian',
  },
  {
    table: 'T15',
    covers: 10,
    wait: 2,
    allergies: [],
    lines: [
      { count: 7, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 3, dish: 'Pounded yam · suya · moi moi', tone: 'suya' },
    ],
  },
  {
    table: 'T16',
    covers: 10,
    wait: 1,
    allergies: ['Shellfish · seat 9 · Ama B'],
    lines: [
      { count: 8, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 2, dish: 'Jollof · fish · salad', tone: 'fish' },
    ],
  },
];

export const NOW = '20:12';

/** This browser's own record of what it sent to print; on the web nothing prints by itself, so nothing fails. */
export type Printed = Readonly<Record<string, string>>;

export interface PassStart {
  printed: Printed;
  panel: 'tickets' | 'printing' | null;
  noTickets: boolean;
  connection: Connection;
}

export const PASS_STATES = [
  'ticket',
  'printed',
  'print-tickets',
  'none-left',
  'no-tickets',
  'printing',
  'offline',
  'reconnecting',
] as const;
export type PassState = (typeof PASS_STATES)[number];

export function passStateOf(raw: string | null): PassState {
  return PASS_STATES.find((state) => state === raw) ?? 'ticket';
}

const TWO: Printed = { T9: '20:09', T12: '20:10' };

export function startOf(state: PassState): PassStart {
  const base: PassStart = { printed: {}, panel: null, noTickets: false, connection: 'connected' };

  switch (state) {
    case 'ticket':
      return base;
    case 'printed':
      return { ...base, printed: TWO };
    case 'print-tickets':
      return { ...base, printed: TWO, panel: 'tickets' };
    case 'none-left':
      return {
        ...base,
        printed: Object.fromEntries(TICKETS.map((ticket) => [ticket.table, '20:08'])),
        panel: 'tickets',
      };
    case 'no-tickets':
      return { ...base, noTickets: true };
    case 'printing':
      return { ...base, panel: 'printing' };
    case 'offline':
      return { ...base, connection: 'none', printed: { T9: '20:09' }, panel: 'tickets' };
    case 'reconnecting':
      return { ...base, connection: 'none', printed: { T9: '20:09' } };
  }
}

export interface PrintChoices {
  unprinted: readonly PassTicket[];
  noneLeft: boolean;
  which: Which;
  chosen: readonly PassTicket[];
}

export function choicesOf(
  tickets: readonly PassTicket[],
  printed: Printed,
  which: Which,
): PrintChoices {
  const unprinted = tickets.filter((ticket) => printed[ticket.table] == null);
  const noneLeft = unprinted.length === 0;
  const settled = noneLeft ? 'all' : which;

  return { unprinted, noneLeft, which: settled, chosen: settled === 'all' ? tickets : unprinted };
}

export function sentToPrint(printed: Printed, tables: readonly string[], at: string): Printed {
  return { ...printed, ...Object.fromEntries(tables.map((table) => [table, at])) };
}

export function stillToMake(
  tickets: readonly PassTicket[],
): { dish: string; tone: Tone; count: number }[] {
  const totals = new Map<string, { dish: string; tone: Tone; count: number }>();
  for (const ticket of tickets)
    for (const line of ticket.lines) {
      const dish = line.dish.split(' · ').slice(0, 2).join(' · ');
      const was = totals.get(dish);
      totals.set(dish, { dish, tone: line.tone, count: (was?.count ?? 0) + line.count });
    }

  return [...totals.values()];
}

const NAMES: Record<PassState, string> = {
  ticket: 'Print on a ticket, beside Plates up',
  printed: 'Printed {time} on a ticket',
  'print-tickets': 'Print tickets · Not printed yet chosen',
  'none-left': 'Print tickets · None left to print, All chosen',
  'no-tickets': 'Print tickets disabled · no tickets in Main',
  printing: 'Printing · version B, Paper roll and the iPad line',
  offline: 'No connection · Print tickets open, as of 20:09',
  reconnecting: 'No connection · Print on each ticket, as of 20:09',
};

export const PASS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The pass’s print controls (sc-4018)',
    states: PASS_STATES.map((state) => ({ to: `/demo/pass?state=${state}`, name: NAMES[state] })),
  },
];
