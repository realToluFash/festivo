import { demoWords } from './demoWords.ts';
import { BASE, type Figures, allergic } from './kitchenChanges.ts';
import { type Dish as MenuDish, MENU_FISH, MENU_JOLLOF, MW, choiceOf } from './menuServed.ts';
import { natural } from './seating.ts';

/** The kitchen sheet's parts (sc-34244): a course served In parts or Family style counts each part under its dish, then Served with this course, Plated at the pass and, Family style only, By table. */
export type HowServed = 'plated' | 'in_parts' | 'family_style' | 'buffet';

export const PW = {
  inParts: 'In parts',
  familyStyle: 'Family style',
  servedWith: MW.own,
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
  allergies: readonly string[];
  diets: readonly string[];
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

/** One plate: an allergy or a diet, a dish with no parts, or (Family style) a seat at a Plated at table; each guest once, however many records they have. */
export function platedAtPass(course: PartsCourse, guest: Guest): boolean {
  if (guest.allergies.length > 0 || guest.diets.length > 0) return true;

  const dish = dishOf(course, guest);

  if (dish != null && dish.parts.length === 0) return true;

  return (
    course.howServed === 'family_style' &&
    guest.table != null &&
    course.platedAt.includes(guest.table)
  );
}

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
  const tables = [...room.tables].sort((a, b) => natural(a.name, b.name));
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

function fromMenu(dish: MenuDish): Dish {
  return {
    id: dish.id,
    name: dish.name,
    variants: dish.variants.map((name, index) => ({ id: `${dish.id}-v${index + 1}`, name })),
    parts: dish.items.flatMap((part): Part[] => {
      if (part.kind === 'fixed') return [{ kind: 'fixed', name: part.name }];
      if (part.kind === 'variant') return [];

      const choice = choiceOf(dish, part.choiceId);

      return choice == null ? [] : [{ kind: 'choice', ...choice }];
    }),
  };
}

const JOLLOF = fromMenu(MENU_JOLLOF);
const FISH = fromMenu(MENU_FISH);

const RISOTTO: Dish = { id: 'm-risotto', name: 'Mushroom risotto', variants: [], parts: [] };

export function mainCourse(howServed: HowServed, platedAt: readonly string[] = []): PartsCourse {
  return {
    id: 'm',
    name: 'Main',
    howServed,
    dishes: [JOLLOF, FISH, RISOTTO],
    ownParts: hasParts({ howServed }) ? ['Drink'] : [],
    platedAt,
  };
}

// A seat: JP/JS/JM Jollof with Plantain/Salad/Moi moi, J with None for me; C/T fish, Croaker/Tilapia; R risotto;
// K Kitchen's choice; H Needs the host; N not chosen yet. A star takes the next of records(): the allergic guests, then the diets.
const SEATS: readonly [string | null, string][] = [
  ['top', 'JP JP* JS C C* T* R* R JP JM* C JP'],
  ['t1', 'JP J JS JM* C* C R* JP'],
  ['t2', 'JP* JS C C T* R JP JP*'],
  ['t3', 'JP JP JS K C T* R* JM'],
  ['t4', 'JP JP* JS JM C* C T* R'],
  ['t5', 'JP JS* JM C* C T* R* N'],
  ['t6', 'JP JP* JS C T T* R* H'],
  ['t7', 'JP* JS* C* T* R* R* J* C*'],
  ['t8', 'JP JP JS* C T* T R K'],
  ['t9', 'JP JM* JP* C C* T R* N'],
  ['t10', 'JP JP JS C* T T* R N*'],
  [null, 'JP JS C N'],
];

type Records = Pick<Guest, 'allergies' | 'diets'>;

function records(): Records[] {
  const diets = Object.entries(PARTS_FIGURES.otherDiets).flatMap(([diet, count]) =>
    Array.from({ length: count }, () => ({ allergies: [], diets: [diet] })),
  );

  return [
    ...allergic(PARTS_FIGURES).map(({ allergies, diets }) => ({ allergies, diets })),
    ...diets,
  ];
}

const SIDES: Readonly<Record<string, number>> = { P: 0, S: 1, M: 2 };

function sideAnswers(code: string): Record<string, string | null> {
  const side = JOLLOF.parts.find((part) => part.kind === 'choice');

  if (side?.kind !== 'choice') return {};

  return { [side.id]: side.options[SIDES[code.slice(1)] ?? -1] ?? null };
}

function pickOf(code: string): GuestPick {
  const short = code.replace('*', '');
  const none = { K: 'kitchen', X: 'skipped', H: 'host', N: 'notChosen' } as const;

  if (short in none) return { none: none[short as keyof typeof none] };
  if (short === 'R') return { dish: RISOTTO.id, variant: null, answers: {} };
  if (short.startsWith('J')) return { dish: JOLLOF.id, variant: null, answers: sideAnswers(short) };

  return {
    dish: FISH.id,
    variant: FISH.variants[short === 'C' ? 0 : 1]?.id ?? null,
    answers: {},
  };
}

export interface RoomOptions {
  skipped?: number;
  seatAll?: boolean;
}

export function mainRoom({ skipped = 0, seatAll = false }: RoomOptions = {}): Room {
  let skipping = skipped;
  const left = records();
  const guests: Guest[] = [];

  for (const [table, codes] of SEATS)
    codes.split(' ').forEach((code, index) => {
      const skips = skipping > 0 && code.startsWith('JP');
      const recorded = code.endsWith('*') ? left.shift() : undefined;

      if (skips) skipping -= 1;
      guests.push({
        id: `g-${table ?? 'none'}-${index + 1}`,
        table: table ?? (seatAll ? 'top' : null),
        allergies: recorded?.allergies ?? [],
        diets: recorded?.diets ?? [],
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

/** The sheet around the parts: sc-3911's Allergies and Diets as they are, the Main's dishes named as the Menu names them, and one guest with both an allergy and a diet. */
export const PARTS_FIGURES: Figures = {
  ...BASE,
  needs: BASE.needs.map((need) => ({
    ...need,
    dishes: need.dishes
      .replaceAll('Jollof rice with chicken', JOLLOF.name)
      .replaceAll('Grilled sea bass', FISH.name),
    diets: need.guest === 'g-amaka' ? ['halal'] : need.diets,
  })),
  otherDiets: { ...BASE.otherDiets, halal: (BASE.otherDiets.halal ?? 0) - 1 },
};
