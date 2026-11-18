import type { Allergen } from './guestKitchenWords.ts';
import { type Choice, type ChoiceOption, hasChoices } from './dishChoices.ts';
import { type Variant, hasVariants, isForEveryone, variantsOf } from './dishVariants.ts';
import { type EvCourse, type EvDish, coursesAt, picksCourses } from './menuCourses.ts';
import { type Contains, type DishAllergen, DISH_ALLERGENS } from './menuLibrary.ts';
import { MENU_EVENT } from './menuServed.ts';
import type { DemoLink } from './settings.ts';

/** sc-3909's See picks (board SeePicks, drawn into page 32's Menu): every person coming in exactly one state per course, the figures adding up to the room, and the host choosing for a guest. */
export type Access = 'manage' | 'read' | 'counts';

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

export interface Override {
  by: string;
  at: string;
}

export type How = 'guest' | 'defaulted' | 'host';

export interface DishPick {
  kind: 'dish';
  dishId: string;
  variantId: string | null;
  optionIds: readonly string[];
  how: How;
  override?: Override;
}

/** What is stored for a person on a course; nothing stored is not chosen. `changed` is sc-3913's Menu changed. */
export type Pick = DishPick | { kind: 'kitchen' } | { kind: 'skipped' } | { kind: 'changed' };

export interface PicksWorld {
  courses: readonly EvCourse[];
  people: readonly Person[];
  parties: readonly Party[];
  picks: Readonly<Record<string, Readonly<Record<string, Pick>>>>;
  held: number;
}

export type HostReason =
  { kind: 'nothing' } | { kind: 'allergy'; dish: string; allergens: readonly DishAllergen[] };

export type Spot =
  | {
      kind: 'dish';
      dishId: string;
      variantId: string | null;
      optionIds: readonly string[];
      defaulted: boolean;
    }
  | { kind: 'kitchen' }
  | { kind: 'skipped' }
  | { kind: 'changed' }
  | { kind: 'none' }
  | { kind: 'host'; reason: HostReason };

export const HOST = 'Kemi Adebayo';
export const UPDATED_AT = '19:42';

export const SW = {
  title: 'See picks',
  crumb: 'Picks',
  header: (answered: string, room: string, percent: string) =>
    `${answered} of ${room} picks in · ${percent}% of the room`,
  live: (at: string) => `Updated at ${at} · counts change as guests send their picks`,
  refreshing: 'Refreshing…',
  stale: (at: string) => `Not updated since ${at}. Counts may be behind. Trying again.`,
  loading: 'Loading the picks…',
  held: (n: number, room: string) =>
    `${n} places not yet named · held for guests who haven’t named their companions. They can’t pick, so they are counted apart and are not in the room of ${room}.`,
  emptyTitle: 'Nobody is coming yet',
  emptyBody: 'Picks show here once guests say they are coming.',
  toGuests: 'Go to Guests',
  allIn: 'Everyone coming has a pick for every course.',
  menuChanged:
    'Menu changed: the dish these guests picked was taken off. They are asked again (sc-3913), and are not counted as in.',
  needsHost: 'Needs the host',
  needsHostBody: 'Nothing is decided for these people on these courses until you step in.',
  nothingFor: (course: string) => `${course}: nothing on this course can be picked for them.`,
  allergyFor: (course: string, dish: string, allergens: string) =>
    `${course}: their pick, ${dish}, contains ${allergens}, recorded after they picked it.`,
  hostCount: (course: string, n: number) => `${course} · ${people(n)}`,
  answered: (n: string, room: string) => `${n} of ${room} answered`,
  dish: 'Dish',
  chosen: 'Chosen',
  defaulted: 'Defaulted',
  everyoneElse: 'Everyone else',
  people: 'People',
  variant: 'Variant ·',
  side: 'Option ·',
  kitchen: 'Kitchen’s choice',
  skipped: 'Skipped',
  hostState: 'Needs the host',
  none: 'Not chosen',
  changed: 'Menu changed',
  theRoom: 'The room',
  noSkip: 'This course can’t be skipped.',
  perPick: 'Options are counted per pick, so they add up to the dish, not to the room.',
  asksNothing: (dish: string) =>
    `Guests are asked nothing on this course. Everyone coming gets ${dish}, except the people you give a children’s variant and anyone it rules out, who wait under Needs the host.`,
  chooseWho: 'Choose who gets it',
  chooseWhoAria: (variant: string, dish: string) => `Choose who gets ${variant}, ${dish}`,
  whoHasnt: 'Who hasn’t picked',
  whoHasntNone: 'Everyone coming has picked every course, or is with the host above.',
  replied: (name: string, n: number) => `Replied by ${name} · ${people(n)}`,
  notChosenOn: (courses: string) => `Not chosen: ${courses}`,
  chooseFor: 'Choose for them',
  chooseForAria: (name: string) => `Choose for ${name}`,
  needsManage: 'Choosing for a guest needs Guests manage.',
  needsRead: 'Names need Guests read. These are counts only.',
  backToMenu: 'Back to the menu',
  choosing: (name: string) => `Choosing for ${name}`,
  courseOf: (course: string, at: number, all: number) => `${course} · ${at} of ${all}`,
  kitchenChoose: 'Let the kitchen choose',
  whichWay: (dish: string) => `How should ${dish} come?`,
  allergyMark: 'Allergy',
  ruledOut: (allergens: string, first: string) =>
    `Contains ${allergens}, which ${first} is allergic to. You can still pick it.`,
  ruledOutWho: (allergens: string, first: string) =>
    `Contains ${allergens}, which ${first} is allergic to.`,
  blank: (course: string, first: string) =>
    `Choose ${course.toLocaleLowerCase('en')} for ${first}, or let the kitchen choose.`,
  blankWay: (dish: string, first: string) => `Choose how ${first} has the ${dish}.`,
  blankOption: (question: string, first: string) => `Answer “${question}” for ${first}.`,
  save: 'Save',
  saveNext: 'Save and go on',
  cancel: 'Cancel',
  close: 'Close',
  overrideTitle: (first: string, allergens: string) =>
    `${first}’s record says ${allergens}. Pick it anyway?`,
  overrideBody: (dish: string, allergens: string, first: string) =>
    `${dish} contains ${allergens}. If ${first}’s record is out of date, the pick is saved with your name and the time you confirmed it.`,
  chooseAnother: 'Choose another dish',
  pickAnyway: 'Pick it anyway',
  overrideWhoTitle: (names: string, variant: string) => `${names}: give ${variant} anyway?`,
  overrideWhoBody: (lines: string) =>
    `${lines} If a record is out of date, it is saved with your name and the time you confirmed it.`,
  leaveOut: 'Leave them out',
  giveAnyway: 'Give it anyway',
  refused:
    'You can’t choose for guests on this event any more: your role no longer has Guests manage. Nothing was saved.',
  savedFor: (course: string, first: string, what: string) =>
    `${course} chosen for ${first}: ${what}.`,
  savedOverride: (first: string, dish: string, allergens: string) =>
    `Recorded as your pick for ${first}, despite the record: ${dish} contains ${allergens}.`,
  whoTitle: (variant: string) => `Choose who gets ${variant}`,
  whoSub: (dish: string, course: string) => `${dish} · ${course}`,
  whoHelp:
    'Everyone coming, by who replied. Ticked people have it now. Guests are never offered it on their own page.',
  goesBack: (to: string) => `Goes back to ${to}.`,
  goesBackNone: 'Goes back to not chosen.',
  whoSaved: (variant: string, dish: string, n: number) => `${variant}, ${dish}: ${people(n)} now.`,
  whoOverride: (names: string) => `${names} recorded as your pick despite the record.`,
  demoOnly: 'Demo only',
  demoSends: (name: string) => `${name} sends their picks`,
  demoAllergy: (name: string, allergen: string, on: boolean) =>
    on ? `Remove ${name}’s ${allergen} allergy` : `Save ${allergen} as ${name}’s allergy`,
  demoNobody: 'Nobody left to send',
  summaryTitle: 'Picks',
  closes: 'Picks close Monday, Oct 19.',
  menuPicks: (count: number, n: string, share: string) =>
    `${n} ${count === 1 ? 'pick' : 'picks'} · ${share}% of the room`,
} as const;

function people(n: number): string {
  return n === 1 ? '1 person' : `${n} people`;
}

export const numberIn = (n: number, locale = 'en'): string => n.toLocaleString(locale);

/** Rounds down, so 100% shows only when everyone is in. */
export const percentOf = (n: number, room: number): number =>
  room === 0 ? 0 : Math.floor((n * 100) / room);

const first = (name: string): string => name.split(' ')[0] ?? name;
export const firstName = first;

export const shownCourses = (world: PicksWorld): readonly EvCourse[] =>
  world.courses.filter((course) => course.dishes.length > 0);

/** sc-3907's course that asks guests nothing: one dish, set, with no choice and at most one variant for Everyone. */
export function asksNothing(course: EvCourse): boolean {
  if (course.answer !== 'same' || course.dishes.length !== 1) return false;
  const dish = course.dishes[0] as EvDish;

  return !hasChoices(dish) && variantsOf(dish).filter(isForEveryone).length <= 1;
}

export const everyoneVariant = (dish: EvDish): Variant | null =>
  variantsOf(dish).find(isForEveryone) ?? null;

export const codesOf = (contains: Contains): readonly DishAllergen[] =>
  contains == null || contains === 'none' ? [] : contains;
const codes = codesOf;

function optionsOf(dish: EvDish): readonly ChoiceOption[] {
  return (dish.choices ?? []).flatMap((choice: Choice) => choice.options);
}

export function containsOf(
  dish: EvDish,
  variantId: string | null,
  optionIds: readonly string[],
): DishAllergen[] {
  const variant = variantsOf(dish).find((one) => one.id === variantId);
  const own = hasVariants(dish) ? codes(variant?.contains ?? null) : codes(dish.contains);
  const options = optionsOf(dish)
    .filter((one) => optionIds.includes(one.id))
    .flatMap((one) => codes(one.contains));

  return DISH_ALLERGENS.filter((code) => own.includes(code) || options.includes(code));
}

export function ruledOut(person: Person, contains: readonly DishAllergen[]): DishAllergen[] {
  return contains.filter((code) => person.allergies.includes(code as Allergen));
}

/** Nothing a guest may pick themselves is safe for this person: every dish, or every Everyone variant of it, contains one of their allergies. */
export function nothingFor(course: EvCourse, person: Person): boolean {
  return course.dishes.every((dish) =>
    hasVariants(dish)
      ? variantsOf(dish)
          .filter(isForEveryone)
          .every((variant) => ruledOut(person, codes(variant.contains)).length > 0)
      : ruledOut(person, codes(dish.contains)).length > 0,
  );
}

export const pickOf = (world: PicksWorld, courseId: string, personId: string): Pick | undefined =>
  world.picks[courseId]?.[personId];

export function spotOf(world: PicksWorld, course: EvCourse, person: Person): Spot {
  const pick = pickOf(world, course.id, person.id);

  if (asksNothing(course) && pick == null) {
    const dish = course.dishes[0] as EvDish;
    const variantId = everyoneVariant(dish)?.id ?? null;

    return ruledOut(person, containsOf(dish, variantId, [])).length > 0
      ? { kind: 'host', reason: { kind: 'nothing' } }
      : { kind: 'dish', dishId: dish.id, variantId, optionIds: [], defaulted: false };
  }

  if (pick == null)
    return nothingFor(course, person)
      ? { kind: 'host', reason: { kind: 'nothing' } }
      : { kind: 'none' };
  if (pick.kind !== 'dish') return pick;

  const dish = course.dishes.find((one) => one.id === pick.dishId);
  if (dish == null) return { kind: 'changed' };

  const allergens = ruledOut(person, containsOf(dish, pick.variantId, pick.optionIds));
  if (allergens.length > 0 && pick.override == null)
    return { kind: 'host', reason: { kind: 'allergy', dish: pickName(dish, pick), allergens } };

  return {
    kind: 'dish',
    dishId: pick.dishId,
    variantId: pick.variantId,
    optionIds: pick.optionIds,
    defaulted: pick.how === 'defaulted',
  };
}

export function pickName(dish: EvDish, pick: Pick | Spot): string {
  if (pick.kind !== 'dish') return dish.name;
  const variant = variantsOf(dish).find((one) => one.id === pick.variantId);
  const options = optionsOf(dish)
    .filter((one) => pick.optionIds.includes(one.id))
    .map((one) => one.name);

  return [dish.name, variant?.name, ...options].filter(Boolean).join(', ');
}

export interface Row {
  id: string;
  kind: 'dish' | 'variant' | 'option';
  name: string;
  chosen: number;
  defaulted: number;
  dishId: string;
  variant: Variant | null;
}

export interface CourseFigures {
  course: EvCourse;
  asksNothing: boolean;
  rows: Row[];
  kitchen: number;
  skipped: number;
  host: number;
  none: number;
  changed: number;
  room: number;
  answered: number;
}

export function courseFigures(world: PicksWorld, course: EvCourse): CourseFigures {
  const spots = world.people.map((person) => spotOf(world, course, person));
  const count = (test: (spot: Spot) => boolean) => spots.filter(test).length;
  const onDish = (
    dishId: string,
    defaulted: boolean,
    test: (spot: Spot & { kind: 'dish' }) => boolean,
  ) =>
    count(
      (spot) =>
        spot.kind === 'dish' &&
        spot.dishId === dishId &&
        spot.defaulted === defaulted &&
        test(spot),
    );

  const rows = course.dishes.flatMap((dish): Row[] => [
    {
      id: dish.id,
      kind: 'dish',
      name: dish.name,
      chosen: onDish(dish.id, false, () => true),
      defaulted: onDish(dish.id, true, () => true),
      dishId: dish.id,
      variant: null,
    },
    ...variantsOf(dish).map((variant) => ({
      id: variant.id,
      kind: 'variant' as const,
      name: variant.name,
      chosen: onDish(dish.id, false, (spot) => spot.variantId === variant.id),
      defaulted: onDish(dish.id, true, (spot) => spot.variantId === variant.id),
      dishId: dish.id,
      variant,
    })),
    ...optionsOf(dish).map((option) => ({
      id: option.id,
      kind: 'option' as const,
      name: option.name,
      chosen: onDish(dish.id, false, (spot) => spot.optionIds.includes(option.id)),
      defaulted: onDish(dish.id, true, (spot) => spot.optionIds.includes(option.id)),
      dishId: dish.id,
      variant: null,
    })),
  ]);
  const host = count((spot) => spot.kind === 'host');
  const none = count((spot) => spot.kind === 'none');

  return {
    course,
    asksNothing: asksNothing(course),
    rows,
    kitchen: count((spot) => spot.kind === 'kitchen'),
    skipped: count((spot) => spot.kind === 'skipped'),
    host,
    none,
    changed: count((spot) => spot.kind === 'changed'),
    room: world.people.length,
    answered: world.people.length - host - none - count((spot) => spot.kind === 'changed'),
  };
}

/** Dish rows and the states, which always come to the room. Variant and option rows sit inside their dish. */
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

const isIn = (spot: Spot): boolean =>
  spot.kind === 'dish' || spot.kind === 'kitchen' || spot.kind === 'skipped';

/** Picks in counts the people who have answered every course guests choose; a course that asks nothing is not one. */
export function header(world: PicksWorld): { answered: number; room: number; percent: number } {
  const asked = shownCourses(world).filter((course) => !asksNothing(course));
  const answered = world.people.filter((person) =>
    asked.every((course) => isIn(spotOf(world, course, person))),
  ).length;

  return { answered, room: world.people.length, percent: percentOf(answered, world.people.length) };
}

export interface HostLine {
  person: Person;
  course: EvCourse;
  reason: HostReason;
}

export function needsHost(world: PicksWorld): HostLine[] {
  return world.people.flatMap((person) =>
    shownCourses(world).flatMap((course) => {
      const spot = spotOf(world, course, person);

      return spot.kind === 'host' ? [{ person, course, reason: spot.reason }] : [];
    }),
  );
}

export interface Waiting {
  party: Party;
  people: { person: Person; courses: readonly EvCourse[] }[];
}

export function whoHasnt(world: PicksWorld): Waiting[] {
  return world.parties.flatMap((party) => {
    const open = world.people
      .filter((person) => person.party === party.id)
      .map((person) => ({
        person,
        courses: shownCourses(world).filter(
          (course) => spotOf(world, course, person).kind === 'none',
        ),
      }))
      .filter((one) => one.courses.length > 0);

    return open.length === 0 ? [] : [{ party, people: open }];
  });
}

export function openFor(world: PicksWorld, person: Person, courseId?: string): EvCourse[] {
  return shownCourses(world).filter((course) => {
    const kind = spotOf(world, course, person).kind;

    return courseId == null
      ? kind === 'none'
      : course.id === courseId && (kind === 'none' || kind === 'host');
  });
}

export function partyOf(world: PicksWorld, person: Person): Party | undefined {
  return world.parties.find((one) => one.id === person.party);
}

function withPick(world: PicksWorld, courseId: string, personId: string, pick: Pick | null) {
  const course = { ...world.picks[courseId] };
  if (pick == null) delete course[personId];
  else course[personId] = pick;

  return { ...world, picks: { ...world.picks, [courseId]: course } };
}

export function chooseFor(
  world: PicksWorld,
  courseId: string,
  personId: string,
  pick: Pick,
): PicksWorld {
  return withPick(world, courseId, personId, pick);
}

export function hasVariant(
  world: PicksWorld,
  course: EvCourse,
  person: Person,
  variantId: string,
): boolean {
  const spot = spotOf(world, course, person);
  const pick = pickOf(world, course.id, person.id);

  return (
    pick?.kind === 'dish' &&
    pick.variantId === variantId &&
    (spot.kind === 'dish' || spot.kind === 'host')
  );
}

/** Where a person unticked from a Children only variant goes: the Everyone variant on a course that asks nothing, or Needs the host if it rules them out; not chosen on any other. */
export function goesBackTo(course: EvCourse, person: Person): string | null {
  if (!asksNothing(course)) return null;
  const dish = course.dishes[0] as EvDish;
  const everyone = everyoneVariant(dish);
  if (ruledOut(person, containsOf(dish, everyone?.id ?? null, [])).length > 0) return SW.needsHost;

  return everyone?.name ?? dish.name;
}

export function giveVariant(
  world: PicksWorld,
  course: EvCourse,
  dishId: string,
  variantId: string,
  ticked: ReadonlySet<string>,
  confirmed: Override | null,
): PicksWorld {
  const dish = course.dishes.find((one) => one.id === dishId);
  const contains = dish == null ? [] : containsOf(dish, variantId, []);

  return world.people.reduce((next, person) => {
    const had = hasVariant(world, course, person, variantId);
    const overridden = confirmed != null && ruledOut(person, contains).length > 0;
    if (ticked.has(person.id) && !had)
      return withPick(next, course.id, person.id, {
        kind: 'dish',
        dishId,
        variantId,
        optionIds: [],
        how: 'host',
        ...(overridden ? { override: confirmed } : {}),
      });
    if (!ticked.has(person.id) && had) return withPick(next, course.id, person.id, null);

    return next;
  }, world);
}

export function menuFigures(world: PicksWorld): Map<string, { count: number; share: number }> {
  const out = new Map<string, { count: number; share: number }>();
  for (const course of shownCourses(world))
    for (const row of courseFigures(world, course).rows) {
      if (row.kind === 'option') continue;
      const count = row.chosen + row.defaulted;
      out.set(row.id, { count, share: percentOf(count, world.people.length) });
    }

  return out;
}

type Code = string;
type Row48 = readonly [
  name: string,
  allergies: readonly Allergen[],
  main: Code,
  dessert: Code,
  starter?: 'kids',
];

const PARTIES: readonly (readonly Row48[])[] = [
  [
    ['Bea Mensah', [], '-', '-'],
    ['Kofi Mensah', [], '-', '-'],
    ['Ama Mensah', [], 'jc', '-'],
  ],
  [
    ['Kwame Asante', ['celery', 'peanuts'], '-', 'cc'],
    ['Efua Asante', [], 'jc', 'cc'],
    ['Kojo Asante', ['celery'], '-', 'z'],
  ],
  [
    ['Ada Obi', ['milk'], 'jc', 'cc'],
    ['Chidi Obi', [], 'jc', 'cc'],
    ['Ngozi Obi', [], 'sb', 'z'],
  ],
  [
    ['Segun Bello', [], 'sb', 'cc'],
    ['Funmi Bello', [], 'jc', 'x'],
    ['Tobi Bello', [], 'jk', 'cc', 'kids'],
  ],
  [
    ['Rosa Lima', [], 'cfp', 'z'],
    ['Pedro Lima', [], 'sb', 'cc'],
    ['Inês Lima', [], 'ccp', 'z'],
  ],
  [
    ['Hana Sato', [], 'cfs', 'z'],
    ['Ken Sato', [], 'sb', 'x'],
    ['Yui Sato', [], 'ccm', 'cc'],
  ],
  [
    ['Leila Haddad', ['sesame'], 'jc', 'z'],
    ['Omar Haddad', [], 'sc', 'cc'],
    ['Nour Haddad', [], 'ccp', 'z'],
  ],
  [
    ['Mateo Ruiz', [], 'sb', 'cc'],
    ['Lucía Ruiz', [], 'jc', 'cc'],
    ['Pablo Ruiz', [], 'sc', 'x'],
  ],
  [
    ['Claire Martin', [], 'cfp', 'z'],
    ['Louis Martin', [], 'jc', 'cc'],
    ['Jeanne Martin', [], 'ccm', 'z'],
  ],
  [
    ['Femi Adeyemi', [], 'sb', 'cc'],
    ['Bisi Adeyemi', [], 'jc', 'x'],
    ['Ife Adeyemi', [], 'jk', 'cc', 'kids'],
  ],
  [
    ['Sanjay Rao', ['gluten'], 'cfp', 'z'],
    ['Priya Rao', [], 'ccp', 'z'],
    ['Arjun Rao', [], 'sc', 'cc'],
  ],
  [
    ['Zara Khan', [], 'jc', 'cc'],
    ['Imran Khan', [], 'sb', 'x'],
    ['Aisha Khan', [], 'ccm', 'z'],
  ],
  [
    ['Uche Eze', [], 'jc', 'cc'],
    ['Chioma Eze', [], 'cfs', 'z'],
    ['Obinna Eze', [], 'jc', 'x'],
  ],
  [
    ['Elena Rossi', ['fish'], 'cfs', 'cc'],
    ['Marco Rossi', [], 'jc', 'cc'],
    ['Giulia Rossi', [], 'ccm', 'z'],
  ],
  [
    ['Yusuf Ali', [], 'jc', 'cc'],
    ['Mariam Ali', [], 'k', 'k'],
    ['Hamza Ali', [], 'k', 'k'],
  ],
  [
    ['Nadia Petrova', [], '-', '-'],
    ['Ivan Petrov', [], '-', 'cc'],
    ['Sasha Petrova', [], 'jp', 'z', 'kids'],
  ],
];

const dishPick = (
  dishId: string,
  variantId: string | null,
  optionIds: readonly string[] = [],
  how: How = 'guest',
): DishPick => ({ kind: 'dish', dishId, variantId, optionIds, how });

const MAIN: Record<Code, Pick | null> = {
  '-': null,
  jc: dishPick('k2-jollof', 'v-chicken'),
  jk: dishPick('k2-jollof', 'v-kids', [], 'host'),
  jp: dishPick('k2-jollof', 'v-plain', [], 'host'),
  cfp: dishPick('k2-coconut', 'v-fish', ['c-side-plantain']),
  cfs: dishPick('k2-coconut', 'v-fish', ['c-side-salad']),
  ccp: dishPick('k2-coconut', 'v-chicken2', ['c-side-plantain']),
  ccm: dishPick('k2-coconut', 'v-chicken2', ['c-side-moimoi']),
  sb: dishPick('ev-wrap', 'v-beef'),
  sc: dishPick('ev-wrap', 'v-chicken3'),
  k: { kind: 'kitchen' },
};

const DESSERT: Record<Code, Pick | null> = {
  '-': null,
  cc: dishPick('k3-chinchin', null),
  z: dishPick('k3-zobo', null),
  x: { kind: 'skipped' },
  k: { kind: 'kitchen' },
};

const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[^A-Za-z ]/g, '')
    .toLowerCase()
    .replace(/ /g, '-');

export function samplePicks(): PicksWorld {
  const parties: Party[] = [];
  const people: Person[] = [];
  const picks: Record<string, Record<string, Pick>> = { k1: {}, k2: {}, k3: {} };

  for (const party of PARTIES) {
    const id = `p-${slug((party[0] as Row48)[0])}`;
    parties.push({ id, replier: (party[0] as Row48)[0] });
    for (const [name, allergies, main, dessert, starter] of party) {
      const personId = slug(name);
      people.push({ id: personId, name, party: id, allergies });
      const mainPick = MAIN[main] ?? null;
      const dessertPick = DESSERT[dessert] ?? null;
      if (mainPick != null) (picks.k2 as Record<string, Pick>)[personId] = mainPick;
      if (dessertPick != null) (picks.k3 as Record<string, Pick>)[personId] = dessertPick;
      if (starter === 'kids')
        (picks.k1 as Record<string, Pick>)[personId] = dishPick('k1-pepper', 'v-small', [], 'host');
    }
  }

  return { courses: picksCourses(), people, parties, picks, held: 0 };
}

function allInPicks(): PicksWorld {
  const world = samplePicks();
  const at = '18 Oct, 17:05';
  let next = world;
  for (const person of world.people)
    for (const course of shownCourses(world)) {
      const spot = spotOf(world, course, person);
      if (spot.kind === 'none')
        next = chooseFor(
          next,
          course.id,
          person.id,
          course.id === 'k3'
            ? dishPick('k3-zobo', null, [], 'defaulted')
            : person.allergies.includes('celery')
              ? dishPick('ev-wrap', 'v-beef', [], 'defaulted')
              : dishPick('k2-jollof', 'v-chicken', [], 'defaulted'),
        );
    }
  next = chooseFor(next, 'k2', 'kwame-asante', dishPick('k2-jollof', 'v-plain', [], 'host'));
  next = chooseFor(
    next,
    'k2',
    'elena-rossi',
    dishPick('k2-coconut', 'v-chicken2', ['c-side-plantain'], 'host'),
  );
  for (const id of ['kwame-asante', 'kojo-asante', 'elena-rossi'])
    next = chooseFor(next, 'k1', id, { kind: 'kitchen' });
  next = chooseFor(next, 'k3', 'ada-obi', {
    ...dishPick('k3-zobo', null, [], 'host'),
    override: { by: HOST, at },
  });

  return next;
}

function changedPicks(): PicksWorld {
  const world = samplePicks();

  return ['lucia-ruiz', 'louis-martin', 'femi-adeyemi'].reduce(
    (next, id) => chooseFor(next, 'k3', id, { kind: 'changed' }),
    world,
  );
}

export type System = 'loading' | 'refreshing' | 'stale';

export type Opened =
  | {
      kind: 'chooseFor';
      personId: string;
      courseId?: string;
      dishId?: string;
      variantId?: string;
      optionIds?: readonly string[];
      press?: boolean;
      confirm?: boolean;
      refuses?: boolean;
    }
  | {
      kind: 'chooseWho';
      courseId: string;
      dishId: string;
      variantId: string;
      toggle?: readonly string[];
      press?: boolean;
      confirm?: boolean;
      refuses?: boolean;
    };

export interface PicksStart {
  name: string;
  note: string;
  world: PicksWorld;
  access: Access;
  system: System | null;
  opened: Opened | null;
  demo: boolean;
}

function start(o: Partial<PicksStart> & { name: string; note: string }): PicksStart {
  return { world: samplePicks(), access: 'manage', system: null, opened: null, demo: false, ...o };
}

const KOJO_KIDS: Opened = {
  kind: 'chooseWho',
  courseId: 'k2',
  dishId: 'k2-jollof',
  variantId: 'v-kids',
};

const STATES = {
  picks: () =>
    start({
      name: 'See picks, populated, with Guests manage',
      note: 'The room of 48: the starter asks guests nothing, and Kwame, Kojo and Elena, whose allergies rule it out, wait under Needs the host; Main and Dessert are chosen. Needs the host first, then each course, then Who hasn’t picked.',
      demo: true,
    }),
  picksReadOnly: () =>
    start({
      name: 'Guests read only',
      note: 'Names, and no Choose for them or Choose who gets it.',
      access: 'read',
    }),
  picksCountsOnly: () =>
    start({
      name: 'Counts only, without Guests read',
      note: 'Needs the host as counts per course, and no Who hasn’t picked.',
      access: 'counts',
    }),
  picksLoading: () => start({ name: 'Loading', note: 'The skeleton.', system: 'loading' }),
  picksRefreshing: () =>
    start({ name: 'Refreshing', note: 'Refreshing… in the header.', system: 'refreshing' }),
  picksStale: () =>
    start({ name: 'Stale', note: 'The last figures stay on screen.', system: 'stale' }),
  picksEmpty: () =>
    start({
      name: 'Empty: nobody coming yet',
      note: 'A next step to Guests.',
      world: { ...samplePicks(), people: [], parties: [], picks: {} },
    }),
  picksAllIn: () =>
    start({
      name: 'All in, after the close',
      note: 'Not chosen defaulted (sc-1362), the host settled Kwame, Elena and Ada, and let the kitchen choose the starter for Kwame, Kojo and Elena.',
      world: allInPicks(),
    }),
  picksHeld: () =>
    start({
      name: 'Held places',
      note: '6 places not yet named, counted apart from the room.',
      world: { ...samplePicks(), held: 6 },
    }),
  picksMenuChanged: () =>
    start({
      name: 'Menu changed (sc-3913)',
      note: 'Three Dessert picks whose dish came off, counted as Menu changed and not in.',
      world: changedPicks(),
    }),
  chooseFor: () =>
    start({
      name: 'Choose for them, open',
      note: 'Bea Mensah, Main course first, then Dessert.',
      opened: { kind: 'chooseFor', personId: 'bea-mensah' },
    }),
  chooseForBlank: () =>
    start({
      name: 'Choose for them, Save with nothing picked',
      note: 'Refused in place, nothing sent.',
      opened: { kind: 'chooseFor', personId: 'bea-mensah', press: true },
    }),
  chooseForChildren: () =>
    start({
      name: 'Choose for them, a Children only variant',
      note: 'Kojo Asante: Jollof rice offers its children’s variants, which guests never see.',
      opened: {
        kind: 'chooseFor',
        personId: 'kojo-asante',
        courseId: 'k2',
        dishId: 'k2-jollof',
        variantId: 'v-plain',
      },
    }),
  chooseForRuledOut: () =>
    start({
      name: 'Choose for them, every dish ruled out',
      note: 'Kwame Asante, from his Needs the host row on Main: each dish keeps its Allergy mark and can still be picked.',
      opened: { kind: 'chooseFor', personId: 'kwame-asante', courseId: 'k2' },
    }),
  chooseForStarter: () =>
    start({
      name: 'Choose for them, on a course that asks nothing',
      note: 'Elena Rossi, from Needs the host on the starter: Full bowl and Children’s portion carry the Allergy mark; Let the kitchen choose does not.',
      opened: { kind: 'chooseFor', personId: 'elena-rossi', courseId: 'k1' },
    }),
  chooseForOverride: () =>
    start({
      name: 'The override question',
      note: 'Kwame picked Jollof rice, Chicken, which contains celery.',
      opened: {
        kind: 'chooseFor',
        personId: 'kwame-asante',
        courseId: 'k2',
        dishId: 'k2-jollof',
        variantId: 'v-chicken',
        press: true,
      },
    }),
  chooseForOverridden: () =>
    start({
      name: 'Picked anyway, recorded as yours',
      note: 'The green line after Pick it anyway.',
      opened: {
        kind: 'chooseFor',
        personId: 'kwame-asante',
        courseId: 'k2',
        dishId: 'k2-jollof',
        variantId: 'v-chicken',
        press: true,
        confirm: true,
      },
    }),
  chooseForRefused: () =>
    start({
      name: 'Choose for them, refused (403)',
      note: 'The role lost Guests manage while the dialog was open.',
      opened: {
        kind: 'chooseFor',
        personId: 'bea-mensah',
        dishId: 'ev-wrap',
        variantId: 'v-beef',
        press: true,
        refuses: true,
      },
    }),
  chooseWho: () =>
    start({
      name: 'Choose who gets it, on a course guests choose',
      note: 'Jollof rice, Children’s portion: Tobi and Ife ticked.',
      opened: KOJO_KIDS,
    }),
  chooseWhoStarter: () =>
    start({
      name: 'Choose who gets it, on a course that asks nothing',
      note: 'Catfish pepper soup, Children’s portion: Tobi, Ife and Sasha ticked.',
      opened: { kind: 'chooseWho', courseId: 'k1', dishId: 'k1-pepper', variantId: 'v-small' },
    }),
  chooseWhoUntick: () =>
    start({
      name: 'Choose who gets it, unticking',
      note: 'Sasha unticked on the starter goes back to Full bowl; Kojo ticked.',
      opened: {
        kind: 'chooseWho',
        courseId: 'k1',
        dishId: 'k1-pepper',
        variantId: 'v-small',
        toggle: ['sasha-petrova', 'kojo-asante'],
      },
    }),
  chooseWhoOverride: () =>
    start({
      name: 'Choose who gets it, the override question',
      note: 'Kojo ticked for Children’s portion, which contains celery.',
      opened: { ...KOJO_KIDS, toggle: ['kojo-asante'], press: true },
    }),
  chooseWhoSaved: () =>
    start({
      name: 'Choose who gets it, saved',
      note: 'Kojo given Children’s portion anyway; the figures move.',
      opened: { ...KOJO_KIDS, toggle: ['kojo-asante'], press: true, confirm: true },
    }),
  chooseWhoRefused: () =>
    start({
      name: 'Choose who gets it, refused (403)',
      note: 'Nothing was saved.',
      opened: { ...KOJO_KIDS, toggle: ['ife-adeyemi'], press: true, refuses: true },
    }),
} satisfies Record<string, () => PicksStart>;

export type PicksStateName = keyof typeof STATES;

export const isPicksState = (raw: string | null): raw is PicksStateName =>
  raw != null && Object.hasOwn(STATES, raw);

export const picksStart = (name: PicksStateName): PicksStart => STATES[name]();

export const picksAt = (state: PicksStateName): string =>
  `/demo/events/${MENU_EVENT}/menu?state=${state}`;

const link = (state: PicksStateName): DemoLink => ({
  to: picksAt(state),
  name: STATES[state]().name,
});

export const PICKS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The picks on the Menu’s rows',
    states: [
      { to: coursesAt('menuPicks'), name: 'The menu with its picks' },
      { to: coursesAt('menuPicksReadOnly'), name: 'The menu with its picks, read only' },
    ],
  },
  {
    name: 'See picks, and who sees what',
    states: (
      [
        'picks',
        'picksReadOnly',
        'picksCountsOnly',
        'picksLoading',
        'picksRefreshing',
        'picksStale',
        'picksEmpty',
        'picksAllIn',
        'picksHeld',
        'picksMenuChanged',
      ] as const
    ).map(link),
  },
  {
    name: 'Choose for them',
    states: (
      [
        'chooseFor',
        'chooseForBlank',
        'chooseForChildren',
        'chooseForRuledOut',
        'chooseForStarter',
        'chooseForOverride',
        'chooseForOverridden',
        'chooseForRefused',
      ] as const
    ).map(link),
  },
  {
    name: 'Choose who gets it, on a Children only variant',
    states: (
      [
        'chooseWho',
        'chooseWhoStarter',
        'chooseWhoUntick',
        'chooseWhoOverride',
        'chooseWhoSaved',
        'chooseWhoRefused',
      ] as const
    ).map(link),
  },
];
