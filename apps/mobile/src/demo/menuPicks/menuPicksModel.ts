export type Access = 'manage' | 'read' | 'counts';

export type Allergen = 'celery' | 'eggs' | 'fish' | 'gluten' | 'milk' | 'peanuts' | 'sesame';

export interface Variant {
  id: string;
  name: string;
  contains: readonly Allergen[];
}

export interface Side {
  id: string;
  name: string;
}

export interface Dish {
  id: string;
  name: string;
  contains: readonly Allergen[];
  variants: readonly Variant[];
  sides: readonly Side[];
}

export interface Course {
  id: string;
  name: string;
  closes: string;
  dishes: readonly Dish[];
}

export interface Person {
  id: string;
  name: string;
  party: string;
  allergies: readonly Allergen[];
}

export interface Party {
  id: string;
  replier: string;
}

export interface DishPick {
  kind: 'dish';
  dishId: string;
  variantId: string | null;
  sideId: string | null;
  override?: { by: string; at: string };
}

export type Pick = DishPick | { kind: 'kitchen' } | { kind: 'skipped' } | { kind: 'changed' };

export interface MenuWorld {
  courses: readonly Course[];
  people: readonly Person[];
  parties: readonly Party[];
  picks: Readonly<Record<string, Readonly<Record<string, Pick>>>>;
  held: number;
  today: string;
}

export type HostReason =
  { kind: 'nothing' } | { kind: 'allergy'; dish: string; allergens: readonly Allergen[] };

export type Spot =
  | (Omit<DishPick, 'override'> & { kind: 'dish' })
  | { kind: 'kitchen' }
  | { kind: 'skipped' }
  | { kind: 'changed' }
  | { kind: 'none' }
  | { kind: 'host'; reason: HostReason };

export const HOST = 'Kemi Adebayo';
export const EVENT_NAME = 'Adaeze and Tunde’s wedding';
export const UPDATED_AT = '19:42';
export const SAVING_MS = 700;
export const DOWNLOAD_MS = 1500;

const ALLERGEN_WORDS: Readonly<Record<Allergen, string>> = {
  celery: 'celery',
  eggs: 'eggs',
  fish: 'fish',
  gluten: 'gluten',
  milk: 'milk',
  peanuts: 'peanuts',
  sesame: 'sesame',
};

export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) as string}`;
}

export const allergenWords = (allergens: readonly Allergen[]): string =>
  listOf(allergens.map((one) => ALLERGEN_WORDS[one]));

export function people(n: number): string {
  return n === 1 ? '1 person' : `${n} people`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayWords(date: string): string {
  const at = new Date(`${date}T12:00:00Z`);

  return `${DAYS[at.getUTCDay()] as string}, ${MONTHS[at.getUTCMonth()] as string} ${at.getUTCDate()}`;
}

export const MW = {
  title: 'Menu',
  back: 'Back to the event',
  kitchenSheet: 'Kitchen sheet',
  downloading: 'Downloading',
  downloadingLine: 'The share sheet opens when the PDF is ready.',
  downloadFailedTitle: 'The kitchen sheet couldn’t be downloaded',
  downloadFailed:
    'The kitchen sheet couldn’t be downloaded. Nothing was shared. Check your connection and try again.',
  tryAgain: 'Try again',
  header: (answered: number, room: number, percent: number, close: string) =>
    `${answered} of ${room} picks in · ${percent}% of the room · ${close}`,
  closeOne: (day: string) => `picks close ${day}`,
  closeFrom: (day: string) => `picks close from ${day}`,
  closeAll: (day: string) => `picks closed on ${day}`,
  live: (at: string) =>
    `Updated at ${at} · counts change while this is open. Pull down to refresh.`,
  refreshing: 'Updating counts',
  stale: (at: string) => `Not updated since ${at}. Counts may be behind. Trying again.`,
  loading: 'Loading the menu…',
  noMenuTitle: 'No menu yet. Build it on the web.',
  noMenuBody: 'Courses and dishes are set up on the event’s Menu on the web.',
  emptyTitle: 'Nobody is coming yet',
  emptyBody: 'Picks show here once guests say they are coming.',
  toGuests: 'Go to Guests',
  allIn: 'Everyone coming has a pick for every course.',
  held: (n: number, room: number) =>
    `${n} places not yet named · held for guests who haven’t named their companions. They can’t pick, so they are counted apart and are not in the room of ${room}.`,
  menuChanged:
    'Menu changed: the dish these guests picked was taken off. They are asked again, and are not counted as in.',
  needsHost: 'Needs the host',
  needsHostBody: 'Nothing is decided for these people on these courses until you step in.',
  nothingFor: (course: string) => `${course}: nothing on this course can be picked for them.`,
  allergyFor: (course: string, dish: string, allergens: string) =>
    `${course}: their pick, ${dish}, contains ${allergens}, recorded after they picked it.`,
  hostCount: (course: string, n: number) => `${course} · ${people(n)}`,
  answered: (n: number, room: number) => `${n} of ${room} answered`,
  pickOpen: (day: string) => `Picks close ${day}`,
  pickClosed: (day: string) => `Picks closed on ${day}`,
  contains: (allergens: string) => `Contains: ${allergens}`,
  variant: 'Variant ·',
  side: 'Side ·',
  kitchen: 'Kitchen’s choice',
  skipped: 'Skipped',
  hostRow: 'Needs the host',
  none: 'Not chosen',
  changed: 'Menu changed',
  whoHasnt: 'Who hasn’t picked',
  whoHasntNone: 'Everyone coming has picked every course, or is with the host above.',
  replied: (name: string, n: number) => `Replied by ${name} · ${people(n)}`,
  notChosenOn: (courses: string) => `Not chosen: ${courses}`,
  chooseFor: 'Choose for them',
  chooseForLabel: (name: string) => `Choose for ${name}`,
  needsManage: 'Choosing for a guest needs Guests manage.',
  needsRead: 'Names need Guests read. These are counts only.',
  nextStep: 'Changing the menu, its courses and its dishes is on the web, on the event’s Menu.',
  choosing: (name: string) => `Choosing for ${name}`,
  courseOf: (course: string, at: number, all: number) => `${course} · ${at} of ${all}`,
  kitchenChoose: 'Let the kitchen choose',
  whichWay: (dish: string) => `How should ${dish} come?`,
  whichSide: 'And a side?',
  allergyMark: 'Allergy',
  ruledOut: (allergens: string, who: string) =>
    `Contains ${allergens}, which ${who} is allergic to. You can still pick it.`,
  blank: (course: string, who: string) =>
    `Choose ${course.toLocaleLowerCase('en')} for ${who}, or let the kitchen choose.`,
  blankWay: (dish: string, who: string) => `Choose how ${who} has the ${dish}.`,
  save: 'Save',
  saveNext: 'Save and go on',
  cancel: 'Cancel',
  overrideTitle: (who: string, allergens: string) =>
    `${who}’s record says ${allergens}. Pick it anyway?`,
  overrideBody: (dish: string, allergens: string, who: string) =>
    `${dish} contains ${allergens}. If ${who}’s record is out of date, the pick is saved with your name and the time you confirmed it.`,
  chooseAnother: 'Choose another dish',
  pickAnyway: 'Pick it anyway',
  refused:
    'You cannot choose for guests on this event any more: your role no longer has Guests manage. Nothing was saved.',
  savedFor: (course: string, who: string, what: string) => `${course} chosen for ${who}: ${what}.`,
  savedOverride: (who: string, dish: string, allergens: string) =>
    `Recorded as your pick for ${who}, despite the record: ${dish} contains ${allergens}.`,
  shared: 'The kitchen sheet is ready. The system share sheet opens here.',
} as const;

const dish = (
  id: string,
  name: string,
  contains: readonly Allergen[],
  variants: readonly Variant[] = [],
  sides: readonly Side[] = [],
): Dish => ({ id, name, contains, variants, sides });

export const STARTERS_CLOSE = '2027-05-26';
export const MAINS_CLOSE = '2027-05-28';

export function sampleCourses(): Course[] {
  return [
    {
      id: 'k1',
      name: 'Starters',
      closes: STARTERS_CLOSE,
      dishes: [
        dish('k1-pepper', 'Catfish pepper soup', ['fish', 'celery']),
        dish('k1-groundnut', 'Groundnut soup', ['peanuts']),
      ],
    },
    {
      id: 'k2',
      name: 'Main course',
      closes: MAINS_CLOSE,
      dishes: [
        dish(
          'k2-jollof',
          'Jollof rice',
          [],
          [
            { id: 'v-chicken', name: 'Chicken', contains: ['celery'] },
            { id: 'v-plain', name: 'Plain', contains: [] },
          ],
        ),
        dish(
          'k2-coconut',
          'Coconut curry',
          [],
          [
            { id: 'v-fish', name: 'Fish', contains: ['fish'] },
            { id: 'v-chicken2', name: 'Chicken', contains: [] },
          ],
          [
            { id: 's-plantain', name: 'Plantain' },
            { id: 's-moimoi', name: 'Moi moi' },
          ],
        ),
        dish(
          'k2-wrap',
          'Suya wrap',
          ['peanuts', 'sesame'],
          [
            { id: 'v-beef', name: 'Beef', contains: [] },
            { id: 'v-chicken3', name: 'Chicken', contains: [] },
          ],
        ),
      ],
    },
    {
      id: 'k3',
      name: 'Dessert',
      closes: MAINS_CLOSE,
      dishes: [
        dish('k3-chinchin', 'Chin chin', ['gluten', 'milk', 'eggs']),
        dish('k3-zobo', 'Zobo sorbet', []),
      ],
    },
  ];
}

type Code = string;
type Row = readonly [
  name: string,
  allergies: readonly Allergen[],
  starter: Code,
  main: Code,
  dessert: Code,
];

const PARTIES: readonly (readonly Row[])[] = [
  [
    ['Bea Mensah', [], '-', '-', '-'],
    ['Kofi Mensah', [], 'p', '-', '-'],
    ['Ama Mensah', [], 'g', 'jc', '-'],
  ],
  [
    ['Kwame Asante', ['celery', 'peanuts'], '-', '-', 'cc'],
    ['Efua Asante', [], 'p', 'jc', 'cc'],
    ['Kojo Asante', ['celery'], 'g', 'jp', 'z'],
  ],
  [
    ['Ada Obi', ['milk'], 'p', 'jc', 'cc'],
    ['Chidi Obi', [], 'p', 'jc', 'cc'],
    ['Ngozi Obi', [], 'g', 'sb', 'z'],
  ],
  [
    ['Segun Bello', [], 'p', 'sb', 'cc'],
    ['Funmi Bello', [], 'g', 'jc', 'x'],
    ['Tobi Bello', [], 'g', 'jp', 'cc'],
  ],
  [
    ['Rosa Lima', [], 'p', 'cfp', 'z'],
    ['Pedro Lima', [], 'p', 'sb', 'cc'],
    ['Inês Lima', [], 'g', 'ccp', 'z'],
  ],
  [
    ['Hana Sato', [], 'p', 'cfm', 'z'],
    ['Ken Sato', [], 'g', 'sb', 'x'],
    ['Yui Sato', [], 'p', 'ccm', 'cc'],
  ],
  [
    ['Leila Haddad', ['sesame'], 'p', 'sb', 'z'],
    ['Omar Haddad', [], 'g', 'sc', 'cc'],
    ['Nour Haddad', [], 'p', 'ccp', 'z'],
  ],
  [
    ['Mateo Ruiz', [], 'g', 'sb', 'cc'],
    ['Lucía Ruiz', [], 'p', 'jc', 'cc'],
    ['Pablo Ruiz', [], 'p', 'sc', 'x'],
  ],
  [
    ['Claire Martin', [], 'p', 'cfp', 'z'],
    ['Louis Martin', [], 'g', 'jc', 'cc'],
    ['Jeanne Martin', [], 'p', 'ccm', 'z'],
  ],
  [
    ['Femi Adeyemi', [], 'p', 'sb', 'cc'],
    ['Bisi Adeyemi', [], 'g', 'jc', 'x'],
    ['Ife Adeyemi', [], 'g', 'jp', 'cc'],
  ],
  [
    ['Sanjay Rao', ['gluten'], 'p', 'cfp', 'z'],
    ['Priya Rao', [], 'g', 'ccp', 'z'],
    ['Arjun Rao', [], 'p', 'sc', 'cc'],
  ],
  [
    ['Zara Khan', [], 'p', 'jc', 'cc'],
    ['Imran Khan', [], 'g', 'sb', 'x'],
    ['Aisha Khan', [], 'p', 'ccm', 'z'],
  ],
  [
    ['Uche Eze', [], 'g', 'jc', 'cc'],
    ['Chioma Eze', [], 'p', 'cfm', 'z'],
    ['Obinna Eze', [], 'p', 'jc', 'x'],
  ],
  [
    ['Elena Rossi', ['fish'], 'g', 'ccp', 'cc'],
    ['Marco Rossi', [], 'p', 'jc', 'cc'],
    ['Giulia Rossi', [], 'g', 'ccm', 'z'],
  ],
  [
    ['Yusuf Ali', [], 'p', 'jc', 'cc'],
    ['Mariam Ali', [], 'k', 'k', 'k'],
    ['Hamza Ali', [], 'k', 'k', 'k'],
  ],
  [
    ['Nadia Petrova', [], '-', '-', '-'],
    ['Ivan Petrov', [], 'p', '-', 'cc'],
    ['Sasha Petrova', [], 'g', 'jp', 'z'],
  ],
];

const dishPick = (
  dishId: string,
  variantId: string | null = null,
  sideId: string | null = null,
): DishPick => ({ kind: 'dish', dishId, variantId, sideId });

const CODES: Readonly<Record<Code, Pick | null>> = {
  '-': null,
  p: dishPick('k1-pepper'),
  g: dishPick('k1-groundnut'),
  jc: dishPick('k2-jollof', 'v-chicken'),
  jp: dishPick('k2-jollof', 'v-plain'),
  cfp: dishPick('k2-coconut', 'v-fish', 's-plantain'),
  cfm: dishPick('k2-coconut', 'v-fish', 's-moimoi'),
  ccp: dishPick('k2-coconut', 'v-chicken2', 's-plantain'),
  ccm: dishPick('k2-coconut', 'v-chicken2', 's-moimoi'),
  sb: dishPick('k2-wrap', 'v-beef'),
  sc: dishPick('k2-wrap', 'v-chicken3'),
  cc: dishPick('k3-chinchin'),
  z: dishPick('k3-zobo'),
  x: { kind: 'skipped' },
  k: { kind: 'kitchen' },
};

export const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[^A-Za-z ]/g, '')
    .toLowerCase()
    .replace(/ /g, '-');

export const TODAY = {
  open: '2027-05-20',
  oneClosed: '2027-05-27',
  allClosed: '2027-05-29',
} as const;

export function sampleMenu(today: string = TODAY.open): MenuWorld {
  const parties: Party[] = [];
  const everyone: Person[] = [];
  const picks: Record<string, Record<string, Pick>> = { k1: {}, k2: {}, k3: {} };

  for (const party of PARTIES) {
    const first = party[0] as Row;
    const id = `p-${slug(first[0])}`;
    parties.push({ id, replier: first[0] });
    for (const [name, allergies, ...codes] of party) {
      const personId = slug(name);
      everyone.push({ id: personId, name, party: id, allergies });
      codes.forEach((code, at) => {
        const pick = CODES[code] ?? null;
        if (pick != null) (picks[`k${at + 1}`] as Record<string, Pick>)[personId] = pick;
      });
    }
  }

  return { courses: sampleCourses(), people: everyone, parties, picks, held: 0, today };
}

export const courseOf = (world: MenuWorld, id: string): Course | undefined =>
  world.courses.find((one) => one.id === id);

export const personOf = (world: MenuWorld, id: string): Person | undefined =>
  world.people.find((one) => one.id === id);

export const isClosed = (world: MenuWorld, course: Course): boolean => world.today > course.closes;

export function containsOf(found: Dish, variantId: string | null): Allergen[] {
  const variant = found.variants.find((one) => one.id === variantId);

  return [...new Set([...found.contains, ...(variant?.contains ?? [])])];
}

export const ruledOut = (person: Person, contains: readonly Allergen[]): Allergen[] =>
  contains.filter((one) => person.allergies.includes(one));

export function nothingFor(course: Course, person: Person): boolean {
  return course.dishes.every((one) =>
    one.variants.length === 0
      ? ruledOut(person, one.contains).length > 0
      : one.variants.every((way) => ruledOut(person, containsOf(one, way.id)).length > 0),
  );
}

export function pickName(found: Dish, pick: { variantId: string | null; sideId: string | null }) {
  const variant = found.variants.find((one) => one.id === pick.variantId);
  const side = found.sides.find((one) => one.id === pick.sideId);

  return [found.name, variant?.name, side?.name].filter(Boolean).join(', ');
}

export function spotOf(world: MenuWorld, course: Course, person: Person): Spot {
  const pick = world.picks[course.id]?.[person.id];

  if (pick == null)
    return nothingFor(course, person)
      ? { kind: 'host', reason: { kind: 'nothing' } }
      : { kind: 'none' };
  if (pick.kind !== 'dish') return pick;

  const found = course.dishes.find((one) => one.id === pick.dishId);
  if (found == null) return { kind: 'changed' };

  const allergens = ruledOut(person, containsOf(found, pick.variantId));
  if (allergens.length > 0 && pick.override == null)
    return { kind: 'host', reason: { kind: 'allergy', dish: pickName(found, pick), allergens } };

  return { kind: 'dish', dishId: pick.dishId, variantId: pick.variantId, sideId: pick.sideId };
}

export interface FigureRow {
  kind: 'dish' | 'variant' | 'side';
  id: string;
  name: string;
  contains: readonly Allergen[];
  count: number;
}

export interface CourseFigures {
  answered: number;
  rows: FigureRow[];
  kitchen: number;
  skipped: number;
  host: number;
  none: number;
  changed: number;
}

export function courseFigures(world: MenuWorld, course: Course): CourseFigures {
  const spots = world.people.map((person) => spotOf(world, course, person));
  const dishes = spots.filter((spot) => spot.kind === 'dish');
  const count = (kind: Spot['kind']) => spots.filter((spot) => spot.kind === kind).length;
  const rows = course.dishes.flatMap((one): FigureRow[] => {
    const on = dishes.filter((spot) => spot.dishId === one.id);

    return [
      { kind: 'dish', id: one.id, name: one.name, contains: one.contains, count: on.length },
      ...one.variants.map((way): FigureRow => ({
        kind: 'variant',
        id: way.id,
        name: way.name,
        contains: way.contains.filter((a) => !one.contains.includes(a)),
        count: on.filter((spot) => spot.variantId === way.id).length,
      })),
      ...one.sides.map((side): FigureRow => ({
        kind: 'side',
        id: side.id,
        name: side.name,
        contains: [],
        count: on.filter((spot) => spot.sideId === side.id).length,
      })),
    ];
  });
  const figures = {
    rows,
    kitchen: count('kitchen'),
    skipped: count('skipped'),
    host: count('host'),
    none: count('none'),
    changed: count('changed'),
  };

  return { ...figures, answered: dishes.length + figures.kitchen + figures.skipped };
}

/** The figures add up to the room: every dish, the kitchen, skipped, the host, not chosen and menu changed. */
export function sumOf(figures: CourseFigures): number {
  return (
    figures.rows.filter((row) => row.kind === 'dish').reduce((sum, row) => sum + row.count, 0) +
    figures.kitchen +
    figures.skipped +
    figures.host +
    figures.none +
    figures.changed
  );
}

export const percentOf = (n: number, room: number): number =>
  room === 0 ? 0 : Math.round((n / room) * 100);

const isIn = (spot: Spot): boolean =>
  spot.kind === 'dish' || spot.kind === 'kitchen' || spot.kind === 'skipped';

/** sc-3905's header rule: the earliest close still ahead, "from" when the open ones differ, or the last close once all have passed. */
export function headerClose(world: MenuWorld): string {
  const open = world.courses.filter((one) => !isClosed(world, one)).map((one) => one.closes);
  if (open.length === 0) {
    const last = world.courses
      .map((one) => one.closes)
      .sort()
      .at(-1) as string;
    return MW.closeAll(dayWords(last));
  }
  const sorted = [...open].sort();
  const first = dayWords(sorted[0] as string);

  return new Set(sorted).size === 1 ? MW.closeOne(first) : MW.closeFrom(first);
}

/** Picks in counts the people who have answered every course. */
export function header(world: MenuWorld): string {
  const room = world.people.length;
  const answered = world.people.filter((person) =>
    world.courses.every((course) => isIn(spotOf(world, course, person))),
  ).length;

  return MW.header(answered, room, percentOf(answered, room), headerClose(world));
}

export function courseClose(world: MenuWorld, course: Course): { closed: boolean; words: string } {
  const closed = isClosed(world, course);
  const day = dayWords(course.closes);

  return { closed, words: closed ? MW.pickClosed(day) : MW.pickOpen(day) };
}

export interface HostLine {
  person: Person;
  course: Course;
  reason: HostReason;
}

export function needsHost(world: MenuWorld): HostLine[] {
  return world.people.flatMap((person) =>
    world.courses.flatMap((course) => {
      const spot = spotOf(world, course, person);

      return spot.kind === 'host' ? [{ person, course, reason: spot.reason }] : [];
    }),
  );
}

export function hostLineWords(line: HostLine): string {
  return line.reason.kind === 'nothing'
    ? MW.nothingFor(line.course.name)
    : MW.allergyFor(line.course.name, line.reason.dish, allergenWords(line.reason.allergens));
}

export function hostCounts(world: MenuWorld): string[] {
  const lines = needsHost(world);

  return world.courses.flatMap((course) => {
    const n = lines.filter((line) => line.course.id === course.id).length;
    return n === 0 ? [] : [MW.hostCount(course.name, n)];
  });
}

export interface Waiting {
  party: Party;
  people: { person: Person; courses: Course[] }[];
}

export function whoHasnt(world: MenuWorld): Waiting[] {
  return world.parties.flatMap((party) => {
    const open = world.people
      .filter((person) => person.party === party.id)
      .map((person) => ({
        person,
        courses: world.courses.filter((course) => spotOf(world, course, person).kind === 'none'),
      }))
      .filter((one) => one.courses.length > 0);

    return open.length === 0 ? [] : [{ party, people: open }];
  });
}

export const partySize = (world: MenuWorld, party: Party): number =>
  world.people.filter((one) => one.party === party.id).length;

export function chooseCourses(world: MenuWorld, person: Person, from?: string): Course[] {
  if (from != null) {
    const course = courseOf(world, from);
    return course == null ? [] : [course];
  }

  return world.courses.filter((course) => !isIn(spotOf(world, course, person)));
}

export function choose(
  world: MenuWorld,
  courseId: string,
  personId: string,
  pick: Pick,
): MenuWorld {
  return {
    ...world,
    picks: { ...world.picks, [courseId]: { ...world.picks[courseId], [personId]: pick } },
  };
}

export type Draft =
  | { kind: 'kitchen' }
  | { kind: 'dish'; dishId: string; variantId: string | null; sideId: string | null }
  | null;

export type DraftCheck =
  | { kind: 'blank'; words: string }
  | { kind: 'ruledOut'; title: string; body: string; allergens: readonly Allergen[] }
  | { kind: 'ok' };

export function checkDraft(course: Course, person: Person, draft: Draft): DraftCheck {
  if (draft == null) return { kind: 'blank', words: MW.blank(course.name, person.name) };
  if (draft.kind === 'kitchen') return { kind: 'ok' };
  const found = course.dishes.find((one) => one.id === draft.dishId);
  if (found == null) return { kind: 'blank', words: MW.blank(course.name, person.name) };
  if (found.variants.length > 0 && draft.variantId == null)
    return { kind: 'blank', words: MW.blankWay(found.name, person.name) };
  const allergens = ruledOut(person, containsOf(found, draft.variantId));
  if (allergens.length === 0) return { kind: 'ok' };
  const words = allergenWords(allergens);
  const name = pickName(found, draft);

  return {
    kind: 'ruledOut',
    allergens,
    title: MW.overrideTitle(person.name, words),
    body: MW.overrideBody(name, words, person.name),
  };
}

export function draftWords(course: Course, draft: Exclude<Draft, null>): string {
  if (draft.kind === 'kitchen') return MW.kitchen;
  const found = course.dishes.find((one) => one.id === draft.dishId);

  return found == null ? '' : pickName(found, draft);
}

export function draftPick(draft: Exclude<Draft, null>, override: boolean, at: string): Pick {
  if (draft.kind === 'kitchen') return { kind: 'kitchen' };

  return {
    kind: 'dish',
    dishId: draft.dishId,
    variantId: draft.variantId,
    sideId: draft.sideId,
    ...(override ? { override: { by: HOST, at } } : {}),
  };
}

export function dishAllergens(
  found: Dish,
  person: Person,
  variantId: string | null = null,
): Allergen[] {
  if (variantId != null) return ruledOut(person, containsOf(found, variantId));
  if (found.variants.length === 0) return ruledOut(person, found.contains);
  const each = found.variants.map((way) => ruledOut(person, containsOf(found, way.id)));
  if (!each.every((one) => one.length > 0)) return [];

  return [...new Set(each.flat())];
}

function allInMenu(): MenuWorld {
  let world = sampleMenu(TODAY.allClosed);
  for (const person of world.people)
    for (const course of world.courses) {
      const spot = spotOf(world, course, person);
      if (spot.kind === 'none' || spot.kind === 'host')
        world = choose(world, course.id, person.id, { kind: 'kitchen' });
    }

  return world;
}

function changedMenu(): MenuWorld {
  return ['lucia-ruiz', 'louis-martin', 'femi-adeyemi'].reduce(
    (world, id) => choose(world, 'k3', id, dishPick('k3-puffpuff')),
    sampleMenu(),
  );
}

export type System = 'loading' | 'refreshing' | 'stale';
export type Download = 'idle' | 'downloading' | 'failed' | 'shared';

export type Opened = {
  personId: string;
  courseId?: string;
  draft?: Draft;
  press?: boolean;
  refuses?: boolean;
};

export interface MenuStart {
  name: string;
  note: string;
  world: MenuWorld | null;
  access: Access;
  system: System | null;
  download: Download;
  opened: Opened | null;
}

function start(o: Partial<MenuStart> & { name: string; note: string }): MenuStart {
  return {
    world: sampleMenu(),
    access: 'manage',
    system: null,
    download: 'idle',
    opened: null,
    ...o,
  };
}

const STATES = {
  populated: () =>
    start({
      name: 'Populated',
      note: 'May 20: Starters close Wednesday, May 26 and the rest Friday, May 28, so the header says “from”.',
    }),
  oneClosed: () =>
    start({
      name: 'One course closed',
      note: 'May 27: Starters has closed, with its padlock; the header says Friday, May 28 without “from”.',
      world: sampleMenu(TODAY.oneClosed),
    }),
  allClosed: () =>
    start({
      name: 'All closed',
      note: 'May 29: “picks closed on Friday, May 28”, and the counts, Needs the host and Choose for them stay.',
      world: sampleMenu(TODAY.allClosed),
    }),
  loading: () => start({ name: 'Loading', note: 'The skeleton.', system: 'loading' }),
  refreshing: () =>
    start({
      name: 'Refreshing',
      note: 'Updating counts above the content; the last figures stay.',
      system: 'refreshing',
    }),
  stale: () =>
    start({ name: 'Stale', note: 'The amber line; the last figures stay.', system: 'stale' }),
  noMenu: () =>
    start({
      name: 'No menu',
      note: 'No Kitchen sheet and no counts: the menu is built on the web.',
      world: { ...sampleMenu(), courses: [] },
    }),
  nobody: () =>
    start({
      name: 'Nobody coming',
      note: 'A next step to Guests.',
      world: { ...sampleMenu(), people: [], parties: [], picks: {} },
    }),
  allIn: () =>
    start({
      name: 'All in',
      note: 'Every course closed and settled: Who hasn’t picked says so.',
      world: allInMenu(),
    }),
  held: () =>
    start({
      name: 'Held places',
      note: '6 places not yet named, counted apart from the room.',
      world: { ...sampleMenu(), held: 6 },
    }),
  menuChanged: () =>
    start({
      name: 'Menu changed',
      note: 'Three Dessert picks whose dish came off, counted as Menu changed and not in.',
      world: changedMenu(),
    }),
  chooseFor: () =>
    start({
      name: 'Choose for them',
      note: 'Bea Mensah, from Who hasn’t picked: Starters, then Main course, then Dessert. A sheet on a phone, a dialog on tablet portrait, a docked panel on tablet landscape.',
      opened: { personId: 'bea-mensah' },
    }),
  chooseBlank: () =>
    start({
      name: 'Choose for them, Save with nothing picked',
      note: 'Refused in place, nothing sent.',
      opened: { personId: 'bea-mensah', press: true },
    }),
  override: () =>
    start({
      name: 'The override alert',
      note: 'Kwame picked Jollof rice, Chicken, which contains celery. Choose another dish has the focus.',
      opened: {
        personId: 'kwame-asante',
        courseId: 'k2',
        draft: { kind: 'dish', dishId: 'k2-jollof', variantId: 'v-chicken', sideId: null },
        press: true,
      },
    }),
  refused: () =>
    start({
      name: 'Refused',
      note: 'The role lost Guests manage while the sheet was open. Nothing was saved.',
      opened: {
        personId: 'bea-mensah',
        draft: { kind: 'dish', dishId: 'k1-groundnut', variantId: null, sideId: null },
        press: true,
        refuses: true,
      },
    }),
  sheetDownloading: () =>
    start({
      name: 'Kitchen sheet downloading',
      note: 'The pill says Downloading; the share sheet is the system’s and is not drawn.',
      download: 'downloading',
    }),
  sheetFailed: () =>
    start({
      name: 'Kitchen sheet failed',
      note: 'Nothing was shared; Try again downloads again.',
      download: 'failed',
    }),
  readOnly: () =>
    start({
      name: 'Access: Guests read only',
      note: 'Names, and no Choose for them.',
      access: 'read',
    }),
  countsOnly: () =>
    start({
      name: 'Access: counts only, without Guests read',
      note: 'Needs the host as counts per course, and no Who hasn’t picked.',
      access: 'counts',
    }),
} satisfies Record<string, () => MenuStart>;

export type MenuStateName = keyof typeof STATES;

export const MENU_STATES = Object.keys(STATES) as MenuStateName[];

export const isMenuState = (raw: string | undefined): raw is MenuStateName =>
  raw != null && Object.hasOwn(STATES, raw);

export const menuStateOf = (raw: string | undefined): MenuStateName =>
  isMenuState(raw) ? raw : 'populated';

export const menuStart = (name: MenuStateName): MenuStart => STATES[name]();
