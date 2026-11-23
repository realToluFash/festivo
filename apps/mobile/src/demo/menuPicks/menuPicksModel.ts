export type Access = 'manage' | 'read' | 'counts';

export type Allergen = 'celery' | 'eggs' | 'fish' | 'gluten' | 'milk' | 'peanuts' | 'sesame';

export interface Variant {
  id: string;
  name: string;
  contains: readonly Allergen[];
  /** Children only: never offered to guests; the host gives it with Choose who gets it. */
  children?: true;
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

export type Diet = 'vegetarian' | 'halal' | 'no_pork' | 'pescatarian';

export interface CourseDefault {
  dishId: string;
  variantId: string | null;
  meets: readonly Diet[];
}

export interface Course {
  id: string;
  name: string;
  closes: string;
  dishes: readonly Dish[];
  asksNothing?: true;
  fallback?: CourseDefault;
}

export interface Person {
  id: string;
  name: string;
  party: string;
  allergies: readonly Allergen[];
  diets: readonly (Diet | 'other')[];
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

/** sc-3913's Menu changed: the course is asked again, and the pick they had is kept by name. */
export interface Changed {
  kind: 'changed';
  picked: string;
}

export type Pick = DishPick | { kind: 'kitchen' } | { kind: 'skipped' } | Changed;

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

export type Excluded = { kind: 'allergy' } | { kind: 'diet'; diet: Diet | 'other' };

export type Spot =
  | (Omit<DishPick, 'override'> & { kind: 'dish'; defaulted: boolean })
  | { kind: 'kitchen' }
  | { kind: 'skipped' }
  | Changed
  | { kind: 'none'; excluded: Excluded | null }
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

const guests = (n: number): string => (n === 1 ? '1 guest' : `${n} guests`);

const DIET_WORDS: Readonly<Record<Diet, string>> = {
  vegetarian: 'Vegetarian',
  halal: 'Halal',
  no_pork: 'No pork',
  pescatarian: 'Pescatarian',
};

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
  childrenOnly: 'Children only',
  chosen: 'Chosen',
  defaulted: 'Defaulted',
  dish: 'Dish',
  everyoneElse: 'Everyone else',
  peopleHead: 'People',
  rowSaid: (chosen: number, defaulted: number) => `${chosen} chosen, ${defaulted} defaulted`,
  defaultLine: (pick: string, day: string) =>
    `Default: ${pick}. Given on ${day} to anyone coming who hasn’t answered.`,
  defaultGiven: (pick: string, day: string, n: number) =>
    n === 0
      ? `Default: ${pick}. Nobody who hadn’t answered by ${day} has it.`
      : `Default: ${pick}. Given on ${day} to ${guests(n)} who hadn’t answered.`,
  asksNothing: (dish: string) =>
    `Guests are asked nothing on this course. Everyone coming gets ${dish}, except the people you give a children’s variant and anyone it rules out, who wait under Needs the host.`,
  neverGiven: (n: number) => `Never given the default · ${people(n)}`,
  neverGivenBody: 'Listed first: the default was never theirs to get. Choose for them.',
  excludedOn: (course: string, why: string) => `${course} · ${why}`,
  allergy: 'allergy',
  otherDiet: 'Other diet',
  given: (n: number) => `Given the default · ${people(n)}`,
  givenBody: 'They had not answered by the close. Choosing for them replaces the default.',
  givenOn: (course: string, pick: string) => `${course}: ${pick}`,
  chooseWho: 'Choose who gets it',
  chooseWhoLabel: (variant: string, dish: string) => `Choose who gets ${variant}, ${dish}`,
  whoTitle: (variant: string) => `Choose who gets ${variant}`,
  whoSub: (dish: string, course: string) => `${dish} · ${course}`,
  whoHelp:
    'Everyone coming, by who replied. Ticked people have it now. Guests are never offered it on their own page.',
  ruledOutWho: (allergens: string, who: string) =>
    `Contains ${allergens}, which ${who} is allergic to.`,
  goesBack: (to: string) => `Goes back to ${to}.`,
  goesBackNone: 'Goes back to not chosen.',
  overrideWhoTitle: (names: string, variant: string) => `${names}: give ${variant} anyway?`,
  overrideWhoLine: (variant: string, allergens: string, who: string) =>
    `${variant} contains ${allergens}, which ${who} is allergic to.`,
  overrideWhoBody: (lines: string) =>
    `${lines} If a record is out of date, it is saved with your name and the time you confirmed it.`,
  leaveOut: 'Leave them out',
  giveAnyway: 'Give it anyway',
  whoSaved: (variant: string, dish: string, n: number) => `${variant}, ${dish}: ${people(n)} now.`,
  whoOverride: (names: string) => `${names} recorded as your pick despite the record.`,
  close: 'Close',
  kitchen: 'Kitchen’s choice',
  skipped: 'Skipped',
  hostRow: 'Needs the host',
  none: 'Not chosen',
  changed: 'Menu changed',
  whoHasnt: 'Who hasn’t picked',
  whoHasntNone: 'Everyone coming has picked every course, or is with the host above.',
  replied: (name: string, n: number) => `Replied by ${name} · ${people(n)}`,
  notChosenOn: (courses: string) => `Not chosen: ${courses}`,
  changedOn: (course: string, dish: string) => `Menu changed: ${course} · picked ${dish}`,
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
            { id: 'v-kids', name: 'Children’s portion', contains: ['celery'], children: true },
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
    ['Tobi Bello', [], 'g', 'jk', 'cc'],
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
    ['Ife Adeyemi', [], 'g', 'jk', 'cc'],
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
  jk: dishPick('k2-jollof', 'v-kids'),
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

const DIETS_OF: Readonly<Record<string, readonly (Diet | 'other')[]>> = {
  'bea-mensah': ['vegetarian'],
  'nadia-petrova': ['other'],
};

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
      everyone.push({ id: personId, name, party: id, allergies, diets: DIETS_OF[personId] ?? [] });
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

export const forEveryone = (found: Dish): Variant[] =>
  found.variants.filter((one) => one.children !== true);

export const everyoneVariant = (found: Dish): Variant | null => forEveryone(found)[0] ?? null;

export function nothingFor(course: Course, person: Person): boolean {
  return course.dishes.every((one) =>
    one.variants.length === 0
      ? ruledOut(person, one.contains).length > 0
      : forEveryone(one).every((way) => ruledOut(person, containsOf(one, way.id)).length > 0),
  );
}

/** Never given the default: any recorded allergy, then the first diet the default doesn't meet; a recorded Other diet is never met. */
export function excludedFrom(given: CourseDefault, person: Person): Excluded | null {
  if (person.allergies.length > 0) return { kind: 'allergy' };
  const diet = person.diets.find((one) => one === 'other' || !given.meets.includes(one));

  return diet == null ? null : { kind: 'diet', diet };
}

export function excludedWords(excluded: Excluded): string {
  if (excluded.kind === 'allergy') return MW.allergy;

  return excluded.diet === 'other' ? MW.otherDiet : DIET_WORDS[excluded.diet];
}

/** Being defaulted is never stored: no pick on a course whose default's close has passed, and nothing to exclude the person. */
function noPick(world: MenuWorld, course: Course, person: Person): Spot {
  if (nothingFor(course, person)) return { kind: 'host', reason: { kind: 'nothing' } };
  const given = course.fallback;
  if (given == null) return { kind: 'none', excluded: null };
  const excluded = excludedFrom(given, person);
  if (excluded != null || !isClosed(world, course)) return { kind: 'none', excluded };

  return {
    kind: 'dish',
    dishId: given.dishId,
    variantId: given.variantId,
    sideId: null,
    defaulted: true,
  };
}

export function pickName(found: Dish, pick: { variantId: string | null; sideId: string | null }) {
  const variant = found.variants.find((one) => one.id === pick.variantId);
  const side = found.sides.find((one) => one.id === pick.sideId);

  return [found.name, variant?.name, side?.name].filter(Boolean).join(', ');
}

export function spotOf(world: MenuWorld, course: Course, person: Person): Spot {
  const pick = world.picks[course.id]?.[person.id];

  if (course.asksNothing === true && pick == null) {
    const found = course.dishes[0] as Dish;
    const variantId = everyoneVariant(found)?.id ?? null;

    return ruledOut(person, containsOf(found, variantId)).length > 0
      ? { kind: 'host', reason: { kind: 'nothing' } }
      : { kind: 'dish', dishId: found.id, variantId, sideId: null, defaulted: false };
  }
  if (pick == null) return noPick(world, course, person);
  if (pick.kind !== 'dish') return pick;

  const found = course.dishes.find((one) => one.id === pick.dishId);
  if (found == null) return { kind: 'changed', picked: pick.dishId };

  const allergens = ruledOut(person, containsOf(found, pick.variantId));
  if (allergens.length > 0 && pick.override == null)
    return { kind: 'host', reason: { kind: 'allergy', dish: pickName(found, pick), allergens } };

  return {
    kind: 'dish',
    dishId: pick.dishId,
    variantId: pick.variantId,
    sideId: pick.sideId,
    defaulted: false,
  };
}

export interface FigureRow {
  kind: 'dish' | 'variant' | 'side';
  id: string;
  dishId: string;
  name: string;
  contains: readonly Allergen[];
  chosen: number;
  defaulted: number;
  children: boolean;
}

export interface CourseFigures {
  answered: number;
  hasDefault: boolean;
  defaultLine: string | null;
  asksNothingLine: string | null;
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
    const split = (test: (spot: (typeof on)[number]) => boolean) => ({
      chosen: on.filter((spot) => !spot.defaulted && test(spot)).length,
      defaulted: on.filter((spot) => spot.defaulted && test(spot)).length,
    });

    return [
      {
        kind: 'dish',
        id: one.id,
        dishId: one.id,
        name: one.name,
        contains: one.contains,
        children: false,
        ...split(() => true),
      },
      ...one.variants.map((way): FigureRow => ({
        kind: 'variant',
        id: way.id,
        dishId: one.id,
        name: way.name,
        contains: way.contains.filter((a) => !one.contains.includes(a)),
        children: way.children === true,
        ...split((spot) => spot.variantId === way.id),
      })),
      ...one.sides.map((side): FigureRow => ({
        kind: 'side',
        id: side.id,
        dishId: one.id,
        name: side.name,
        contains: [],
        children: false,
        ...split((spot) => spot.sideId === side.id),
      })),
    ];
  });
  const given = course.fallback;
  const givenWords = given == null ? null : defaultWords(course, given);
  const day = dayWords(course.closes);
  const figures = {
    hasDefault: given != null,
    defaultLine:
      givenWords == null
        ? null
        : isClosed(world, course)
          ? MW.defaultGiven(givenWords, day, dishes.filter((spot) => spot.defaulted).length)
          : MW.defaultLine(givenWords, day),
    asksNothingLine:
      course.asksNothing === true && course.dishes[0] != null
        ? MW.asksNothing(
            pickName(course.dishes[0], {
              variantId: everyoneVariant(course.dishes[0])?.id ?? null,
              sideId: null,
            }),
          )
        : null,
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
    figures.rows
      .filter((row) => row.kind === 'dish')
      .reduce((sum, row) => sum + row.chosen + row.defaulted, 0) +
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

/** Picks in counts the people who have answered every course guests choose; a course that asks nothing is not one. */
export function header(world: MenuWorld): string {
  const room = world.people.length;
  const asked = world.courses.filter((course) => course.asksNothing !== true);
  const answered = world.people.filter((person) =>
    asked.every((course) => isIn(spotOf(world, course, person))),
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

export interface OpenCourse {
  course: Course;
  excluded: Excluded | null;
}

export interface ChangedCourse {
  course: Course;
  picked: string;
}

export interface WaitingPerson {
  person: Person;
  /** Every course Choose for them opens on: not chosen, then Menu changed, in menu order. */
  courses: Course[];
  open: OpenCourse[];
  changed: ChangedCourse[];
}

export interface Waiting {
  party: Party;
  people: WaitingPerson[];
}

function waitingOf(world: MenuWorld, person: Person): WaitingPerson {
  const spots = world.courses.map((course) => ({ course, spot: spotOf(world, course, person) }));
  const open = spots.flatMap(({ course, spot }): OpenCourse[] =>
    spot.kind === 'none' ? [{ course, excluded: spot.excluded }] : [],
  );
  const changed = spots.flatMap(({ course, spot }): ChangedCourse[] =>
    spot.kind === 'changed' ? [{ course, picked: spot.picked }] : [],
  );
  const courses = spots
    .filter(({ spot }) => spot.kind === 'none' || spot.kind === 'changed')
    .map(({ course }) => course);

  return { person, courses, open, changed };
}

const isExcluded = (one: WaitingPerson): boolean =>
  one.open.some((course) => course.excluded != null);

export function neverGiven(world: MenuWorld): WaitingPerson[] {
  return world.people.map((person) => waitingOf(world, person)).filter(isExcluded);
}

export function whoHasnt(world: MenuWorld): Waiting[] {
  return world.parties.flatMap((party) => {
    const open = world.people
      .filter((person) => person.party === party.id)
      .map((person) => waitingOf(world, person))
      .filter((one) => one.courses.length > 0 && !isExcluded(one));

    return open.length === 0 ? [] : [{ party, people: open }];
  });
}

export function openWords(open: readonly OpenCourse[]): string {
  return MW.notChosenOn(
    listOf(
      open.map(({ course, excluded }) =>
        excluded == null ? course.name : MW.excludedOn(course.name, excludedWords(excluded)),
      ),
    ),
  );
}

export function defaultWords(course: Course, given: CourseDefault): string {
  const found = course.dishes.find((one) => one.id === given.dishId);

  return found == null ? '' : pickName(found, { variantId: given.variantId, sideId: null });
}

export function defaultedOn(world: MenuWorld, person: Person): Course[] {
  return world.courses.filter((course) => {
    const spot = spotOf(world, course, person);
    return spot.kind === 'dish' && spot.defaulted;
  });
}

export interface GivenPerson {
  person: Person;
  courses: { course: Course; pick: string }[];
}

export function givenDefault(world: MenuWorld): { party: Party; people: GivenPerson[] }[] {
  return world.parties.flatMap((party) => {
    const given = world.people
      .filter((person) => person.party === party.id)
      .map((person) => ({
        person,
        courses: defaultedOn(world, person).map((course) => ({
          course,
          pick: defaultWords(course, course.fallback as CourseDefault),
        })),
      }))
      .filter((one) => one.courses.length > 0);

    return given.length === 0 ? [] : [{ party, people: given }];
  });
}

export const partySize = (world: MenuWorld, party: Party): number =>
  world.people.filter((one) => one.party === party.id).length;

export function chooseCourses(
  world: MenuWorld,
  person: Person,
  from?: string,
  given?: boolean,
): Course[] {
  if (given === true) return defaultedOn(world, person);
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

export function startDraft(world: MenuWorld, course: Course, person: Person): Draft {
  const spot = spotOf(world, course, person);
  if (spot.kind !== 'dish' || !spot.defaulted) return null;

  return { kind: 'dish', dishId: spot.dishId, variantId: spot.variantId, sideId: spot.sideId };
}

export function withPick(
  world: MenuWorld,
  courseId: string,
  personId: string,
  pick: Pick | null,
): MenuWorld {
  const course = { ...world.picks[courseId] };
  if (pick == null) delete course[personId];
  else course[personId] = pick;

  return { ...world, picks: { ...world.picks, [courseId]: course } };
}

/** Has the variant now: stored on the course, whether or not a later allergy sends it to the host. */
export function hasVariant(
  world: MenuWorld,
  course: Course,
  person: Person,
  variantId: string,
): boolean {
  const pick = world.picks[course.id]?.[person.id];
  const spot = spotOf(world, course, person);

  return (
    pick?.kind === 'dish' &&
    pick.variantId === variantId &&
    (spot.kind === 'dish' || spot.kind === 'host')
  );
}

/** Where a person unticked from a Children only variant goes: the Everyone variant on a course that asks nothing, or Needs the host if it rules them out; not chosen on any other. */
export function goesBackWords(course: Course, person: Person): string {
  const found = course.dishes[0];
  if (course.asksNothing !== true || found == null) return MW.goesBackNone;
  const everyone = everyoneVariant(found);
  if (ruledOut(person, containsOf(found, everyone?.id ?? null)).length > 0)
    return MW.goesBack(MW.needsHost);

  return MW.goesBack(everyone?.name ?? found.name);
}

export interface WhoOpened {
  courseId: string;
  dishId: string;
  variantId: string;
  toggle?: readonly string[];
  press?: boolean;
  confirm?: boolean;
  refuses?: boolean;
}

export function whoParts(world: MenuWorld, opened: WhoOpened) {
  const course = courseOf(world, opened.courseId) as Course;
  const found = course.dishes.find((one) => one.id === opened.dishId) as Dish;
  const variant = found.variants.find((one) => one.id === opened.variantId) as Variant;

  return { course, found, variant, contains: containsOf(found, variant.id) };
}

export function tickedOf(world: MenuWorld, opened: WhoOpened): ReadonlySet<string> {
  const { course, variant } = whoParts(world, opened);
  const now = new Set(
    world.people.filter((one) => hasVariant(world, course, one, variant.id)).map((one) => one.id),
  );
  for (const id of opened.toggle ?? []) {
    if (now.has(id)) now.delete(id);
    else now.add(id);
  }

  return now;
}

export function giveVariant(
  world: MenuWorld,
  opened: WhoOpened,
  ticked: ReadonlySet<string>,
  confirmed: { by: string; at: string } | null,
): MenuWorld {
  const { course, found, variant, contains } = whoParts(world, opened);

  return world.people.reduce((next, person) => {
    const had = hasVariant(world, course, person, variant.id);
    const overridden = confirmed != null && ruledOut(person, contains).length > 0;
    if (ticked.has(person.id) && !had)
      return withPick(next, course.id, person.id, {
        kind: 'dish',
        dishId: found.id,
        variantId: variant.id,
        sideId: null,
        ...(overridden ? { override: confirmed } : {}),
      });
    if (!ticked.has(person.id) && had) return withPick(next, course.id, person.id, null);

    return next;
  }, world);
}

export type WhoOutcome =
  | { kind: 'ask'; people: Person[]; title: string; body: string }
  | { kind: 'refused' }
  | { kind: 'saved'; next: MenuWorld; line: string; overridden: string | null };

export function whoOutcome(
  world: MenuWorld,
  opened: WhoOpened,
  ticked: ReadonlySet<string>,
  confirmed: boolean,
  at: string,
): WhoOutcome {
  const { course, found, variant, contains } = whoParts(world, opened);
  const ruled = world.people.filter(
    (one) =>
      ticked.has(one.id) &&
      !hasVariant(world, course, one, variant.id) &&
      ruledOut(one, contains).length > 0,
  );
  if (ruled.length > 0 && !confirmed)
    return {
      kind: 'ask',
      people: ruled,
      title: MW.overrideWhoTitle(listOf(ruled.map((one) => one.name)), variant.name),
      body: MW.overrideWhoBody(
        ruled
          .map((one) =>
            MW.overrideWhoLine(variant.name, allergenWords(ruledOut(one, contains)), one.name),
          )
          .join(' '),
      ),
    };
  if (opened.refuses === true) return { kind: 'refused' };

  return {
    kind: 'saved',
    next: giveVariant(world, opened, ticked, ruled.length > 0 ? { by: HOST, at } : null),
    line: MW.whoSaved(variant.name, found.name, ticked.size),
    overridden: ruled.length > 0 ? MW.whoOverride(listOf(ruled.map((one) => one.name))) : null,
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
    (world, id) => choose(world, 'k3', id, { kind: 'changed', picked: 'Puff puff' }),
    sampleMenu(),
  );
}

export type System = 'loading' | 'refreshing' | 'stale';
export type Download = 'idle' | 'downloading' | 'failed' | 'shared';

export type Opened = {
  personId: string;
  courseId?: string;
  given?: boolean;
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
  who: WhoOpened | null;
}

function start(o: Partial<MenuStart> & { name: string; note: string }): MenuStart {
  return {
    world: sampleMenu(),
    access: 'manage',
    system: null,
    download: 'idle',
    opened: null,
    who: null,
    ...o,
  };
}

const MAIN_DEFAULT: CourseDefault = {
  dishId: 'k2-jollof',
  variantId: 'v-chicken',
  meets: ['halal', 'no_pork'],
};
const DESSERT_DEFAULT: CourseDefault = {
  dishId: 'k3-zobo',
  variantId: null,
  meets: ['vegetarian', 'halal', 'no_pork', 'pescatarian'],
};

export function withDefaults(world: MenuWorld, dessert = false): MenuWorld {
  return {
    ...world,
    courses: world.courses.map((course) =>
      course.id === 'k2'
        ? { ...course, fallback: MAIN_DEFAULT }
        : course.id === 'k3' && dessert
          ? { ...course, fallback: DESSERT_DEFAULT }
          : course,
    ),
  };
}

export function setStarter(world: MenuWorld): MenuWorld {
  const starter: Course = {
    id: 'k1',
    name: 'Starters',
    closes: STARTERS_CLOSE,
    asksNothing: true,
    dishes: [
      dish(
        'k1-pepper',
        'Catfish pepper soup',
        ['fish', 'celery'],
        [
          { id: 'v-full', name: 'Full bowl', contains: [] },
          { id: 'v-small', name: 'Children’s portion', contains: [], children: true },
        ],
      ),
    ],
  };
  const kids = Object.fromEntries(
    ['tobi-bello', 'ife-adeyemi', 'sasha-petrova'].map((id) => [
      id,
      dishPick('k1-pepper', 'v-small'),
    ]),
  );

  return {
    ...world,
    courses: world.courses.map((one) => (one.id === 'k1' ? starter : one)),
    picks: { ...world.picks, k1: kids },
  };
}

const KIDS_MAIN: WhoOpened = { courseId: 'k2', dishId: 'k2-jollof', variantId: 'v-kids' };
const KIDS_STARTER: WhoOpened = { courseId: 'k1', dishId: 'k1-pepper', variantId: 'v-small' };

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
      note: 'Three Dessert picks of Puff puff, which came off: counted as Menu changed and not in, and listed in Who hasn’t picked under their party with the pick they kept. Choose for them opens on Dessert.',
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
      note: 'Needs the host as counts per course, and no Who hasn’t picked or Choose who gets it.',
      access: 'counts',
    }),
  defaultBefore: () =>
    start({
      name: 'A default, before its close (sc-1362)',
      note: 'May 20: Main course’s default is Jollof rice, Chicken. Defaulted shows beside Chosen with 0, the line under Main course names the default, and Who hasn’t picked opens with those never given it: Kwame for an allergy, Bea for Vegetarian, Nadia for an Other diet.',
      world: withDefaults(sampleMenu()),
    }),
  defaultAfter: () =>
    start({
      name: 'A default, after its close (sc-1362)',
      note: 'May 29: Kofi and Ivan, coming with no main course and nothing to exclude them, are defaulted. They count as in, show under Defaulted and never inside Chosen, and are listed in Given the default.',
      world: withDefaults(sampleMenu(TODAY.allClosed)),
    }),
  defaultExcluded: () =>
    start({
      name: 'Never given the default, listed first (sc-1362)',
      note: 'Main course and Dessert both have defaults: Who hasn’t picked opens with the people never given one, each once, with the reason on each course.',
      world: withDefaults(sampleMenu(TODAY.allClosed), true),
    }),
  defaultReadOnly: () =>
    start({
      name: 'A default, Guests read only (sc-1362)',
      note: 'Given the default lists names without Choose for them. Without Guests read it is hidden, as Who hasn’t picked is.',
      world: withDefaults(sampleMenu(TODAY.allClosed), true),
      access: 'read',
    }),
  defaultCountsOnly: () =>
    start({
      name: 'A default, counts only (sc-1362)',
      note: 'Defaulted and Chosen stay as counts; no names, no Who hasn’t picked and no Given the default.',
      world: withDefaults(sampleMenu(TODAY.allClosed), true),
      access: 'counts',
    }),
  chooseForDefaulted: () =>
    start({
      name: 'Choose for a defaulted person (sc-1362)',
      note: 'Kofi Mensah, from Given the default: Main course opens at its default, Jollof rice, Chicken, then Dessert at Zobo sorbet.',
      world: withDefaults(sampleMenu(TODAY.allClosed), true),
      opened: { personId: 'kofi-mensah', given: true },
    }),
  chooseForDefaultedSaved: () =>
    start({
      name: 'Choose for a defaulted person, saving (sc-1362)',
      note: 'Suya wrap, Beef, saved for Kofi on Main course: he moves from Defaulted to Chosen and off Given the default for that course. Saving the default itself does the same.',
      world: withDefaults(sampleMenu(TODAY.allClosed)),
      opened: {
        personId: 'kofi-mensah',
        given: true,
        draft: { kind: 'dish', dishId: 'k2-wrap', variantId: 'v-beef', sideId: null },
        press: true,
      },
    }),
  chooseForChildren: () =>
    start({
      name: 'Choose for them, a Children only variant',
      note: 'Bea Mensah on Main course: Jollof rice offers its Children’s portion, which guests never see, marked Children only.',
      opened: {
        personId: 'bea-mensah',
        courseId: 'k2',
        draft: { kind: 'dish', dishId: 'k2-jollof', variantId: null, sideId: null },
      },
    }),
  chooseWho: () =>
    start({
      name: 'Choose who gets it, on a course guests choose',
      note: 'Jollof rice, Children’s portion: Tobi and Ife ticked. A sheet on a phone, a dialog on tablet portrait, a docked panel on tablet landscape.',
      who: KIDS_MAIN,
    }),
  chooseWhoStarter: () =>
    start({
      name: 'Choose who gets it, on a course that asks nothing',
      note: 'A set starter of Catfish pepper soup: Children’s portion, Tobi, Ife and Sasha ticked. Kwame, Kojo and Elena carry the Allergy mark.',
      world: setStarter(sampleMenu()),
      who: KIDS_STARTER,
    }),
  chooseWhoUntick: () =>
    start({
      name: 'Choose who gets it, unticking',
      note: 'Sasha unticked on the set starter: “Goes back to Full bowl.” On Main course, a course guests choose, the line says not chosen.',
      world: setStarter(sampleMenu()),
      who: { ...KIDS_STARTER, toggle: ['sasha-petrova'] },
    }),
  chooseWhoOverride: () =>
    start({
      name: 'Choose who gets it, the override question',
      note: 'Kojo ticked for Children’s portion, which contains celery. Leave them out has the focus.',
      who: { ...KIDS_MAIN, toggle: ['kojo-asante'], press: true },
    }),
  chooseWhoSaved: () =>
    start({
      name: 'Choose who gets it, saved',
      note: 'Kojo given Children’s portion anyway, recorded as the host’s pick; the figures move.',
      who: { ...KIDS_MAIN, toggle: ['kojo-asante'], press: true, confirm: true },
    }),
  chooseWhoRefused: () =>
    start({
      name: 'Choose who gets it, refused (403)',
      note: 'The role lost Guests manage while it was open. Nothing was saved.',
      who: { ...KIDS_MAIN, toggle: ['ife-adeyemi'], press: true, refuses: true },
    }),
} satisfies Record<string, () => MenuStart>;

export type MenuStateName = keyof typeof STATES;

export const MENU_STATES = Object.keys(STATES) as MenuStateName[];

export const isMenuState = (raw: string | undefined): raw is MenuStateName =>
  raw != null && Object.hasOwn(STATES, raw);

export const menuStateOf = (raw: string | undefined): MenuStateName =>
  isMenuState(raw) ? raw : 'populated';

export const menuStart = (name: MenuStateName): MenuStart => STATES[name]();

export function firstSuitable(course: Course, person: Person): Pick | null {
  for (const found of course.dishes) {
    const ways = found.variants.length === 0 ? [null] : forEveryone(found).map((one) => one.id);
    const way = ways.find((id) => ruledOut(person, containsOf(found, id)).length === 0);
    if (way !== undefined) return dishPick(found.id, way, found.sides[0]?.id ?? null);
  }

  return null;
}

export function guestSends(world: MenuWorld): { world: MenuWorld; name: string } | null {
  const next = whoHasnt(world)[0]?.people[0];
  if (next == null) return null;
  const sent = next.courses.reduce((now, course) => {
    const pick = firstSuitable(course, next.person);
    return pick == null ? now : choose(now, course.id, next.person.id, pick);
  }, world);

  return { world: sent, name: next.person.name };
}

export const hasChanged = (world: MenuWorld): boolean =>
  world.courses.some((course) => courseFigures(world, course).changed > 0);

export const CONFIRMED_AT = '19:45';

export interface Settled {
  world: MenuWorld | null;
  said: string[];
  opened: Opened | null;
  who: WhoOpened | null;
}

export function settle(begin: MenuStart): Settled {
  const { world, opened, who } = begin;
  const none = { world, said: [], opened, who };
  if (world == null) return none;

  if (who?.press === true && who.confirm === true) {
    const out = whoOutcome(world, who, tickedOf(world, who), true, CONFIRMED_AT);
    if (out.kind !== 'saved') return none;
    return {
      world: out.next,
      said: [out.line, ...(out.overridden == null ? [] : [out.overridden])],
      opened: null,
      who: null,
    };
  }

  const person = opened == null ? undefined : personOf(world, opened.personId);
  if (opened?.press !== true || opened.refuses === true || opened.draft == null || person == null)
    return none;
  const course = chooseCourses(world, person, opened.courseId, opened.given)[0];
  if (course == null || checkDraft(course, person, opened.draft).kind !== 'ok') return none;

  return {
    world: choose(world, course.id, person.id, draftPick(opened.draft, false, CONFIRMED_AT)),
    said: [MW.savedFor(course.name, person.name, draftWords(course, opened.draft))],
    opened: null,
    who: null,
  };
}
