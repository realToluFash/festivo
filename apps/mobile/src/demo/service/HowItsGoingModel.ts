/** How it's going (sc-34107, HowItsGoing.dc.html on page 35): the floor lead's view of the current course, on the API's service summary read. */

export type SectionId = 'A' | 'B' | 'C' | 'D' | 'E';
export type TrayStage = 'Dishing' | 'Checked' | 'On its way';
export type AlertKind =
  'allergy' | 'paused' | 'leftBehind' | 'heldUp' | 'behind' | 'station' | 'request' | 'nobody';
export type AlertButton = 'Team' | 'Go to table' | 'Give to…';

export interface Tray {
  table: string;
  section: SectionId;
  plates: number;
  stage: TrayStage;
  pausedBy: string | null;
}

export interface Waiter {
  name: string;
  home: SectionId;
  asWell: SectionId | null;
  tray: Tray | null;
}

export interface Section {
  id: SectionId;
  name: string;
  people: number;
  served: number;
  due: number;
  behind: boolean;
  leftEach: number;
  toServe: number;
}

export interface KitchenItem {
  item: string;
  station: string | null;
  people: string;
  state: 'Ready' | 'Preparing' | null;
  readyIn: number | null;
  heldUpMin: number | null;
  waiting: number;
}

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  sub: string;
  flag: string;
  button: AlertButton;
  table: string;
  waiter: string;
}

export interface Course {
  name: string;
  served: number;
  due: number;
  onTray: number;
  kitchen: number;
  toServe: number;
  notHere: number;
}

export interface Earlier {
  course: string;
  served: number;
  due: number;
  minutes: number;
}

export interface GiveSheet {
  waiter: string;
  table: string;
  section: SectionId;
  pausedBy: string;
}

export interface Summary {
  course: Course;
  sections: Section[];
  waiters: Waiter[];
  kitchen: KitchenItem[];
  alerts: Alert[];
  earlier: Earlier[];
}

export interface ServiceState {
  summary: Summary;
  started: boolean;
  manage: boolean;
  online: boolean;
  teamLanded: boolean;
  give: GiveSheet | null;
  refused: string;
  say: string;
}

export const LEAD = 'Ifeoma Nduka';
export const RIVAL = 'Tobi Adeyemi';
export const EVENT = 'Adaeze & Tunde’s wedding';
export const NOW = '20:24';
export const AS_OF = '20:22';
export const OFFLINE_LINE = 'Pausing a tray and Give to… need a connection.';

const SECTIONS: readonly Section[] = [
  {
    id: 'C',
    name: 'Section C',
    people: 0,
    served: 0,
    due: 18,
    behind: true,
    leftEach: 0,
    toServe: 18,
  },
  {
    id: 'A',
    name: 'Section A',
    people: 1,
    served: 20,
    due: 42,
    behind: false,
    leftEach: 14,
    toServe: 11,
  },
  {
    id: 'D',
    name: 'Section D',
    people: 2,
    served: 22,
    due: 40,
    behind: false,
    leftEach: 7,
    toServe: 10,
  },
  {
    id: 'B',
    name: 'Section B',
    people: 3,
    served: 30,
    due: 50,
    behind: true,
    leftEach: 6,
    toServe: 11,
  },
  {
    id: 'E',
    name: 'Section E',
    people: 1,
    served: 36,
    due: 44,
    behind: false,
    leftEach: 4,
    toServe: 0,
  },
];

const WAITERS: readonly Waiter[] = [
  {
    name: 'Kunle Ajayi',
    home: 'A',
    asWell: null,
    tray: { table: 'Table 4', section: 'A', plates: 3, stage: 'Dishing', pausedBy: null },
  },
  {
    name: 'Chidi Okafor',
    home: 'D',
    asWell: null,
    tray: { table: 'Table 16', section: 'D', plates: 3, stage: 'On its way', pausedBy: null },
  },
  {
    name: 'Bisi Lawal',
    home: 'B',
    asWell: null,
    tray: { table: 'Table 6', section: 'B', plates: 2, stage: 'Checked', pausedBy: null },
  },
  {
    name: 'Funmi Bakare',
    home: 'B',
    asWell: null,
    tray: {
      table: 'Table 9',
      section: 'B',
      plates: 3,
      stage: 'On its way',
      pausedBy: 'Funmi Bakare',
    },
  },
  { name: 'Grace Udo', home: 'D', asWell: 'B', tray: null },
  {
    name: 'Yinka Hassan',
    home: 'E',
    asWell: null,
    tray: { table: 'Table 22', section: 'E', plates: 4, stage: 'Checked', pausedBy: null },
  },
];

const KITCHEN: readonly KitchenItem[] = [
  {
    item: 'Jollof rice',
    station: 'Rice · Jollof',
    people: 'Bisi Okon',
    state: 'Ready',
    readyIn: null,
    heldUpMin: null,
    waiting: 0,
  },
  {
    item: 'Fried rice',
    station: 'Rice · Fried',
    people: 'Ada Nnaji',
    state: 'Preparing',
    readyIn: 5,
    heldUpMin: null,
    waiting: 7,
  },
  {
    item: 'Chicken',
    station: 'Grill',
    people: 'Tayo Bamidele',
    state: 'Ready',
    readyIn: null,
    heldUpMin: null,
    waiting: 0,
  },
  {
    item: 'Grilled fish',
    station: 'Grill',
    people: 'Tayo Bamidele',
    state: 'Preparing',
    readyIn: null,
    heldUpMin: 18,
    waiting: 14,
  },
  {
    item: 'Plantain',
    station: 'Fryer',
    people: '',
    state: 'Ready',
    readyIn: null,
    heldUpMin: null,
    waiting: 0,
  },
  {
    item: 'Coleslaw',
    station: null,
    people: '',
    state: null,
    readyIn: null,
    heldUpMin: null,
    waiting: 0,
  },
];

const ALERTS: readonly Alert[] = [
  alert('allergy', 'A plate sent back · Allergy concern', 'Table 3 · Adaora Eze', {
    flag: 'Peanut allergy',
    button: 'Go to table',
    table: 'Table 3',
  }),
  alert('paused', 'Funmi Bakare’s tray is paused', 'Table 9 · paused by Funmi Bakare', {
    button: 'Give to…',
    table: 'Table 9',
    waiter: 'Funmi Bakare',
  }),
  alert('leftBehind', 'Left behind · Musa Bello', 'Table 14', {
    flag: 'Halal',
    button: 'Go to table',
    table: 'Table 14',
  }),
  alert('heldUp', 'Grilled fish is Held up in the kitchen', 'Grill · Held up · 18 min', {
    button: 'Team',
  }),
  alert('behind', 'Section B is Behind', 'Table 8 has waited longest', {
    button: 'Go to table',
    table: 'Table 8',
  }),
  alert('request', 'A request open 5 min', 'Table 21 · “More water for the table, please.”', {
    button: 'Go to table',
    table: 'Table 21',
  }),
  alert('station', 'Nobody on the Fryer', 'Plantain is on orders to serve', { button: 'Team' }),
  alert('behind', 'Section C is Behind', 'Table 12 has waited longest', {
    button: 'Go to table',
    table: 'Table 12',
  }),
  alert('nobody', 'Nobody on Section C', 'Its guests are waiting To serve', { button: 'Team' }),
];

function alert(
  kind: AlertKind,
  title: string,
  sub: string,
  more: Partial<Pick<Alert, 'flag' | 'button' | 'table' | 'waiter'>> & { button: AlertButton },
): Alert {
  return {
    id: `${kind}:${more.table ?? more.waiter ?? title}`,
    kind,
    title,
    sub,
    flag: more.flag ?? '',
    button: more.button,
    table: more.table ?? '',
    waiter: more.waiter ?? '',
  };
}

export function sample(): Summary {
  return {
    course: {
      name: 'Mains',
      served: 108,
      due: 194,
      onTray: 15,
      kitchen: 21,
      toServe: 50,
      notHere: 6,
    },
    sections: SECTIONS.map((s) => ({ ...s })),
    waiters: WAITERS.map((w) => ({ ...w, tray: w.tray == null ? null : { ...w.tray } })),
    kitchen: KITCHEN.map((k) => ({ ...k })),
    alerts: ALERTS.map((a) => ({ ...a })),
    earlier: [
      { course: 'Pepper soup', served: 191, due: 191, minutes: 28 },
      { course: 'Small chops', served: 190, due: 190, minutes: 22 },
    ],
  };
}

export function fresh(): ServiceState {
  return {
    summary: sample(),
    started: true,
    manage: true,
    online: true,
    teamLanded: true,
    give: null,
    refused: '',
    say: '',
  };
}

function copy(s: ServiceState): ServiceState {
  return structuredClone(s);
}

const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** The order the API returns: a section with nobody on it and guests To serve first, then left each, most first, ties by name. */
export function sectionOrder(a: Section, b: Section): number {
  const nobody = (s: Section) => (s.people === 0 && s.toServe > 0 ? 0 : 1);
  return nobody(a) - nobody(b) || b.leftEach - a.leftEach || COLLATOR.compare(a.name, b.name);
}

export function waitersOn(s: Summary, id: SectionId): Waiter[] {
  return s.waiters.filter((w) => w.home === id || w.asWell === id);
}

export function waiterOf(s: Summary, name: string): Waiter | undefined {
  return s.waiters.find((w) => w.name === name);
}

export type LineKind = 'started' | 'paused' | 'none';

export function lineKind(w: Waiter): LineKind {
  if (w.tray == null) return 'none';
  return w.tray.pausedBy == null ? 'started' : 'paused';
}

export function plates(n: number): string {
  return n === 1 ? '1 plate' : `${n} plates`;
}

export function waiterLine(w: Waiter): string {
  if (w.tray == null) return `${w.name} · No tray`;
  return `${w.name} · ${w.tray.table} · ${plates(w.tray.plates)} · ${w.tray.stage}`;
}

export function people(n: number): string {
  if (n === 0) return 'Nobody on it';
  return n === 1 ? '1 person' : `${n} people`;
}

export function heldUp(k: KitchenItem): boolean {
  return k.heldUpMin != null;
}

/** By station in the kitchen's walking order, then the menu's order, as the API sends them; No station last. */
export function kitchenRows(s: Summary): KitchenItem[] {
  return [
    ...s.kitchen.filter((k) => k.station != null),
    ...s.kitchen.filter((k) => k.station == null),
  ];
}

export function buttonOf(st: ServiceState, a: Alert): AlertButton | null {
  return a.button === 'Team' && !st.teamLanded ? null : a.button;
}

function refuse(s0: ServiceState): ServiceState {
  const s = copy(s0);
  s.refused = OFFLINE_LINE;
  s.say = OFFLINE_LINE;
  return s;
}

/** The lead's Pause the tray, on a started tray that isn't paused: the tray stays its waiter's, and the paused tray alert is raised at once. */
export function pause(s0: ServiceState, waiter: string): ServiceState {
  if (!s0.online) return refuse(s0);
  const s = copy(s0);
  const w = waiterOf(s.summary, waiter);
  if (w?.tray == null || w.tray.pausedBy != null) return s;
  w.tray.pausedBy = LEAD;
  s.summary.alerts.unshift(
    alert('paused', `${w.name}’s tray is paused`, `${w.tray.table} · paused by ${LEAD}`, {
      button: 'Give to…',
      table: w.tray.table,
      waiter: w.name,
    }),
  );
  s.refused = '';
  s.say = `${w.name}’s tray for ${w.tray.table} is paused.`;
  return s;
}

export interface Candidate {
  name: string;
  asWell: boolean;
  inHand: string;
}

/** The other waiters on the tray's section, As well included, each saying whether they have a tray in hand. */
export function candidates(s: Summary, give: GiveSheet): Candidate[] {
  return waitersOn(s, give.section)
    .filter((w) => w.name !== give.waiter)
    .map((w) => ({
      name: w.name,
      asWell: w.asWell === give.section,
      inHand: w.tray == null ? 'No tray in hand' : `Tray in hand · ${w.tray.table}`,
    }));
}

export function nobodyElse(section: string): string {
  return `Nobody else is on ${section}.`;
}

export function giveLine(s: Summary, give: GiveSheet): string {
  return `${give.waiter} · ${sectionName(s, give.section)} · paused by ${give.pausedBy}`;
}

export function sectionName(s: Summary, id: SectionId): string {
  return s.sections.find((x) => x.id === id)?.name ?? `Section ${id}`;
}

export function openGive(s0: ServiceState, alertId: string): ServiceState {
  if (!s0.online) return refuse(s0);
  const s = copy(s0);
  const a = s.summary.alerts.find((x) => x.id === alertId);
  const w = a == null ? undefined : waiterOf(s.summary, a.waiter);
  if (a == null || w?.tray?.pausedBy == null) return s;
  s.give = {
    waiter: w.name,
    table: w.tray.table,
    section: w.tray.section,
    pausedBy: w.tray.pausedBy,
  };
  s.refused = '';
  return s;
}

export function closeGive(s0: ServiceState): ServiceState {
  return { ...copy(s0), give: null };
}

/** Give to…: the tray keeps its stops, marks and stages, its pause ends and its alert leaves. A second give of the same tray is refused (409) naming who has it. */
export function giveTo(s0: ServiceState, to: string, taken: string | null = null): ServiceState {
  if (!s0.online) return refuse(s0);
  const s = copy(s0);
  const g = s.give;
  if (g == null) return s;
  if (taken != null) {
    s.refused = `${taken} has this tray now. ${RIVAL} gave it first.`;
    s.say = s.refused;
    return s;
  }
  const from = waiterOf(s.summary, g.waiter);
  const next = waiterOf(s.summary, to);
  if (from?.tray == null || next == null) return s;
  const tray = { ...from.tray, pausedBy: null };
  from.tray = null;
  if (next.tray == null) next.tray = tray;
  s.summary.alerts = s.summary.alerts.filter(
    (a) => !(a.kind === 'paused' && a.waiter === g.waiter),
  );
  s.give = null;
  s.refused = '';
  s.say = `${tray.table}’s tray is ${to}’s now.`;
  return s;
}

export const SERVICE_STATES = [
  'populated',
  'noTeam',
  'paused',
  'giveTo',
  'given',
  'giveNobody',
  'giveTaken',
  'offline',
  'notStarted',
  'noManage',
] as const;

export type ServiceStateName = (typeof SERVICE_STATES)[number];

export function serviceStateOf(raw: string | null | undefined): ServiceStateName {
  return SERVICE_STATES.find((s) => s === raw) ?? 'populated';
}

export const SERVICE_STATE_WHAT: Record<ServiceStateName, string> = {
  populated: 'Mains, 12 min in: the four counts, sections by left each, the kitchen, eight alerts',
  noTeam: 'Before sc-36034 lands: no Team tab, and the three Team alerts with no button',
  paused: 'After the lead’s Pause the tray on Kunle Ajayi’s line: Paused, and the alert at once',
  giveTo: 'Give to… on Funmi Bakare’s paused tray: Bisi Lawal with a tray, Grace Udo As well',
  given: 'Given to Bisi Lawal: Funmi has No tray, the alert has left',
  giveNobody: 'Give to… on Kunle’s paused tray: nobody else is on Section A, Team one press away',
  giveTaken: 'Give to… after another lead gave the tray first: refused, naming who has it',
  offline: 'No connection · as of 20:22: the figures as last read, Pause and Give to… refused',
  notStarted: 'Before service starts: sc-4009’s not-started state and nothing else',
  noManage: 'Without service.manage: no How it’s going, Service opens on Plan',
};

export function seed(name: ServiceStateName): ServiceState {
  const s = fresh();
  const settle = (x: ServiceState): ServiceState => ({ ...x, say: '' });
  switch (name) {
    case 'populated':
      return s;
    case 'noTeam':
      return { ...s, teamLanded: false };
    case 'paused':
      return settle(pause(s, 'Kunle Ajayi'));
    case 'giveTo':
      return openGive(s, 'paused:Table 9');
    case 'given':
      return settle(giveTo(openGive(s, 'paused:Table 9'), 'Bisi Lawal'));
    case 'giveNobody':
      return openGive(pause(s, 'Kunle Ajayi'), 'paused:Table 4');
    case 'giveTaken':
      return settle(giveTo(openGive(s, 'paused:Table 9'), 'Grace Udo', 'Bisi Lawal'));
    case 'offline':
      return { ...s, online: false, refused: OFFLINE_LINE };
    case 'notStarted':
      return { ...s, started: false };
    case 'noManage':
      return { ...s, manage: false };
  }
}

export type NextStateName = 'nextPaused' | 'nextGiven' | 'nextRefused';
export const NEXT_STATES: readonly NextStateName[] = ['nextPaused', 'nextGiven', 'nextRefused'];

export const NEXT_STATE_WHAT: Record<NextStateName, readonly [string, string]> = {
  nextPaused: ['Kunle Ajayi’s Next · the lead paused the tray', 'Carry on, and who paused it'],
  nextGiven: [
    'Bisi Lawal’s Next · a tray given to Bisi',
    'After the tray in hand, ahead of owed plates',
  ],
  nextRefused: [
    'Funmi Bakare’s Next · Carry on refused',
    '409: Bisi Lawal has the tray now, then the next tray',
  ],
};

export function nextStateOf(raw: string | null | undefined): NextStateName {
  return NEXT_STATES.find((s) => s === raw) ?? 'nextPaused';
}

export interface NextRow {
  kind: 'inHand' | 'given' | 'owed' | 'offered';
  table: string;
  plates: number;
  line: string;
}

export interface NextState {
  name: NextStateName;
  waiter: string;
  paused: boolean;
  pausedLine: string;
  rows: NextRow[];
  refused: string;
  say: string;
}

export function nextSeed(name: NextStateName): NextState {
  switch (name) {
    case 'nextPaused':
      return {
        name,
        waiter: 'Kunle Ajayi',
        paused: true,
        pausedLine: `${LEAD} paused your tray.`,
        rows: [{ kind: 'inHand', table: 'Table 4', plates: 3, line: 'Dishing' }],
        refused: '',
        say: '',
      };
    case 'nextGiven':
      return {
        name,
        waiter: 'Bisi Lawal',
        paused: false,
        pausedLine: '',
        rows: [
          { kind: 'inHand', table: 'Table 6', plates: 2, line: 'Checked · take it to the table' },
          {
            kind: 'given',
            table: 'Table 9',
            plates: 3,
            line: `Table 9’s tray, given to you by ${LEAD}.`,
          },
          { kind: 'owed', table: 'Table 7', plates: 1, line: 'Owed plate · Grilled fish' },
        ],
        refused: '',
        say: `Table 9’s tray, given to you by ${LEAD}.`,
      };
    case 'nextRefused':
      return {
        name,
        waiter: 'Funmi Bakare',
        paused: true,
        pausedLine: 'You paused this tray.',
        rows: [{ kind: 'inHand', table: 'Table 9', plates: 3, line: 'On its way' }],
        refused: '',
        say: '',
      };
  }
}

/** Carry on: the pause ends, unless the tray was given meanwhile, when it is refused (409) naming who has it and Next goes on to the next tray. */
export function carryOn(s0: NextState): NextState {
  const s = structuredClone(s0);
  if (s.name === 'nextRefused' && s.refused === '') {
    s.paused = false;
    s.refused = 'Bisi Lawal has this tray now.';
    s.say = `${s.refused} Your next tray is Table 11.`;
    s.rows = [{ kind: 'offered', table: 'Table 11', plates: 3, line: 'Next · Start the tray' }];
    return s;
  }
  s.paused = false;
  s.pausedLine = '';
  s.say = 'Carrying on.';
  return s;
}
