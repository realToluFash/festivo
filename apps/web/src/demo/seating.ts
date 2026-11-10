import { writtenTime } from './clock.ts';
import { demoWords } from './demoWords.ts';
import { SW } from './seatingWords.ts';
import type { DemoLink } from './settings.ts';

/** Seating · A · The room (page e31, board/seating-a-spec.md): the sample, the room's geometry and the plan's rules; the words are in seatingWords.ts. */
export { SW };

const WORDS = demoWords(SW);

export const { filled: say, many, listed } = WORDS;

export type Kind = 'round' | 'rect' | 'head' | 'cocktail' | 'row' | 'single';
export type ChairState = 'taken' | 'held' | 'empty' | 'unusable';
export type Colour = 'Blue' | 'Purple' | 'Plum' | 'Wine' | 'Rose' | 'Brown' | 'Olive' | 'Teal';
export type Units = 'metric' | 'us';

export const COLOURS: readonly Colour[] = [
  'Blue',
  'Purple',
  'Plum',
  'Wine',
  'Rose',
  'Brown',
  'Olive',
  'Teal',
];

export interface Chair {
  state: ChairState;
  who?: string | undefined;
  party?: string | undefined;
}

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  label?: string | undefined;
  x: number;
  y: number;
  d?: number | undefined;
  w?: number | undefined;
  l?: number | undefined;
  ends?: number | undefined;
  spacing?: number | undefined;
  rot: number;
  sec: string | null;
  chairs: Chair[];
}

export interface Section {
  id: string;
  name: string;
  colour: Colour;
}

export interface Room {
  name: string;
  w: number;
  l: number;
}

export interface Plan {
  room: Room | null;
  items: Item[];
  sections: Section[];
}

export type Reply = 'coming' | 'notSure' | 'noReply';

export interface Party {
  id: string;
  name: string;
  companions: string[];
  group: string | null;
  reply: Reply;
  behind?: boolean;
}

export interface Person {
  name: string;
  initials: string;
  tone: number;
  viewer: boolean;
}

export const EVENT_ID = 'evt-wed-4';
export const SEATING_AT = `/demo/events/${EVENT_ID}/seating`;
export const EVENT_NAME = 'Adaeze & Tunde’s wedding';
export const VENUE = 'The Landmark';
export const CITY = 'London';
export const ORGANISATION = 'Ire Events';
export const EVENT_DAY = '2026-11-05T17:00:00Z';
export const MADE_AT = '2026-11-03T16:05:00Z';
export const TIME_ZONE = 'Europe/London';

export function eventDay(iso: string, locale: string, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

/** When a document was made (sc-4024): the reader's date and the 24-hour time (sc-30243), "Tuesday, Nov 3, 16:05" in en-US. */
export function asOf(iso: string, locale: string, timeZone = TIME_ZONE): string {
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso));

  return `${day}, ${writtenTime(iso, locale, timeZone)}`;
}

export const ROOM: Room = { name: 'Main hall', w: 2400, l: 1800 };

export const YOU: Person = { name: 'Folake Adeyemi', initials: 'FA', tone: 2, viewer: false };
export const PRIYA: Person = { name: 'Priya Shah', initials: 'PS', tone: 0, viewer: false };
export const SADE: Person = { name: 'Sade Bello', initials: 'SB', tone: 1, viewer: true };
export const SIX: readonly Person[] = [
  PRIYA,
  SADE,
  { name: 'Ana Souza', initials: 'AS', tone: 2, viewer: false },
  { name: 'Julien Moreau', initials: 'JM', tone: 3, viewer: false },
  { name: 'Kemi Okafor', initials: 'KO', tone: 4, viewer: true },
  { name: 'Tom Baker', initials: 'TB', tone: 5, viewer: false },
];

const SECTIONS: readonly Section[] = [
  { id: 'stage', name: 'Stage side', colour: 'Plum' },
  { id: 'garden', name: 'Garden side', colour: 'Teal' },
  { id: 'bar', name: 'By the bar', colour: 'Olive' },
];

const SEATED_AT: Readonly<Record<string, readonly string[]>> = {
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
  t3: [
    'Ifeoma Uche',
    'Chuka Uche',
    'Rosa Lima',
    'Tiago Lima',
    'Aisha Bello',
    'Sani Bello',
    'Nkem Obi',
    'Dapo Obi',
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
  t6: [
    'Elena Rossi',
    'Marco Rossi',
    'Ama Owusu',
    'Kwesi Owusu',
    'Lina Haddad',
    'Sami Haddad',
    'Zara Khan',
    'Imran Khan',
    'Lea Martin',
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
  t8: ['Amara Diallo', 'Moussa Diallo', 'Leila Haddad', 'Omar Haddad', 'Zoe Martin'],
  t9: ['Sofia Rossi', 'Luca Rossi', 'Yaa Mensah', 'Kojo Mensah', 'Nia Okafor', 'Obi Okafor'],
  rowA: ['Priyanka Nair', 'Yuki Tanaka', 'Emeka Obi', 'Lars Johansson'],
  door: ['Grace Obi'],
};

function chairsFor(
  id: string,
  seats: number,
  taken: number,
  unusable: readonly number[] = [],
  held: readonly number[] = [],
): Chair[] {
  const names = [...(SEATED_AT[id] ?? [])];
  let left = taken;

  return Array.from({ length: seats }, (_, index): Chair => {
    const number = index + 1;

    if (unusable.includes(number)) return { state: 'unusable' };
    if (held.includes(number)) return { state: 'held' };
    if (left <= 0) return { state: 'empty' };
    left -= 1;
    return { state: 'taken', who: names.shift() };
  });
}

function table(
  id: string,
  kind: Kind,
  name: string,
  x: number,
  y: number,
  seats: number,
  taken: number,
  sec: string | null,
  shape: Partial<Item> = {},
  unusable: readonly number[] = [],
  held: readonly number[] = [],
): Item {
  return {
    id,
    kind,
    name,
    x,
    y,
    rot: 0,
    sec,
    chairs: chairsFor(id, seats, taken, unusable, held),
    ...shape,
  };
}

export function sampleItems(): Item[] {
  return [
    table('top', 'head', 'Top table', 1200, 230, 6, 6, null, { w: 360, l: 76, ends: 0 }),
    table('t1', 'round', 'Table 1', 420, 620, 10, 10, 'stage', { d: 180 }),
    table('t2', 'round', 'Table 2', 810, 620, 10, 10, 'stage', { d: 180 }),
    table('t3', 'round', 'Table 3', 1200, 620, 10, 8, 'stage', { d: 180 }, [7]),
    table('t4', 'round', 'Table 4', 1590, 620, 10, 8, 'stage', { d: 180 }),
    table('t5', 'round', 'Table 5', 1980, 620, 10, 10, 'stage', { d: 180 }),
    table('t6', 'round', 'Table 6', 420, 1020, 10, 9, 'garden', { d: 180 }),
    table('t7', 'round', 'Table 7', 810, 1020, 10, 7, 'garden', { d: 180 }, [], [8]),
    table('t8', 'round', 'Table 8', 1200, 1020, 10, 5, 'garden', { d: 180 }),
    table('t9', 'rect', 'Table 9', 1590, 1020, 8, 6, 'garden', { w: 240, l: 76, ends: 2 }),
    table('t10', 'round', 'Table 10', 1980, 1020, 10, 0, 'garden', { d: 180 }),
    table('bar1', 'cocktail', 'Bar 1', 1800, 1700, 4, 0, 'bar', { d: 60 }),
    table('bar2', 'cocktail', 'Bar 2', 2060, 1700, 4, 0, 'bar', { d: 60 }),
    table('rowA', 'row', 'Row A', 560, 1480, 8, 4, null, { label: 'A', spacing: 50 }),
    table('door', 'single', 'By the door', 180, 1690, 1, 1, null),
    table('interp', 'single', 'Interpreter', 1760, 230, 1, 0, null),
  ];
}

export function samplePlan(): Plan {
  return { room: { ...ROOM }, items: sampleItems(), sections: SECTIONS.map((one) => ({ ...one })) };
}

function party(
  id: string,
  name: string,
  companions: readonly string[],
  group: string | null,
  reply: Reply = 'coming',
): Party {
  return { id, name, companions: [...companions], group, reply };
}

const FAMILY = 'Adaeze’s family';

export function sampleTray(): Party[] {
  return [
    party('kwame', 'Kwame Mensah', ['Guest of Kwame Mensah'], 'Friends'),
    party('ines', 'Inês Duarte', ['Rui Duarte'], 'Friends'),
    party('lucia', 'Lucía Ortega', [], 'Friends'),
    party('tomas', 'Tomás Ferreira', [], 'Friends'),
    party('amaka', 'Amaka Eze', ['Guest of Amaka Eze', 'Guest of Amaka Eze'], FAMILY),
    party('sophie', 'Sophie Laurent', ['Marc Laurent'], 'Work'),
    party('marta', 'Marta Silva', [], 'Work'),
    party('hugo', 'Hugo Lambert', [], 'Work', 'notSure'),
    party('nadia', 'Nadia Rahman', ['Guest of Nadia Rahman'], 'Friends', 'noReply'),
  ];
}

/** The wedding's guests who are not sure yet or have not replied (10 and 21, Guests A); the tray lists two of them, as Desk-4 does. */
export const UNSURE_GUESTS = 31;

export function unsureLeft(tray: readonly Party[]): number {
  return UNSURE_GUESTS - 2 + tray.filter((party) => party.reply !== 'coming').length;
}

export const GROUP_ORDER: readonly string[] = [FAMILY, 'Friends', 'Work'];

export function peopleIn(party: Party): number {
  return (party.behind === true ? 0 : 1) + party.companions.length;
}

export function partyTitle(party: Party): string {
  if (party.behind === true) return say(SW.guestOf, { name: party.name });
  return party.companions.length > 0
    ? say(SW.party, { name: party.name, n: party.companions.length })
    : party.name;
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en');
}

export function shownParties(ui: {
  tray: Party[];
  unsure: boolean;
  search: string;
  groups: string[];
}): Party[] {
  const q = plain(ui.search.trim());

  return ui.tray.filter(
    (party) =>
      (ui.unsure || party.reply === 'coming') &&
      (q === '' || [party.name, ...party.companions].some((name) => plain(name).includes(q))) &&
      (ui.groups.length === 0 || ui.groups.includes(party.group ?? SW.noGroup)),
  );
}

export const CHAIR_R = 22;
const GAP_ROUND = 28;
const GAP_COCKTAIL = 24;
const ROW_TAB = 52;
export const AT_100 = 0.5;
export const ZOOMS: readonly number[] = [25, 40, 50, 75, 100, 150, 200, 300, 400];
export const FIT_PAD = { top: 84, right: 16, bottom: 84, left: 16 } as const;

export type Point = readonly [number, number];

export function turn([x, y]: Point, deg: number): Point {
  const a = (deg * Math.PI) / 180;

  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

function spread(count: number, length: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => -length / 2 + (length * (index + 0.5)) / count,
  );
}

/** Where a table's chairs go round it, from its centre before turning: seat 1 at the top, then clockwise; seat 1 of a row on the left of someone sitting in it. */
export function sidesOf(item: Item): { top: number; right: number; bottom: number; left: number } {
  const seats = item.chairs.length;
  const ends = item.ends ?? 0;
  const side = seats - ends;

  return item.kind === 'head'
    ? { top: 0, right: Math.floor(ends / 2), bottom: side, left: Math.ceil(ends / 2) }
    : {
        top: Math.ceil(side / 2),
        right: Math.floor(ends / 2),
        bottom: Math.floor(side / 2),
        left: Math.ceil(ends / 2),
      };
}

export function chairsOf(item: Item): Point[] {
  const seats = item.chairs.length;

  switch (item.kind) {
    case 'round':
    case 'cocktail': {
      const r = (item.d ?? 180) / 2 + (item.kind === 'round' ? GAP_ROUND : GAP_COCKTAIL);

      return Array.from({ length: seats }, (_, index) => {
        const a = ((-90 + (360 * index) / seats) * Math.PI) / 180;

        return [r * Math.cos(a), r * Math.sin(a)] as const;
      });
    }
    case 'rect':
    case 'head': {
      const w = item.w ?? 180;
      const l = item.l ?? 76;
      const { top, right, bottom, left } = sidesOf(item);

      return [
        ...spread(top, w).map((x) => [x, -l / 2 - GAP_ROUND] as const),
        ...spread(right, l).map((y) => [w / 2 + GAP_ROUND, y] as const),
        ...spread(bottom, w)
          .reverse()
          .map((x) => [x, l / 2 + GAP_ROUND] as const),
        ...spread(left, l)
          .reverse()
          .map((y) => [-w / 2 - GAP_ROUND, y] as const),
      ];
    }
    case 'row': {
      const s = item.spacing ?? 50;

      return Array.from(
        { length: seats },
        (_, index) => [(-(seats - 1) / 2) * s + index * s, 0] as const,
      );
    }
    default:
      return [[0, 0]];
  }
}

export function extent(item: Item): Point {
  switch (item.kind) {
    case 'round':
    case 'cocktail': {
      const r = (item.d ?? 180) / 2 + (item.kind === 'round' ? GAP_ROUND : GAP_COCKTAIL) + CHAIR_R;

      return [r, r];
    }
    case 'rect':
    case 'head': {
      const { right, left } = sidesOf(item);
      const ends = right + left > 0 ? GAP_ROUND + CHAIR_R : 0;

      return [(item.w ?? 180) / 2 + ends, (item.l ?? 76) / 2 + GAP_ROUND + CHAIR_R];
    }
    case 'row':
      return [((item.chairs.length - 1) / 2) * (item.spacing ?? 50) + CHAIR_R + ROW_TAB, CHAIR_R];
    default:
      return [CHAIR_R, CHAIR_R];
  }
}

export function isRound(item: Item): boolean {
  return item.kind === 'round' || item.kind === 'cocktail' || item.kind === 'single';
}

export function turns(item: Item): boolean {
  return item.kind === 'rect' || item.kind === 'head' || item.kind === 'row';
}

export function bounds(
  item: Item,
  at: Point = [item.x, item.y],
): { x0: number; y0: number; x1: number; y1: number } {
  const [ex, ey] = extent(item);

  if (isRound(item)) return { x0: at[0] - ex, y0: at[1] - ey, x1: at[0] + ex, y1: at[1] + ey };
  const corners = [
    [-ex, -ey],
    [ex, -ey],
    [ex, ey],
    [-ex, ey],
  ].map((corner) => turn(corner as unknown as Point, item.rot));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);

  return {
    x0: at[0] + Math.min(...xs),
    y0: at[1] + Math.min(...ys),
    x1: at[0] + Math.max(...xs),
    y1: at[1] + Math.max(...ys),
  };
}

export function inside(item: Item, room: Room, at: Point = [item.x, item.y]): boolean {
  const box = bounds(item, at);

  return box.x0 >= -0.5 && box.y0 >= -0.5 && box.x1 <= room.w + 0.5 && box.y1 <= room.l + 0.5;
}

export function within(item: Item, room: Room, at: Point): Point {
  const box = bounds(item, at);
  const half = [(box.x1 - box.x0) / 2, (box.y1 - box.y0) / 2];
  const cx = at[0] - (box.x0 + box.x1) / 2;
  const cy = at[1] - (box.y0 + box.y1) / 2;
  const x = Math.min(Math.max((box.x0 + box.x1) / 2, half[0]!), room.w - half[0]!);
  const y = Math.min(Math.max((box.y0 + box.y1) / 2, half[1]!), room.l - half[1]!);

  return [x + cx, y + cy];
}

function axesOf(rot: number): Point[] {
  return [turn([1, 0], rot), turn([0, 1], rot)];
}

function cornersOf(item: Item): Point[] {
  const [ex, ey] = extent(item);

  return (
    [
      [-ex, -ey],
      [ex, -ey],
      [ex, ey],
      [-ex, ey],
    ] as const
  ).map((corner) => {
    const [x, y] = turn(corner, item.rot);

    return [item.x + x, item.y + y] as const;
  });
}

function project(points: readonly Point[], axis: Point): [number, number] {
  const values = points.map(([x, y]) => x * axis[0] + y * axis[1]);

  return [Math.min(...values), Math.max(...values)];
}

export function overlap(a: Item, b: Item): boolean {
  const gap = 1;

  if (isRound(a) && isRound(b)) {
    return Math.hypot(a.x - b.x, a.y - b.y) < extent(a)[0] + extent(b)[0] - gap;
  }
  if (isRound(a) !== isRound(b)) {
    const circle = isRound(a) ? a : b;
    const box = isRound(a) ? b : a;
    const [ex, ey] = extent(box);
    const [lx, ly] = turn([circle.x - box.x, circle.y - box.y], -box.rot);
    const nx = Math.max(-ex, Math.min(ex, lx));
    const ny = Math.max(-ey, Math.min(ey, ly));

    return Math.hypot(lx - nx, ly - ny) < extent(circle)[0] - gap;
  }
  const pa = cornersOf(a);
  const pb = cornersOf(b);

  return [...axesOf(a.rot), ...axesOf(b.rot)].every((axis) => {
    const [a0, a1] = project(pa, axis);
    const [b0, b1] = project(pb, axis);

    return a1 - gap > b0 && b1 - gap > a0;
  });
}

export function overlapsOf(item: Item, items: readonly Item[]): Item[] {
  return items.filter((other) => other.id !== item.id && overlap(item, other));
}

export function snapTo(value: number, units: Units, on = true): number {
  const step = units === 'us' ? 15.24 : 10;

  return on ? Math.round(value / step) * step : Math.round(value);
}

export function nearestFree(item: Item, items: readonly Item[], room: Room, from: Point): Point {
  const step = 20;
  const limit = Math.max(room.w, room.l);

  for (let ring = 0; ring * step <= limit; ring += 1) {
    const tries: Point[] = [];

    for (let dx = -ring; dx <= ring; dx += 1)
      for (let dy = -ring; dy <= ring; dy += 1)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring)
          tries.push([from[0] + dx * step, from[1] + dy * step]);
    tries.sort(
      (a, b) =>
        Math.hypot(a[0] - from[0], a[1] - from[1]) - Math.hypot(b[0] - from[0], b[1] - from[1]),
    );
    for (const at of tries) {
      const moved = { ...item, x: Math.round(at[0] / 10) * 10, y: Math.round(at[1] / 10) * 10 };

      if (inside(moved, room) && overlapsOf(moved, items).length === 0) return [moved.x, moved.y];
    }
  }

  return within(item, room, from);
}

export function readingOrder(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => Math.round(a.y / 120) - Math.round(b.y / 120) || a.x - b.x);
}

export function fitOf(
  width: number,
  height: number,
  room: Room,
): { s: number; ox: number; oy: number } {
  const w = width - FIT_PAD.left - FIT_PAD.right;
  const h = height - FIT_PAD.top - FIT_PAD.bottom;
  const s = Math.max(0.05, Math.min(w / room.w, h / room.l));

  return { s, ox: FIT_PAD.left + (w - room.w * s) / 2, oy: FIT_PAD.top + (h - room.l * s) / 2 };
}

export function percentOf(s: number): number {
  return Math.round((s / AT_100) * 100);
}

/** Under 50% a table is its outline, name and how full; from 50% its chairs; from 150% each chair is a 44 target. */
export type Detail = 'out' | 'fit' | 'near';

export function detailOf(s: number): Detail {
  if (s < 0.25 - 1e-9) return 'out';
  return s >= 0.75 - 1e-9 ? 'near' : 'fit';
}

export function initials(name: string): string {
  const parts = name
    .replace(/^(Guest of|Chief Mrs|Chief|Dr|Mrs|Mr|Ms)\s+/u, '')
    .split(/\s+/u)
    .filter(Boolean);

  return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export function usable(item: Item): number {
  return item.chairs.filter((chair) => chair.state !== 'unusable').length;
}

export function filled(item: Item): number {
  return item.chairs.filter((chair) => chair.state === 'taken' || chair.state === 'held').length;
}

export function free(item: Item): number {
  return item.chairs.filter((chair) => chair.state === 'empty').length;
}

export function ofWords(item: Item): string {
  return `${filled(item)} of ${usable(item)}`;
}

export function isTable(item: Item): boolean {
  return item.kind !== 'row' && item.kind !== 'single';
}

export function shapeWord(item: Item): string {
  switch (item.kind) {
    case 'round':
      return SW.roundTable;
    case 'rect':
      return SW.rectTable;
    case 'head':
      return SW.headTable;
    case 'cocktail':
      return SW.cocktailTable;
    case 'row':
      return say(SW.rowOf, { n: item.chairs.length });
    default:
      return SW.singleSeat;
  }
}

export function shapeShort(kind: Kind): string {
  return {
    round: SW.round,
    rect: SW.rect,
    head: SW.head,
    cocktail: SW.cocktail,
    row: SW.round,
    single: SW.round,
  }[kind];
}

export function sectionOf(plan: Plan, item: Item): Section | null {
  return plan.sections.find((one) => one.id === item.sec) ?? null;
}

export function sectionName(plan: Plan, item: Item): string {
  return sectionOf(plan, item)?.name ?? SW.noSection;
}

export function itemLine(plan: Plan, item: Item): string {
  return say(SW.itemLine, {
    shape: shapeWord(item),
    section: sectionName(plan, item),
    taken: filled(item),
    seats: usable(item),
  });
}

export function itemName(plan: Plan, item: Item, extra = ''): string {
  const kind = {
    round: SW.kindRound,
    rect: SW.kindRect,
    head: SW.kindHead,
    cocktail: SW.kindCocktail,
    row: say(SW.kindRow, { n: item.chairs.length }),
    single: SW.kindSingle,
  }[item.kind];
  const section = sectionOf(plan, item);

  return (
    say(SW.itemName, {
      name: item.name,
      kind,
      taken: filled(item),
      seats: usable(item),
      section: section == null ? '' : `, ${section.name}`,
    }) + extra
  );
}

export function chairWord(chair: Chair): string {
  if (chair.state === 'taken') return chair.who ?? SW.taken;
  return { held: SW.held, empty: SW.empty, unusable: SW.unusable }[chair.state];
}

export function stateWord(state: ChairState): string {
  return { taken: SW.taken, held: SW.held, empty: SW.empty, unusable: SW.unusable }[state];
}

export function sectionLine(plan: Plan, id: string | null): string {
  const items = plan.items.filter((item) => item.sec === id);
  const tables = items.filter(isTable).length;
  const rows = items.filter((item) => item.kind === 'row').length;
  const singles = items.filter((item) => item.kind === 'single').length;
  const seats = items.reduce((sum, item) => sum + item.chairs.length, 0);
  const colour = plan.sections.find((one) => one.id === id)?.colour;
  const parts = [
    colour,
    tables > 0 || id != null ? many('tables', tables) : null,
    rows > 0 ? many('rows', rows) : null,
    singles > 0 ? many('singles', singles) : null,
    seats > 0 ? many('seatsCount', seats) : null,
  ].filter((part): part is string => part != null);

  return parts.join(' · ');
}

export function leastUsed(sections: readonly Section[]): Colour {
  const used = (colour: Colour) => sections.filter((one) => one.colour === colour).length;

  return COLOURS.reduce((best, colour) => (used(colour) < used(best) ? colour : best), COLOURS[0]!);
}

export function natural(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

export function inSectionOrder(plan: Plan): Item[] {
  const order = (item: Item) => {
    const index = plan.sections.findIndex((one) => one.id === item.sec);

    return index < 0 ? plan.sections.length : index;
  };

  return [...plan.items].sort((a, b) => order(a) - order(b) || natural(a.name, b.name));
}

export function metres(cm: number): string {
  const m = cm / 100;

  return Number.isInteger(Math.round(m * 100) / 100) && Math.round(m * 100) % 100 === 0
    ? `${Math.round(m)} m`
    : `${m.toFixed(2)} m`;
}

export function feet(cm: number): string {
  const inches = Math.round(cm / 2.54);
  const ft = Math.floor(inches / 12);
  const left = inches - ft * 12;

  return left === 0 ? `${ft} ft` : `${ft} ft ${left} in`;
}

export function lengthOf(cm: number, units: Units): string {
  return units === 'us' ? feet(cm) : metres(cm);
}

export function sizeOf(cm: number, units: Units): string {
  return units === 'us' ? feet(cm) : String(Math.round(cm));
}

export function sizeWords(item: Item): string {
  return isRound(item) ? `${item.d ?? 0} cm` : `${item.w ?? 0} × ${item.l ?? 0} cm`;
}

export function readFeet(text: string): number | null {
  const typed = text
    .trim()
    .replaceAll('’', '′')
    .replaceAll("'", '′')
    .replaceAll('"', '″')
    .replaceAll('”', '″');
  const both = /^(\d+(?:\.\d+)?)\s*(?:ft|′)\s*(\d+(?:\.\d+)?)?\s*(?:in|″)?$/u.exec(typed);

  if (both != null) return (Number(both[1]) * 12 + Number(both[2] ?? 0)) * 2.54;
  const inches = /^(\d+(?:\.\d+)?)\s*(?:in|″)$/u.exec(typed);

  if (inches != null) return Number(inches[1]) * 2.54;
  return null;
}

export function readMetres(text: string): number | null {
  const typed = text.trim().replace(',', '.');
  const cm = /^(\d+(?:\.\d+)?)\s*cm$/u.exec(typed);

  if (cm != null) return Number(cm[1]);
  const m = /^(\d+(?:\.\d+)?)\s*(?:m)?$/u.exec(typed);

  return m == null ? null : Number(m[1]) * 100;
}

export function readPlace(text: string, units: Units): number | null {
  return units === 'us' ? readFeet(text) : readMetres(text);
}

export function readSize(text: string, units: Units): number | null {
  if (units === 'us') return readFeet(text);
  const typed = text.trim().replace(/\s*cm$/u, '');

  return /^\d+(?:\.\d+)?$/u.test(typed) ? Number(typed) : null;
}

/** A table's or a row's size (sc-5033, 8 Nov 2026): one that can't be read or is too small is refused beside its field, never reverted in silence. */
export function readItemSize(text: string, units: Units): { cm: number } | { refused: string } {
  const cm = readSize(text, units);

  if (units === 'us') {
    if (cm == null) return { refused: SW.usHint };
    return cm < 30.48 - 1e-6 ? { refused: SW.sizeMinFeet } : { cm };
  }
  return cm == null || cm < 30 ? { refused: SW.sizeMin } : { cm };
}

export function readCount(text: string): number | null {
  const typed = text.trim();

  return /^\d+$/u.test(typed) ? Number(typed) : null;
}

export const FEET_RANGE = { min: 7, max: 1640 } as const;

export function readRoom(
  text: string,
  which: 'width' | 'length',
  units: Units = 'metric',
): { cm: number } | { refused: string } {
  const typed = text.trim().replace(',', '.').replace(/\s*m$/u, '');

  if (typed === '') return { refused: which === 'width' ? SW.enterWidth : SW.enterLength };
  if (units === 'us') {
    const cm = readFeet(typed) ?? readFeet(`${typed} ft`);
    const ft = cm == null ? null : cm / 30.48;

    return ft == null || ft < FEET_RANGE.min || ft > FEET_RANGE.max + 0.99
      ? { refused: say(SW.roomRangeFeet, FEET_RANGE) }
      : { cm: Math.round(cm!) };
  }
  const value = Number(typed);

  if (!Number.isFinite(value) || value < 2 || value > 500) return { refused: SW.roomRange };
  return { cm: Math.round(value * 100) };
}

export function sameName(a: string, b: string): boolean {
  const plain = (value: string) =>
    value
      .normalize('NFD')
      .replaceAll(/\p{Diacritic}/gu, '')
      .trim()
      .toLocaleLowerCase('en');

  return plain(a) === plain(b);
}

export function nextName(items: readonly Item[], kind: Kind): { name: string; label?: string } {
  if (kind === 'row') {
    const used = items.filter((item) => item.kind === 'row').map((item) => item.label ?? '');
    const label =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((letter) => !used.includes(letter)) ?? 'Z';

    return { name: `Row ${label}`, label };
  }
  const stem = kind === 'single' ? 'Seat' : 'Table';
  let n = 1;

  while (items.some((item) => sameName(item.name, `${stem} ${n}`))) n += 1;
  return { name: `${stem} ${n}` };
}

export const DEFAULTS: Record<
  'round' | 'rect' | 'head' | 'cocktail',
  Partial<Item> & { seats: number }
> = {
  round: { d: 180, seats: 10 },
  rect: { w: 180, l: 76, ends: 0, seats: 6 },
  head: { w: 240, l: 76, ends: 0, seats: 4 },
  cocktail: { d: 60, seats: 4 },
};

export function newItem(kind: Kind, items: readonly Item[], at: Point): Item {
  const { name, label } = nextName(items, kind);
  const base: Item = {
    id: `new-${kind}-${items.length}-${Math.round(at[0])}`,
    kind,
    name,
    x: at[0],
    y: at[1],
    rot: 0,
    sec: null,
    chairs: [],
  };

  if (kind === 'row') return { ...base, label, spacing: 50, chairs: emptyChairs(10) };
  if (kind === 'single') return { ...base, chairs: emptyChairs(1) };
  const { seats, ...shape } = DEFAULTS[kind];

  return { ...base, ...shape, chairs: emptyChairs(seats) };
}

export function emptyChairs(count: number): Chair[] {
  return Array.from({ length: count }, () => ({ state: 'empty' }));
}

/** sc-4000's squeeze: below 55 cm a chair, never on a cocktail table. */
export function squeezed(item: Item): boolean {
  if (item.kind === 'cocktail' || item.kind === 'row' || item.kind === 'single') return false;
  if (item.kind === 'round') return (Math.PI * (item.d ?? 180)) / item.chairs.length < 55;
  const { top, right, bottom, left } = sidesOf(item);
  const w = item.w ?? 180;
  const l = item.l ?? 76;
  const room = [
    top > 0 ? w / top : Infinity,
    bottom > 0 ? w / bottom : Infinity,
    right > 0 ? l / right : Infinity,
    left > 0 ? l / left : Infinity,
  ];

  return Math.min(...room) < 55;
}

export function squeezeWords(item: Item): string {
  return say(SW.squeeze, { n: item.chairs.length, size: sizeWords(item) });
}

export function keepSeats(item: Item): number {
  let last = 0;

  item.chairs.forEach((chair, index) => {
    if (chair.state === 'taken' || chair.state === 'held') last = index + 1;
  });

  return last;
}

export function withSeats(item: Item, seats: number): Item {
  const chairs = item.chairs.slice(0, seats);

  while (chairs.length < seats) chairs.push({ state: 'empty' });
  return { ...item, chairs, ends: Math.min(item.ends ?? 0, seats) };
}

export function endsLine(item: Item): string {
  const { top, right, bottom, left } = sidesOf(item);

  if (item.kind === 'head') {
    return right + left > 0
      ? say(SW.headEndsLine, { n: bottom, left, right })
      : say(SW.headLine, { n: bottom });
  }
  return say(SW.endsLine, { left, right, a: top, b: bottom });
}

/** A shape change resets the size to the new shape's default and keeps the seats (sc-4000). */
export function reshaped(
  item: Item,
  kind: 'round' | 'rect' | 'head' | 'cocktail',
): { item: Item; note: string } {
  const { seats: _seats, ...shape } = DEFAULTS[kind];
  const next: Item = {
    ...item,
    kind,
    d: undefined,
    w: undefined,
    l: undefined,
    ends: undefined,
    rot: 0,
    ...shape,
  };
  const word = {
    round: 'round',
    rect: 'rectangular',
    head: 'head table',
    cocktail: 'cocktail table',
  }[kind];

  return {
    item: next,
    note: say(SW.sizeReset, { shape: word, size: sizeWords(next), n: next.chairs.length }),
  };
}

export function copyOf(item: Item, items: readonly Item[], room: Room): Item {
  const { name, label } = nextName(items, item.kind);
  const copy: Item = {
    ...item,
    id: `copy-${item.id}-${items.length}`,
    name,
    label,
    chairs: item.chairs.map((chair) => (chair.state === 'unusable' ? chair : { state: 'empty' })),
  };
  const [x, y] = nearestFree(copy, items, room, [item.x, item.y + 420]);

  return { ...copy, x, y };
}

export function seatedIn(items: readonly Item[]): number {
  return items.reduce(
    (sum, item) => sum + item.chairs.filter((chair) => chair.state === 'taken').length,
    0,
  );
}

export function planCounts(plan: Plan): string {
  const sections = plan.sections.length;
  const tables = plan.items.filter(isTable).length;
  const rows = plan.items.filter((item) => item.kind === 'row').length;
  const singles = plan.items.filter((item) => item.kind === 'single').length;

  return listed(
    [
      sections > 0 ? many('sections', sections) : null,
      tables > 0 ? many('tables', tables) : null,
      rows > 0 ? many('rows', rows) : null,
      singles > 0 ? many('singles', singles) : null,
    ].filter((part): part is string => part != null),
  );
}

/** Delete the plan's ask (pm, 8 Nov 2026): what it deletes, sections counted, then who loses a seat, held chairs too; a sentence with nothing to say is left out. */
export function deletePlanWords(plan: Plan): string {
  const counts = planCounts(plan);
  const seated = plan.items.reduce((sum, item) => sum + filled(item), 0);
  const guests = seated === 0 ? SW.deletePlanNobody : many('deletePlanSeated', seated);

  return counts === '' ? guests : `${say(SW.deletePlanDeletes, { counts })} ${guests}`;
}

/** Free chairs side by side, round a table or along a row, for a party of n: the first run that fits, else null. */
export function sideBySide(item: Item, n: number): number[] | null {
  const count = item.chairs.length;
  const ring = item.kind !== 'row';

  for (let start = 0; start < count; start += 1) {
    const run: number[] = [];

    for (let step = 0; step < n; step += 1) {
      const index = start + step;

      if (!ring && index >= count) break;
      const at = index % count;

      if (item.chairs[at]?.state !== 'empty') break;
      run.push(at);
    }
    if (run.length === n) return run;
  }

  return null;
}

export function firstFree(item: Item, n: number, from = 0): number[] {
  const count = item.chairs.length;
  const out: number[] = [];

  for (let step = 0; step < count && out.length < n; step += 1) {
    const at = (from + step) % count;

    if (item.chairs[at]?.state === 'empty') out.push(at);
  }

  return out;
}

export function membersOf(party: Party): string[] {
  return party.behind === true ? [...party.companions] : [party.name, ...party.companions];
}

export function seatAt(item: Item, party: Party, chairs: readonly number[]): Item {
  const who = membersOf(party);

  return {
    ...item,
    chairs: item.chairs.map((chair, index) => {
      const at = chairs.indexOf(index);

      return at < 0 || who[at] == null ? chair : { state: 'taken', who: who[at], party: party.id };
    }),
  };
}

export const SEATING_STATES = [
  { key: 'plan', name: 'The plan in use, nothing chosen', group: 'The plan' },
  { key: 'noPlan', name: 'No seating plan yet', group: 'The plan' },
  { key: 'startBlank', name: 'Start the plan, Length blank', group: 'The plan' },
  { key: 'startRange', name: 'Start the plan, out of range', group: 'The plan' },
  { key: 'newPlan', name: 'A new plan, an empty room', group: 'The plan' },
  { key: 'loading', name: 'Loading', group: 'The plan' },
  { key: 'failed', name: 'Could not load', group: 'The plan' },
  { key: 'readOnly', name: 'Read only, Can view', group: 'The plan' },
  { key: 'zoomOut', name: 'Zoomed out, 40%', group: 'The plan' },
  { key: 'corner', name: 'One corner at 200%, seat 9 chosen', group: 'The plan' },
  { key: 'sparse', name: 'The sparse plan, one table', group: 'The plan' },
  { key: 'roomSettings', name: 'Room settings', group: 'The room and its sections' },
  { key: 'shrinkRefused', name: 'A smaller room, refused', group: 'The room and its sections' },
  { key: 'deletePlan', name: 'Delete the plan asks first', group: 'The room and its sections' },
  {
    key: 'roomChanged',
    name: 'A colleague changed the room (412)',
    group: 'The room and its sections',
  },
  { key: 'usCustomary', name: 'Feet and inches', group: 'The room and its sections' },
  { key: 'sectionAdd', name: 'Add a section', group: 'The room and its sections' },
  { key: 'sectionTaken', name: 'A section name already used', group: 'The room and its sections' },
  { key: 'sectionBlank', name: 'A section with no name', group: 'The room and its sections' },
  { key: 'sectionLimit', name: 'A 31st section', group: 'The room and its sections' },
  { key: 'sectionEdit', name: 'Edit a section', group: 'The room and its sections' },
  { key: 'sectionDelete', name: 'Delete a section', group: 'The room and its sections' },
  {
    key: 'sectionDeleteEmpty',
    name: 'Delete a section with no tables',
    group: 'The room and its sections',
  },
  { key: 'addMenu', name: 'Add table, the four shapes', group: 'Tables, rows and seats' },
  { key: 'placing', name: 'Placing a round table', group: 'Tables, rows and seats' },
  { key: 'placed', name: 'Placed, its fields open', group: 'Tables, rows and seats' },
  {
    key: 'tapChooses',
    name: 'A click chooses a table for Arrange',
    group: 'Tables, rows and seats',
  },
  { key: 'rect', name: 'A rectangular table', group: 'Tables, rows and seats' },
  { key: 'head', name: 'The head table', group: 'Tables, rows and seats' },
  { key: 'cocktail', name: 'A cocktail table', group: 'Tables, rows and seats' },
  { key: 'shapeChanged', name: 'Round to rectangular', group: 'Tables, rows and seats' },
  { key: 'squeeze', name: 'The squeeze warning', group: 'Tables, rows and seats' },
  { key: 'nameTaken', name: 'A table name already used', group: 'Tables, rows and seats' },
  { key: 'belowSeated', name: 'Fewer seats than guests', group: 'Tables, rows and seats' },
  { key: 'chair', name: 'A chair chosen', group: 'Tables, rows and seats' },
  { key: 'unusable', name: 'A chair marked unusable', group: 'Tables, rows and seats' },
  {
    key: 'unusableRefused',
    name: 'A taken chair can’t be marked',
    group: 'Tables, rows and seats',
  },
  { key: 'duplicated', name: 'Duplicate', group: 'Tables, rows and seats' },
  { key: 'deleteTable', name: 'Delete a table', group: 'Tables, rows and seats' },
  { key: 'deleteEmpty', name: 'Delete an empty table', group: 'Tables, rows and seats' },
  {
    key: 'tableChanged',
    name: 'A colleague changed the table (412)',
    group: 'Tables, rows and seats',
  },
  { key: 'rowAdded', name: 'Add row', group: 'Tables, rows and seats' },
  { key: 'rowTurned', name: 'A turned row, seat 4 chosen', group: 'Tables, rows and seats' },
  { key: 'rowLabelTaken', name: 'A row label already used', group: 'Tables, rows and seats' },
  { key: 'rowBelowSeated', name: 'A row shortened past a guest', group: 'Tables, rows and seats' },
  { key: 'deleteRow', name: 'Delete a row', group: 'Tables, rows and seats' },
  { key: 'seatAdded', name: 'Add seat', group: 'Tables, rows and seats' },
  { key: 'seatNameTaken', name: 'A seat name already used', group: 'Tables, rows and seats' },
  { key: 'drag', name: 'Dragging Table 10', group: 'Moving and the keyboard' },
  { key: 'resize', name: 'Resizing Table 9', group: 'Moving and the keyboard' },
  { key: 'turn', name: 'R turns Table 9', group: 'Moving and the keyboard' },
  { key: 'several', name: 'Three chosen, moved together', group: 'Moving and the keyboard' },
  { key: 'overlap', name: 'Overlapping Table 8', group: 'Moving and the keyboard' },
  { key: 'wall', name: 'Stopped at the wall', group: 'Moving and the keyboard' },
  { key: 'acrossRefused', name: 'Across typed past the wall', group: 'Moving and the keyboard' },
  { key: 'saving', name: 'Saving…', group: 'Moving and the keyboard' },
  { key: 'retrying', name: 'Couldn’t save, trying again', group: 'Moving and the keyboard' },
  { key: 'notSaved', name: 'This change wasn’t saved', group: 'Moving and the keyboard' },
  { key: 'stepRefused', name: 'A step refused (412)', group: 'Moving and the keyboard' },
  { key: 'tabOrder', name: 'Tab order', group: 'Moving and the keyboard' },
  { key: 'arrows', name: 'Shift and → moves a metre', group: 'Moving and the keyboard' },
  { key: 'duplicateKey', name: '⌘ D duplicates', group: 'Moving and the keyboard' },
  {
    key: 'screenReader',
    name: 'A screen reader entering the room',
    group: 'Moving and the keyboard',
  },
  { key: 'presenceOne', name: 'Priya Shah is here', group: 'Who else is here' },
  { key: 'presenceChose', name: 'Priya Shah has chosen Table 7', group: 'Who else is here' },
  { key: 'presenceBoth', name: 'You and Priya Shah chose Table 7', group: 'Who else is here' },
  { key: 'presenceSix', name: 'Six people here', group: 'Who else is here' },
  { key: 'presenceViewer', name: 'A viewer’s choice', group: 'Who else is here' },
  { key: 'reconnecting', name: 'Reconnecting', group: 'Who else is here' },
  { key: 'left', name: 'Priya Shah left', group: 'Who else is here' },
  { key: 'arriving', name: 'A colleague’s change arrives', group: 'Who else is here' },
  { key: 'seat', name: 'Seat: Without a seat 12', group: 'Seating guests' },
  { key: 'picked', name: 'A party picked', group: 'Seating guests' },
  { key: 'seated', name: 'Seated, with Undo', group: 'Seating guests' },
  { key: 'apart', name: 'Not side by side', group: 'Seating guests' },
  { key: 'full', name: 'A full table', group: 'Seating guests' },
  { key: 'short', name: 'Too small for the party', group: 'Seating guests' },
  { key: 'swap', name: 'A taken chair: Swap', group: 'Seating guests' },
  { key: 'race', name: 'Someone took the seat first', group: 'Seating guests' },
  { key: 'undoRefused', name: 'Undo refused', group: 'Seating guests' },
  { key: 'tableGuests', name: 'A table’s guests', group: 'Seating guests' },
  { key: 'moveAll', name: 'Move everyone to…', group: 'Seating guests' },
  { key: 'emptyTable', name: 'An empty table', group: 'Seating guests' },
  { key: 'everyoneSeated', name: 'Everyone coming has a seat', group: 'Seating guests' },
  { key: 'noMatch', name: 'A search that matches nobody', group: 'Seating guests' },
  { key: 'notSureYet', name: 'Not sure yet and no reply too', group: 'Seating guests' },
  { key: 'tables', name: 'The Tables view', group: 'Seating guests' },
  { key: 'tablesPicked', name: 'The Tables view, a party picked', group: 'Seating guests' },
  { key: 'list', name: 'The List view', group: 'Seating guests' },
  { key: 'listOpen', name: 'The List, Table 8 opened', group: 'Seating guests' },
  { key: 'print', name: 'Print', group: 'Print and paper' },
  { key: 'printPreparing', name: 'Print, preparing', group: 'Print and paper' },
  { key: 'printDone', name: 'Print, downloaded', group: 'Print and paper' },
  { key: 'printFailed', name: 'Print, failed', group: 'Print and paper' },
  { key: 'printReadOnly', name: 'Print, read only', group: 'Print and paper' },
  { key: 'paperFloor', name: 'Paper: the floor plan, A4', group: 'Print and paper' },
  { key: 'paperFloorLetter', name: 'Paper: the floor plan, Letter', group: 'Print and paper' },
  { key: 'paperFloorImage', name: 'Paper: the floor plan, image', group: 'Print and paper' },
  { key: 'paperLists', name: 'Paper: table lists, page 1', group: 'Print and paper' },
  { key: 'paperListsEnd', name: 'Paper: table lists, page 3', group: 'Print and paper' },
  { key: 'paperNobody', name: 'Paper: table lists, nobody seated', group: 'Print and paper' },
  { key: 'paperCard', name: 'Paper: a table card', group: 'Print and paper' },
  { key: 'paperCardTop', name: 'Paper: the head table’s card', group: 'Print and paper' },
] as const;

export type SeatingState = (typeof SEATING_STATES)[number]['key'];

export function seatingStateOf(raw: string | null): SeatingState | null {
  return SEATING_STATES.find((one) => one.key === raw)?.key ?? null;
}

const GROUPS = [...new Set(SEATING_STATES.map((one) => one.group))];

export const SEATING_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = GROUPS.map(
  (group) => ({
    name: group,
    states: SEATING_STATES.filter((one) => one.group === group).map((one) => ({
      to: one.key === 'plan' ? SEATING_AT : `${SEATING_AT}?state=${one.key}`,
      name: one.name,
    })),
  }),
);
