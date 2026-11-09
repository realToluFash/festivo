import { demoWords } from './demoWords.ts';
import { BASE, type Figures } from './kitchenChanges.ts';

/** The kitchen sheet's parts (sc-34244): a course served In parts or Family style counts each part under its dish, then Served with this course, Plated at the pass and, Family style only, By table. */
export const PW = {
  inParts: 'In parts',
  familyStyle: 'Family style',
  servedWith: 'Served with this course',
  byTable: 'By table',
  tableHead: 'Table',
  plattersHead: 'Platters',
  noTable: 'No table',
  kitchensChoice: 'Kitchen’s choice',
  skipped: 'Skipped',
  needsHost: 'Needs the host',
  notChosen: 'Not chosen yet',
  dishHead: 'Dish',
  peopleHead: 'People',
  partsHead: 'Parts',
  part_one: '{{part}} · {{count}}',
  part_other: '{{part}} · {{count}}',
  option_one: '{{option}} {{count}}',
  option_other: '{{option}} {{count}}',
  plated_one: 'Plated at the pass · {{count}}',
  plated_other: 'Plated at the pass · {{count}}',
  tableKitchen_one: 'Kitchen’s choice {{count}}',
  tableKitchen_other: 'Kitchen’s choice {{count}}',
  tableHost_one: 'Needs the host {{count}}',
  tableHost_other: 'Needs the host {{count}}',
  tableNotChosen_one: 'Not chosen yet {{count}}',
  tableNotChosen_other: 'Not chosen yet {{count}}',
  dishParts: '{{dish}}: {{parts}}',
  health:
    'This sheet holds guests’ health information. Keep it with the kitchen and dispose of it after the event.',
  page: 'Page {{n}} of {{m}}',
  allergicTo: 'Allergic to',
  name: 'Name',
  diet: 'Diet',
  joined: '{{a}} · {{b}}',
} as const;

const { filled, many } = demoWords(PW);

export { filled as pw, many as pwMany };

export type HowServed = 'plated' | 'in_parts' | 'family_style' | 'buffet';

export type Part =
  | { kind: 'fixed'; name: string }
  | { kind: 'choice'; id: string; question: string; options: readonly string[] };

export interface Dish {
  id: string;
  name: string;
  variants: readonly { id: string; name: string }[];
  parts: readonly Part[];
}

export interface PartsCourse {
  id: string;
  name: string;
  howServed: HowServed;
  dishes: readonly Dish[];
  ownParts: readonly string[];
  platedAt: readonly string[];
}

export interface Table {
  id: string;
  name: string;
}

export type GuestPick =
  | { dish: string; variant: string | null; answers: Readonly<Record<string, string | null>> }
  | { none: 'kitchen' | 'skipped' | 'host' | 'notChosen' };

export interface Guest {
  id: string;
  table: string | null;
  needs: boolean;
  pick: GuestPick;
}

export interface Room {
  tables: readonly Table[];
  guests: readonly Guest[];
}

export type RowKind = 'dish' | 'variant' | 'tail';

export interface Row {
  id: string;
  kind: RowKind;
  name: string;
  count: number;
  parts: readonly string[];
}

export interface TableLine {
  id: string;
  name: string;
  lines: readonly string[];
}

export interface CourseSheet {
  rows: readonly Row[];
  servedWith: readonly string[];
  plated: string | null;
  byTable: readonly TableLine[];
}

const TAILS = [
  ['kitchen', PW.kitchensChoice],
  ['skipped', PW.skipped],
  ['host', PW.needsHost],
  ['notChosen', PW.notChosen],
] as const;

const TABLE_TAILS = [
  ['kitchen', 'tableKitchen'],
  ['host', 'tableHost'],
  ['notChosen', 'tableNotChosen'],
] as const;

export function hasParts(course: Pick<PartsCourse, 'howServed'>): boolean {
  return course.howServed === 'in_parts' || course.howServed === 'family_style';
}

type DishPick = Extract<GuestPick, { dish: string }>;

function dishPick(guest: Guest): DishPick | null {
  return 'dish' in guest.pick ? guest.pick : null;
}

export function counted(room: Room): Guest[] {
  return room.guests.filter((guest) => !('none' in guest.pick && guest.pick.none === 'skipped'));
}

function eating(guests: readonly Guest[], dish: Dish): Guest[] {
  return guests.filter((guest) => dishPick(guest)?.dish === dish.id);
}

/** A fixed part counts everyone on the dish, across its variants; a choice counts each option, and None for me is no line (See picks counts options only). */
function partCounts(part: Part, guests: readonly Guest[]): [string, number][] {
  if (part.kind === 'fixed') return [[part.name, guests.length]];

  return part.options.map((option) => [
    option,
    guests.filter((guest) => dishPick(guest)?.answers[part.id] === option).length,
  ]);
}

function totalLine(part: Part, guests: readonly Guest[]): string {
  if (part.kind === 'fixed') return many('part', guests.length, { part: part.name });

  return joinAll(
    partCounts(part, guests).map(([option, count]) => many('option', count, { option })),
  );
}

function joinAll(items: readonly string[]): string {
  return items.reduce((a, b) => filled(PW.joined, { a, b }));
}

export function courseRows(course: PartsCourse, room: Room): Row[] {
  const parts = hasParts(course);
  const rows: Row[] = [];

  for (const dish of course.dishes) {
    const on = eating(room.guests, dish);

    rows.push({
      id: dish.id,
      kind: 'dish',
      name: dish.name,
      count: on.length,
      parts: parts ? dish.parts.map((part) => totalLine(part, on)) : [],
    });
    for (const variant of dish.variants)
      rows.push({
        id: variant.id,
        kind: 'variant',
        name: filled(PW.joined, { a: dish.name, b: variant.name }),
        count: on.filter((guest) => dishPick(guest)?.variant === variant.id).length,
        parts: [],
      });
  }

  for (const [none, name] of TAILS) {
    const count = room.guests.filter(
      (guest) => 'none' in guest.pick && guest.pick.none === none,
    ).length;

    if (count > 0) rows.push({ id: `${course.id}-${none}`, kind: 'tail', name, count, parts: [] });
  }

  return rows;
}

function dishOf(course: PartsCourse, guest: Guest): Dish | null {
  const pick = dishPick(guest);

  return pick == null ? null : (course.dishes.find((dish) => dish.id === pick.dish) ?? null);
}

/** One plate: an allergy or a diet, a dish with no parts, or (Family style) a seat at a Plated at table; each guest once. */
export function platedAtPass(course: PartsCourse, guest: Guest): boolean {
  if (guest.needs) return true;

  const dish = dishOf(course, guest);

  if (dish != null && dish.parts.length === 0) return true;

  return (
    course.howServed === 'family_style' &&
    guest.table != null &&
    course.platedAt.includes(guest.table)
  );
}

const NATURAL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function tableLines(course: PartsCourse, guests: readonly Guest[]): string[] {
  const lines: string[] = [];

  for (const dish of course.dishes) {
    const on = eating(guests, dish);

    if (on.length === 0 || dish.parts.length === 0) continue;

    const counts = dish.parts
      .flatMap((part) => partCounts(part, on))
      .filter(([, count]) => count > 0)
      .map(([name, count]) => many('option', count, { option: name }));

    lines.push(filled(PW.dishParts, { dish: dish.name, parts: joinAll(counts) }));
  }

  for (const [none, key] of TABLE_TAILS) {
    const count = guests.filter((guest) => 'none' in guest.pick && guest.pick.none === none).length;

    if (count > 0) lines.push(many(key, count));
  }

  return lines;
}

/** The platters: each table with guests counted for the course and not plated at the pass, in natural order, then No table; a table with none isn't listed. */
export function byTable(course: PartsCourse, room: Room): TableLine[] {
  if (course.howServed !== 'family_style') return [];

  const platter = counted(room).filter((guest) => !platedAtPass(course, guest));
  const tables = [...room.tables].sort((a, b) => NATURAL.compare(a.name, b.name));
  const lines: TableLine[] = [];

  for (const table of tables) {
    const here = platter.filter((guest) => guest.table === table.id);

    if (here.length > 0)
      lines.push({ id: table.id, name: table.name, lines: tableLines(course, here) });
  }

  const nowhere = platter.filter(
    (guest) => guest.table == null || !room.tables.some((table) => table.id === guest.table),
  );

  if (nowhere.length > 0)
    lines.push({ id: 'none', name: PW.noTable, lines: tableLines(course, nowhere) });

  return lines;
}

export function courseSheet(course: PartsCourse, room: Room): CourseSheet {
  const rows = courseRows(course, room);

  if (!hasParts(course)) return { rows, servedWith: [], plated: null, byTable: [] };

  const guests = counted(room);

  return {
    rows,
    servedWith: course.ownParts.map((part) => many('part', guests.length, { part })),
    plated: many('plated', guests.filter((guest) => platedAtPass(course, guest)).length),
    byTable: byTable(course, room),
  };
}

export function wayWord(course: Pick<PartsCourse, 'howServed'>): string | null {
  if (course.howServed === 'in_parts') return PW.inParts;

  return course.howServed === 'family_style' ? PW.familyStyle : null;
}

export const TABLES: readonly Table[] = [
  { id: 'top', name: 'Top table' },
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Table ${index + 1}`,
  })),
];

const JOLLOF: Dish = {
  id: 'm-jollof',
  name: 'Jollof rice',
  variants: [],
  parts: [
    { kind: 'fixed', name: 'Rice' },
    { kind: 'choice', id: 'q-meat', question: 'Chicken or beef?', options: ['Chicken', 'Beef'] },
    { kind: 'fixed', name: 'Plantain' },
  ],
};

const BASS: Dish = {
  id: 'm-bass',
  name: 'Grilled sea bass',
  variants: [
    { id: 'm-bass-butter', name: 'With butter' },
    { id: 'm-bass-dairy', name: 'Dairy-free' },
  ],
  parts: [
    { kind: 'fixed', name: 'Rice' },
    { kind: 'fixed', name: 'Sea bass' },
    { kind: 'choice', id: 'q-sauce', question: 'Pepper sauce?', options: ['Pepper sauce'] },
  ],
};

const RISOTTO: Dish = { id: 'm-risotto', name: 'Mushroom risotto', variants: [], parts: [] };

export function mainCourse(howServed: HowServed, platedAt: readonly string[] = []): PartsCourse {
  return {
    id: 'm',
    name: 'Main',
    howServed,
    dishes: [JOLLOF, BASS, RISOTTO],
    ownParts: hasParts({ howServed }) ? ['Drink'] : [],
    platedAt,
  };
}

// A seat: JC/JB Jollof chicken/beef; Bp/Bn bass butter, pepper sauce/none; Dp/Dn bass dairy-free; R risotto;
// K Kitchen's choice; H Needs the host; N not chosen yet. A star is an allergy or a diet.
const SEATS: readonly [string | null, string][] = [
  ['top', 'JC JC* JB Bp Bp* Dn* R* R JC JB* Bn JC'],
  ['t1', 'JC JC JB JB* Bp* Bn R* JC'],
  ['t2', 'JC* JB Bp Bp Dp* R JC JC*'],
  ['t3', 'JC JC JB K Bp Dn* R* JB'],
  ['t4', 'JC JC* JB JB Bp* Bn Dp* R'],
  ['t5', 'JC JB* JB Bp* Bp Dp* R* N'],
  ['t6', 'JC JC* JB Bn Dp Dn* R* H'],
  ['t7', 'JC* JB* Bp* Dp* R* R* JC* Bn*'],
  ['t8', 'JC JC JB* Bp Dp* Dn R K'],
  ['t9', 'JC JB* JC* Bp Bn* Dp R* N'],
  ['t10', 'JC JC JB Bp* Dp Dn* R N*'],
  [null, 'JC JB Bp N'],
];

function pickOf(code: string): GuestPick {
  const short = code.replace('*', '');
  const none = { K: 'kitchen', X: 'skipped', H: 'host', N: 'notChosen' } as const;

  if (short in none) return { none: none[short as keyof typeof none] };
  if (short === 'R') return { dish: RISOTTO.id, variant: null, answers: {} };
  if (short.startsWith('J'))
    return {
      dish: JOLLOF.id,
      variant: null,
      answers: { 'q-meat': short === 'JC' ? 'Chicken' : 'Beef' },
    };

  return {
    dish: BASS.id,
    variant: short.startsWith('B') ? 'm-bass-butter' : 'm-bass-dairy',
    answers: { 'q-sauce': short.endsWith('p') ? 'Pepper sauce' : null },
  };
}

export interface RoomOptions {
  skipped?: number;
  seatAll?: boolean;
}

export function mainRoom({ skipped = 0, seatAll = false }: RoomOptions = {}): Room {
  let skipping = skipped;
  const guests: Guest[] = [];

  for (const [table, codes] of SEATS)
    codes.split(' ').forEach((code, index) => {
      const skips = skipping > 0 && code === 'JC';

      if (skips) skipping -= 1;
      guests.push({
        id: `g-${table ?? 'none'}-${index + 1}`,
        table: table ?? (seatAll ? 'top' : null),
        needs: code.endsWith('*'),
        pick: skips ? { none: 'skipped' } : pickOf(code),
      });
    });

  return { tables: TABLES, guests };
}

export type PartsSample = 'inParts' | 'familyStyle' | 'allPlated' | 'skipped' | 'plated';

export interface PartsSheet {
  course: PartsCourse;
  room: Room;
}

export const PARTS_SAMPLES: Record<PartsSample, () => PartsSheet> = {
  inParts: () => ({ course: mainCourse('in_parts'), room: mainRoom() }),
  familyStyle: () => ({ course: mainCourse('family_style', ['top']), room: mainRoom() }),
  allPlated: () => ({
    course: mainCourse(
      'family_style',
      TABLES.map((table) => table.id),
    ),
    room: mainRoom({ seatAll: true }),
  }),
  skipped: () => ({ course: mainCourse('in_parts'), room: mainRoom({ skipped: 2 }) }),
  plated: () => ({ course: mainCourse('plated'), room: mainRoom() }),
};

/** The sheet around the parts: sc-3911's Allergies and Diets as they are, the Main's dish named as this menu names it, and one guest with both an allergy and a diet. */
export const PARTS_FIGURES: Figures = {
  ...BASE,
  needs: BASE.needs.map((need) => ({
    ...need,
    dishes: need.dishes.replaceAll('Jollof rice with chicken', 'Jollof rice'),
    diets: need.guest === 'g-amaka' ? ['halal'] : need.diets,
  })),
  otherDiets: { ...BASE.otherDiets, halal: (BASE.otherDiets.halal ?? 0) - 1 },
};
