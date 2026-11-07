/** Seating A's sample, as seating-a-spec §8 has it: the wedding at The Landmark, counted as Messaging B counts it (142 invited, 96 coming). */
export type Kind = 'round' | 'rect' | 'head' | 'cocktail' | 'row' | 'single';
export type ChairState = 'taken' | 'held' | 'empty' | 'unusable';

export interface Chair {
  state: ChairState;
  who: string | null;
}

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  label: string;
  x: number;
  y: number;
  d: number;
  w: number;
  l: number;
  ends: number;
  spacing: number;
  rot: number;
  sec: string | null;
  chairs: Chair[];
}

export const COLOURS = [
  ['Blue', '#3B7DD8'],
  ['Purple', '#8B6CD6'],
  ['Plum', '#B0479A'],
  ['Wine', '#8E3B5E'],
  ['Rose', '#D96C8A'],
  ['Brown', '#8A5A3C'],
  ['Olive', '#6B8E23'],
  ['Teal', '#2A9D8F'],
] as const;

export type ColourName = (typeof COLOURS)[number][0];

export interface Section {
  key: string;
  name: string;
  colour: ColourName;
}

export interface Party {
  id: string;
  lead: string;
  plus: number;
  group: string;
  reply: 'Not sure yet' | 'No reply' | null;
  /** A guest left behind when only part of the party was seated: "Guest of {name}", as Guests A says. */
  guestOf: string | null;
}

export interface Person {
  name: string;
  colour: string;
  viewer: boolean;
}

export const ROOM = { name: 'Main hall', w: 2400, l: 1800 };
export const VENUE = { name: 'The Landmark', town: 'London' };
export const ORG = 'Ire Events';
export const EVENT_NAME = 'Adaeze & Tunde’s wedding';
export const COMING = 96;
export const NOT_SURE_OR_NO_REPLY = 31;
export const OFFLINE_AT = '18:42';
export const NO_SECTION_EDGE = '#8B8B9A';

export const SECTIONS: readonly Section[] = [
  { key: 'stage', name: 'Stage side', colour: 'Plum' },
  { key: 'garden', name: 'Garden side', colour: 'Teal' },
  { key: 'bar', name: 'By the bar', colour: 'Olive' },
];

const PRESENCE = ['#0369A1', '#6D28D9', '#86198F', '#9F1239', '#155E75', '#3730A3'] as const;

export const READER = 'Folake Adeyemi';
export const PRIYA: Person = { name: 'Priya Shah', colour: PRESENCE[0], viewer: false };
export const SADE: Person = { name: 'Sade Bello', colour: PRESENCE[1], viewer: true };
export const FOLAKE: Person = { name: READER, colour: PRESENCE[2], viewer: false };
export const SIX: readonly Person[] = [
  PRIYA,
  SADE,
  { name: 'Ana Souza', colour: PRESENCE[2], viewer: false },
  { name: 'Julien Moreau', colour: PRESENCE[3], viewer: false },
  { name: 'Kemi Okafor', colour: PRESENCE[4], viewer: true },
  { name: 'Tom Baker', colour: PRESENCE[5], viewer: false },
];

const NAMES: Record<string, readonly string[]> = {
  top: [
    'Adaeze Obi',
    'Tunde Bakare',
    'Chiamaka Obi',
    'Oluwaseun Bakare',
    'Ngozi Obi',
    'Kunle Bakare',
  ],
  t1: [
    'Ike Nwosu',
    'Amaka Nwosu',
    'Tobi Ade',
    'Kemi Ade',
    'Sam Okoro',
    'Joy Okoro',
    'Paul Mensah',
    'Efua Asante',
    'Ben Asante',
    'Abena Asante',
  ],
  t2: [
    'Ngozi Okeke',
    'Ike Okeke',
    'Chioma Eze',
    'Obinna Eze',
    'Lara Silva',
    'Bruno Silva',
    'Fatima Bello',
    'Musa Bello',
    'Emma Clarke',
    'James Clarke',
  ],
  t4: [
    'Ada Obi',
    'Chidi Obi',
    'Funmi Adeyemi',
    'Bisi Bakare',
    'Kola Bakare',
    'Yemi Bakare',
    'Grace Mensah',
    'Daniel Mensah',
  ],
  t5: [
    'Inês Costa',
    'Rui Costa',
    'Maria Santos',
    'João Santos',
    'Ana Ferreira',
    'Pedro Ferreira',
    'Lucas Moreau',
    'Claire Moreau',
    'Hana Sato',
    'Kenji Sato',
  ],
  t7: [
    'Tola Bakare',
    'Femi Bakare',
    'Ronke Bakare',
    'Dayo Bakare',
    'Bayo Bakare',
    'Lola Bakare',
    'Seun Bakare',
  ],
  t8: [
    'Amara Diallo',
    'Moussa Diallo',
    'Leila Haddad',
    'Omar Haddad',
    'Zoe Martin',
    'Kwame Mensah',
    'Efua Mensah',
    'Yaw Mensah',
  ],
  rowA: ['Ada Obi', 'Grace Mensah', 'Emeka Obi', 'Funmi Adeyemi'],
  door: ['Grace Obi'],
};

interface Plan {
  id: string;
  kind: Kind;
  name: string;
  x: number;
  y: number;
  seats: number;
  taken: number;
  day?: number;
  sec?: string;
  d?: number;
  w?: number;
  l?: number;
  ends?: number;
  label?: string;
  unusable?: readonly number[];
  held?: readonly number[];
}

const PLAN: readonly Plan[] = [
  {
    id: 'top',
    kind: 'head',
    name: 'Top table',
    x: 1200,
    y: 230,
    w: 360,
    l: 76,
    seats: 6,
    taken: 6,
  },
  ...[1, 2, 3, 4, 5].map((n): Plan => ({
    id: `t${n}`,
    kind: 'round',
    name: `Table ${n}`,
    x: 30 + 390 * n,
    y: 620,
    d: 180,
    seats: 10,
    sec: 'stage',
    taken: [10, 10, 8, 8, 10][n - 1] ?? 0,
    day: [10, 10, 9, 9, 10][n - 1] ?? 0,
    unusable: n === 3 ? [7] : [],
  })),
  {
    id: 't6',
    kind: 'round',
    name: 'Table 6',
    x: 420,
    y: 1020,
    d: 180,
    seats: 10,
    sec: 'garden',
    taken: 9,
    day: 10,
  },
  {
    id: 't7',
    kind: 'round',
    name: 'Table 7',
    x: 810,
    y: 1020,
    d: 180,
    seats: 10,
    sec: 'garden',
    taken: 7,
    day: 9,
    held: [8],
  },
  {
    id: 't8',
    kind: 'round',
    name: 'Table 8',
    x: 1200,
    y: 1020,
    d: 180,
    seats: 10,
    sec: 'garden',
    taken: 5,
    day: 8,
  },
  {
    id: 't9',
    kind: 'rect',
    name: 'Table 9',
    x: 1590,
    y: 1020,
    w: 240,
    l: 76,
    ends: 2,
    seats: 8,
    sec: 'garden',
    taken: 6,
    day: 7,
  },
  {
    id: 't10',
    kind: 'round',
    name: 'Table 10',
    x: 1980,
    y: 1020,
    d: 180,
    seats: 10,
    sec: 'garden',
    taken: 0,
  },
  {
    id: 'bar1',
    kind: 'cocktail',
    name: 'Bar 1',
    x: 1800,
    y: 1700,
    d: 60,
    seats: 4,
    sec: 'bar',
    taken: 0,
  },
  {
    id: 'bar2',
    kind: 'cocktail',
    name: 'Bar 2',
    x: 2060,
    y: 1700,
    d: 60,
    seats: 4,
    sec: 'bar',
    taken: 0,
  },
  { id: 'rowA', kind: 'row', name: 'Row A', label: 'A', x: 560, y: 1480, seats: 8, taken: 4 },
  { id: 'door', kind: 'single', name: 'By the door', x: 180, y: 1690, seats: 1, taken: 1 },
  { id: 'interp', kind: 'single', name: 'Interpreter', x: 1760, y: 230, seats: 1, taken: 0 },
];

function chairsOf(plan: Plan, day: boolean): Chair[] {
  let left = day ? (plan.day ?? plan.taken) : plan.taken;
  const names = NAMES[plan.id] ?? [];
  let named = 0;

  return Array.from({ length: plan.seats }, (_, index): Chair => {
    const seat = index + 1;
    if (plan.unusable?.includes(seat)) return { state: 'unusable', who: null };
    if (plan.held?.includes(seat)) return { state: 'held', who: null };
    if (left <= 0) return { state: 'empty', who: null };
    left -= 1;
    named += 1;
    return { state: 'taken', who: names[named - 1] ?? null };
  });
}

/** The room as the boards draw it; `day` is the iPhone's on-the-day counts (93 seated). */
export function sampleItems(day: boolean): Item[] {
  return PLAN.map((plan) => ({
    id: plan.id,
    kind: plan.kind,
    name: plan.name,
    label: plan.label ?? '',
    x: plan.x,
    y: plan.y,
    d: plan.d ?? 0,
    w: plan.w ?? 0,
    l: plan.l ?? 0,
    ends: plan.ends ?? 0,
    spacing: plan.kind === 'row' ? 50 : 0,
    rot: 0,
    sec: plan.sec ?? null,
    chairs: chairsOf(plan, day),
  }));
}

export const GROUPS = ['Adaeze’s family', 'Friends', 'Work'] as const;

const party = (id: string, lead: string, plus: number, group: string): Party => ({
  id,
  lead,
  plus,
  group,
  reply: null,
  guestOf: null,
});

/** Without a seat: 12 people planning, 3 on the day (Joaquín Ruiz + 1, Marta Silva). */
export function sampleTray(day: boolean): Party[] {
  if (day)
    return [
      party('joaquin', 'Joaquín Ruiz', 1, 'Friends'),
      party('marta', 'Marta Silva', 0, 'Work'),
    ];

  return [
    party('kwame', 'Kwame Mensah', 1, 'Friends'),
    party('ines', 'Inês Duarte', 1, 'Friends'),
    party('lucia', 'Lucía Ortega', 0, 'Friends'),
    party('tomas', 'Tomás Ferreira', 0, 'Friends'),
    party('amaka', 'Amaka Eze', 2, 'Adaeze’s family'),
    party('sophie', 'Sophie Laurent', 1, 'Work'),
    party('marta', 'Marta Silva', 0, 'Work'),
  ];
}

/** With Show Not sure yet and no reply too: two of the 31, each with their reply in their own words. */
export const NOT_YET: readonly Party[] = [
  { ...party('hugo', 'Hugo Lambert', 0, 'Work'), reply: 'Not sure yet' },
  { ...party('nadia', 'Nadia Rahman', 1, 'Friends'), reply: 'No reply' },
];
