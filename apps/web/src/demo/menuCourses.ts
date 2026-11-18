import type { Allergen } from './guestKitchenWords.ts';
import {
  type Contains,
  type Diet,
  type DishAllergen,
  type DishForm,
  type Lang,
  type LibDish,
  type Price,
  DISH_ALLERGENS,
  SAMPLE_DISHES,
  allergenName,
} from './menuLibrary.ts';
import {
  type Variant,
  type VariantAsk,
  type VariantForm,
  type VariantMode,
  EVENT_CURRENCY,
  VW,
  beefWays,
  childrenFold,
  copiedVariants,
  jollofVariants,
  libraryJollof,
  sixWays,
  twoWays,
  variant,
  variantAllergenLine,
} from './dishVariants.ts';
import {
  type Choice,
  type ChoiceAsk,
  type ChoiceForm,
  type ChoiceMode,
  type OptionForm,
  choiceForm,
  courseHint,
  dishHidden,
  dishPicked,
  draftChoice,
  eightOptions,
  optionalSide,
  sauceChoice,
  sideChoice,
  thirdChoice,
  withSavedChoice,
  choice,
  option,
} from './dishChoices.ts';
import { type CourseDefault, type DefaultForm, type Given, DFW } from './courseDefault.ts';
import { MENU_EVENT, moved } from './menuServed.ts';
import { type Close, type PicksDates, SAMPLE_PICKS, closeOf } from './picksClose.ts';
import type { DemoLink } from './settings.ts';

/** sc-3902's event Menu at a desk and in a narrow web window (board Menu, page e32): courses in order, and the dishes on each. */
export const COURSE_MAX = 10;
export const COURSE_NAME_MAX = 60;

export type Answer = 'choose' | 'same';

/** A person who picked a dish, with the allergies they have recorded (sc-3777); Other is never matched. */
export type Picker = readonly (Allergen | 'other')[];

export interface EvDish {
  id: string;
  name: string;
  desc: string;
  contains: Contains;
  diets: readonly Diet[];
  /** The library dish this is a copy of; null when it was added only for this event. */
  libraryId: string | null;
  pickers: readonly Picker[];
  /** sc-3903: a dish with variants; its picks are on them. */
  variants?: readonly Variant[];
  /** The Cost a fold leaves the dish with, from the variant that stays. */
  cost?: Price | null;
  /** sc-3904: the questions guests answer inside the dish. */
  choices?: readonly Choice[];
}

export interface EvCourse {
  id: string;
  name: string;
  servedAt: string | null;
  answer: Answer;
  skip: boolean;
  dishes: readonly EvDish[];
  /** sc-1362: the default, set with the course's choose-by date in `PicksDates.own`. */
  pick?: CourseDefault | null;
  /** sc-1362: the people given the default once its date passed. */
  given?: readonly Given[];
}

export const CW = {
  title: 'Menu',
  crumb: 'Breadcrumb',
  events: 'Events',
  navigation: 'Navigation',
  closeNavigation: 'Close navigation',
  courses: (n: number) => (n === 1 ? '1 course' : `${n} courses`),
  dishes: (n: number) => (n === 1 ? '1 dish' : `${n} dishes`),
  ready: (ready: number, all: number) => `${ready} of ${all} courses ready`,
  courseOf: (n: number, all: number) => `Course ${n} of ${all}`,
  served: (time: string) => `served ${time}`,
  readyTag: 'Ready',
  emptyTag: 'Empty · not shown to guests',
  emptyCourse: 'No dishes yet. Guests don’t see this course until it has one.',
  addCourse: 'Add course',
  addDish: 'Add dish',
  editCourse: 'Edit course',
  editDish: 'Edit dish',
  newDish: 'New dish',
  fromLibrary: 'From the library',
  dishTabs: 'Where the dish comes from',
  saveChanges: 'Save changes',
  cancel: 'Cancel',
  close: 'Close',
  backToMenu: 'Back to the menu',
  keepIt: 'Keep it',
  removeDish: 'Remove dish',
  deleteCourse: 'Delete course',
  moveUpHint: 'Move up',
  moveDownHint: 'Move down',
  editHint: 'Edit',
  removeHint: 'Remove…',
  deleteHint: 'Delete…',
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  editAria: (name: string) => `Edit ${name}`,
  removeAria: (name: string) => `Remove ${name}…`,
  deleteAria: (name: string) => `Delete ${name}…`,
  dragAria: (name: string) => `Drag ${name} to reorder`,
  actionsFor: (name: string) => `Actions for ${name}`,
  suitableFor: 'Suitable for',
  howAnswer: 'How guests answer',
  choose: 'Guests choose',
  same: 'Everyone gets the same',
  sameNeedsOne: '“Everyone gets the same” needs exactly one dish.',
  skip: 'Guests may skip this course',
  skipOn: (course: string) => `Guests also see “No ${course.toLocaleLowerCase('en')} for me”.`,
  nowChoose: (course: string, n: number) => `${course} has ${n} dishes now, so guests choose.`,
  emptyTitle: 'No menu yet',
  emptyBody: 'Add the courses guests choose from, then the dishes on each.',
  name: 'Name',
  counter: (n: number, max: number) => `${n} of ${max}`,
  suggestions: 'Suggestions',
  suggested: ['Starter', 'Main', 'Dessert'] as const,
  servedAt: 'Served at',
  optional: 'Optional',
  servedHelp: '24-hour, in the event’s time zone (Lagos), like 20:30.',
  goesLast: 'A new course goes last. Move it up or down once it is added.',
  courseBlank: 'Enter the course’s name.',
  courseLong: 'Shorten the name to 60 characters or fewer.',
  timeWrong: 'Enter a 24-hour time, like 20:30.',
  atLimit: 'A menu can have at most 10 courses.',
  courseAdded: (name: string, n: number, all: number) => `${name} added as course ${n} of ${all}.`,
  saved: (name: string) => `${name} saved.`,
  moved: (name: string, n: number, all: number) => `${name} moved to course ${n} of ${all}.`,
  find: 'Find a dish',
  inLibrary: (n: number) => `${n === 1 ? '1 dish' : `${n} dishes`} in the menu library`,
  foundOf: (shown: number, all: number) => `${shown} of ${all === 1 ? '1 dish' : `${all} dishes`}`,
  noMatch: (q: string) => `No dish name has “${q}” in it.`,
  libraryLoading: 'Loading the menu library…',
  libraryEmpty: 'The menu library has no dishes yet.',
  libraryFailed: 'The menu library did not load.',
  libraryFailedBody: 'Check your connection, then try again.',
  startNewBlank: 'Start a new dish',
  startNew: (q: string) => `Start a new dish called “${q}”`,
  add: 'Add',
  addAria: (name: string) => `Add ${name}`,
  onCourse: 'On this course',
  addedTo: (dish: string, course: string) => `${dish} added to ${course}.`,
  addedSaved: (dish: string, course: string) =>
    `${dish} added to ${course}. Also saved to the menu library.`,
  onlyEvent: 'Only for this event',
  alsoLibrary: 'Also saved to the menu library, so other events can use it.',
  notLibrary: 'Not saved to the menu library. It stays on this event only.',
  copyOnly: 'This changes this event’s copy only. The library keeps its own.',
  eventOnly: 'This dish is only on this event’s menu. The menu library has no copy of it.',
  removeAsk: (dish: string, course: string, inLibrary: boolean) =>
    `Remove ${dish} from ${course}? ${
      inLibrary
        ? 'The menu library keeps its own.'
        : 'It is only on this event, so it goes for good.'
    }`,
  removed: (dish: string, course: string) => `${dish} removed from ${course}.`,
  deleteAsk: (course: string, dishes: number) =>
    `Delete ${course}? ${
      dishes === 0
        ? 'It has no dishes.'
        : dishes === 1
          ? 'Its 1 dish comes off with it.'
          : `Its ${dishes} dishes come off with it.`
    }`,
  deleted: (course: string) => `${course} deleted.`,
  dishPicked: 'Guests have picked this dish.',
  coursePicked: 'Guests have picked from this course.',
  lock: 'Your role, Coordinator, can see this menu but not change it. Someone whose role can change Menu can.',
  lockOnEvent: (role: string) =>
    `Your role on this event, ${role}, can see this menu but not change it. Someone whose role can change Menu can.`,
  loading: 'Loading the menu…',
  refreshing: 'Refreshing…',
  forbidden: 'Nothing was changed. Your role does not include the permission this needs.',
  failedSave: (button: string) =>
    `Nothing was saved. Check your connection, then press ${button} again.`,
  failedMove: (name: string, n: number, all: number) =>
    `Nothing was moved: ${name} is still course ${n} of ${all}. Check your connection, then try again.`,
  cannotReach: 'Cannot reach Soirely',
  cannotReachBody: 'The menu did not load. Check your connection, then try again.',
  tryAgain: 'Try again',
  gone: 'This event is not available',
  goneBody: 'It may have been deleted, or it belongs to another organisation.',
  backToEvents: 'Back to events',
} as const;

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/u;

export const lengthOf = (text: string): number => [...text.trim()].length;

export interface CourseForm {
  name: string;
  servedAt: string;
}

export interface CourseErrors {
  name: string | null;
  servedAt: string | null;
}

export function checkCourse(form: CourseForm): CourseErrors {
  const length = lengthOf(form.name);
  const time = form.servedAt.trim();

  return {
    name: length === 0 ? CW.courseBlank : length > COURSE_NAME_MAX ? CW.courseLong : null,
    servedAt: time === '' || TIME.test(time) ? null : CW.timeWrong,
  };
}

export function firstCourseProblem(errors: CourseErrors): string | null {
  if (errors.name != null) return 'mc-name';
  if (errors.servedAt != null) return 'mc-served';

  return null;
}

export function servedTime(typed: string): string | null {
  const found = TIME.exec(typed.trim());
  if (found == null) return null;

  return `${(found[1] ?? '').padStart(2, '0')}:${found[2] ?? ''}`;
}

export const canAddCourse = (courses: readonly EvCourse[]): boolean => courses.length < COURSE_MAX;

/** Ready once guests are offered a dish: a dish waiting on a draft choice isn't (sc-3904). */
export const isReady = (course: EvCourse): boolean => course.dishes.some((one) => !dishHidden(one));

export const onlyDrafts = (course: EvCourse): boolean =>
  course.dishes.length > 0 && !isReady(course);

export const isPicked = (dish: EvDish): boolean => dishPicked(dish);

export const coursePicked = (course: EvCourse): boolean => course.dishes.some(isPicked);

export const canSame = (course: EvCourse): boolean => course.dishes.length === 1;

/** sc-3905: a course asks guests something when they choose, or when its one dish asks the way or a choice; one not shown to guests asks nothing. */
export const asksGuests = (course: EvCourse): boolean =>
  isReady(course) && (course.answer === 'choose' || courseHint(course.dishes) != null);

export const courseClose = (course: EvCourse, dates: PicksDates): Close | null =>
  asksGuests(course) ? closeOf(course.id, dates) : null;

export const menuCloses = (courses: readonly EvCourse[], dates: PicksDates): Close[] =>
  courses.flatMap((one) => courseClose(one, dates) ?? []);

export function headerLines(courses: readonly EvCourse[]): {
  counts: string;
  ready: string | null;
} {
  const dishes = courses.reduce((sum, one) => sum + one.dishes.length, 0);
  const ready = courses.filter(isReady).length;

  return {
    counts: `${CW.courses(courses.length)} · ${CW.dishes(dishes)}`,
    ready: ready < courses.length ? CW.ready(ready, courses.length) : null,
  };
}

export function menuLinkLine(courses: readonly EvCourse[]): string | null {
  const ready = courses.filter(isReady).length;

  return ready < courses.length ? `${ready} of ${courses.length} ready` : null;
}

export function courseLine(at: number, all: number, servedAt: string | null): string {
  const course = CW.courseOf(at + 1, all);

  return servedAt == null ? course : `${course} · ${CW.served(servedAt)}`;
}

export function moveCourse(
  courses: readonly EvCourse[],
  at: number,
  to: number,
): { courses: EvCourse[]; said: string } | null {
  if (to === at || to < 0 || to >= courses.length) return null;
  const by = to > at ? 1 : -1;
  let next: EvCourse[] = courses.slice();
  for (let from = at; from !== to; from += by) {
    next = moved(next, from, by as -1 | 1) ?? next;
  }
  const course = courses[at] as EvCourse;

  return { courses: next, said: CW.moved(course.name, to + 1, next.length) };
}

/** Keeps a course's answer honest: Everyone gets the same only with exactly one dish. A second dish puts it back to Guests choose, and says so. */
export function withDishes(
  course: EvCourse,
  dishes: readonly EvDish[],
): { course: EvCourse; said: string | null } {
  if (course.answer === 'same' && dishes.length !== 1) {
    return {
      course: { ...course, dishes, answer: 'choose' },
      said: dishes.length > 1 ? CW.nowChoose(course.name, dishes.length) : null,
    };
  }

  return { course: { ...course, dishes }, said: null };
}

let copies = 0;

/** The event's own copy of a library dish: what it is now, and nothing that later changes the library reaches it. */
export function copyOf(dish: LibDish, id?: string): EvDish {
  copies += 1;
  const copyId = id ?? `ev-${dish.id}-${copies}`;

  return {
    id: copyId,
    name: dish.name,
    desc: dish.desc,
    contains: Array.isArray(dish.contains) ? dish.contains.slice() : dish.contains,
    diets: dish.diets.slice(),
    libraryId: dish.id,
    pickers: [],
    ...(dish.variants == null || dish.variants.length === 0
      ? {}
      : { variants: copiedVariants(dish.variants, EVENT_CURRENCY, copyId) }),
  };
}

export function newCourse(name: string, servedAt: string | null): EvCourse {
  copies += 1;

  return { id: `k-new-${copies}`, name, servedAt, answer: 'choose', skip: false, dishes: [] };
}

export function newDish(form: DishForm, onlyEvent: boolean): EvDish {
  copies += 1;

  return {
    id: `ev-new-${copies}`,
    name: form.name.trim(),
    desc: form.desc.trim(),
    contains: form.none ? 'none' : form.allergens.slice(),
    diets: form.diets.slice(),
    libraryId: onlyEvent ? null : `d-new-${copies}`,
    pickers: [],
  };
}

export const onCourse = (course: EvCourse, libraryId: string): boolean =>
  course.dishes.some((one) => one.libraryId === libraryId);

const listOf = (names: readonly string[]): string =>
  new Intl.ListFormat('en', { type: 'conjunction' }).format(names);

/** The line under Edit dish's confirmation, until sc-3913: the people who picked the dish and have one of the allergens just added recorded. Each person counts once, an Other allergy is never matched, and only the added allergens somebody counted has are named. */
export function addedAllergenLine(
  dish: Pick<EvDish, 'name' | 'pickers'>,
  before: Contains,
  after: Contains,
  lang: Lang = 'en',
): string | null {
  if (!Array.isArray(after)) return null;
  const had: readonly DishAllergen[] = Array.isArray(before) ? before : [];
  const added = after.filter((code) => !had.includes(code));
  if (added.length === 0) return null;
  const counted = dish.pickers.filter((one) =>
    added.some((code) => one.includes(code as Allergen)),
  );
  if (counted.length === 0) return null;
  const named = DISH_ALLERGENS.filter(
    (code) => added.includes(code) && counted.some((one) => one.includes(code as Allergen)),
  ).map((code) => allergenName(code, lang));
  const who =
    counted.length === 1
      ? `1 guest who picked ${dish.name} has`
      : `${counted.length} guests who picked ${dish.name} have`;

  return `${who} ${listOf(named)} recorded, and nobody has told them.`;
}

const lib = (id: string): LibDish => SAMPLE_DISHES.find((one) => one.id === id) as LibDish;

function from(id: string, eventId: string, pickers: readonly Picker[] = []): EvDish {
  const dish = lib(id);

  return {
    id: eventId,
    name: dish.name,
    desc: dish.desc,
    contains: dish.contains,
    diets: dish.diets,
    libraryId: dish.id,
    pickers,
  };
}

const many = (n: number, picker: Picker): Picker[] => Array.from({ length: n }, () => picker);

const MAIN_PICKERS: readonly Picker[] = [
  ...many(3, ['sesame']),
  ['sesame', 'peanuts'],
  ['other'],
  ...many(40, []),
];

const SUYA_WRAP: EvDish = {
  id: 'ev-wrap',
  name: 'Suya wrap',
  desc: 'Beef suya, onion and tomato in a flatbread.',
  contains: ['gluten', 'peanuts', 'sesame'],
  diets: ['halal', 'no_pork', 'no_alcohol'],
  libraryId: null,
  pickers: [],
};

function course(
  id: string,
  name: string,
  servedAt: string | null,
  dishes: readonly EvDish[],
  more: Partial<EvCourse> = {},
): EvCourse {
  return { id, name, servedAt, answer: 'choose', skip: false, dishes, ...more };
}

export function sampleCourses(): EvCourse[] {
  return [
    course('k1', 'Starter', '18:30', [from('d-pepper', 'k1-pepper')], { answer: 'same' }),
    course('k2', 'Main', '20:00', [
      from('d-jollof', 'k2-jollof', MAIN_PICKERS),
      from('d-coconut', 'k2-coconut'),
      SUYA_WRAP,
    ]),
    course(
      'k3',
      'Dessert',
      '21:30',
      [from('d-chinchin', 'k3-chinchin'), from('d-zobo', 'k3-zobo')],
      { skip: true },
    ),
    course('k4', 'Late-night bites', null, []),
  ];
}

const TASTING: readonly [string, string | null, string | null][] = [
  ['Amuse-bouche', '18:30', 'd-moimoi'],
  ['Soup', '18:50', 'd-pepper'],
  ['Small plate', '19:10', 'd-suya'],
  ['Rice', '19:40', 'd-jollof'],
  ['Palate cleanser', '20:10', 'd-zobo'],
  ['Main', '20:30', 'd-coconut'],
  ['Cheese', '21:00', null],
  ['Pre-dessert', '21:20', 'd-chinchin'],
  ['Dessert', '21:40', 'd-zobo'],
  ['Petits fours', '22:00', null],
];

export function tastingCourses(): EvCourse[] {
  return TASTING.map(([name, at, dish], index) =>
    course(`t${index + 1}`, name, at, dish == null ? [] : [from(dish, `t${index + 1}-d`)], {
      answer: dish == null ? 'choose' : 'same',
    }),
  );
}

type DishChange = (dish: EvDish) => EvDish;

/** The sample menu with some dishes changed, by id. */
function changed(changes: Record<string, DishChange>, courses = sampleCourses()): EvCourse[] {
  return courses.map((one) => ({
    ...one,
    dishes: one.dishes.map((dish) => changes[dish.id]?.(dish) ?? dish),
  }));
}

const ways =
  (variants: readonly Variant[]): DishChange =>
  (dish) => ({ ...dish, pickers: [], variants });

/** sc-3903's sample: a set starter of two ways, one for children; Jollof rice · 3 ways, its picks on its variants; Coconut rice and Suya wrap · 2 ways. */
export function variantCourses(): EvCourse[] {
  return changed({
    'k1-pepper': ways(childrenFold()),
    'k2-jollof': ways(jollofVariants()),
    'k2-coconut': ways(twoWays()),
    'ev-wrap': ways(beefWays()),
  });
}

/** sc-3909's sample menu: sc-3903's variants, with "And a side?" on Coconut rice. */
export function picksCourses(): EvCourse[] {
  return changed(
    { 'k2-coconut': (dish) => ({ ...dish, choices: [sideChoice(false)] }) },
    variantCourses(),
  );
}

/** Main as a set course of Jollof rice alone, nobody having picked it. */
function setMain(variants: readonly Variant[]): EvCourse[] {
  return changed(
    { 'k2-jollof': ways(variants) },
    sampleCourses().map((one) =>
      one.id === 'k2'
        ? { ...one, answer: 'same', dishes: one.dishes.filter((d) => d.id === 'k2-jollof') }
        : one,
    ),
  );
}

const asks =
  (choices: readonly Choice[], variants?: readonly Variant[]): DishChange =>
  (dish) => ({ ...dish, choices, ...(variants == null ? {} : { pickers: [], variants }) });

/** sc-3904's sample: Jollof rice, picked, asks "And a side?", answered, and "And a sauce?", optional and not yet answered. */
export function choiceCourses(choices: readonly Choice[] = [sideChoice(), sauceChoice()]) {
  return changed({ 'k2-jollof': asks(choices) });
}

function waysAndChoices(choices: readonly Choice[], picked: boolean): EvCourse[] {
  const two = twoWays().map((one, at) =>
    picked ? { ...one, pickers: Array.from({ length: at === 0 ? 38 : 48 }, () => []) } : one,
  );

  return changed({ 'k2-jollof': asks(choices, two) });
}

const SHORT_RIB: EvDish = {
  id: 'k2-rib',
  name: 'Short rib',
  desc: 'Braised beef short rib in pepper sauce, cooked for six hours.',
  contains: ['celery'],
  diets: ['halal', 'no_pork', 'no_alcohol'],
  libraryId: null,
  pickers: [],
};

function setMainOf(dish: EvDish): EvCourse[] {
  return sampleCourses().map((one) =>
    one.id === 'k2' ? { ...one, answer: 'same', skip: true, dishes: [dish] } : one,
  );
}

/** Dessert, its dishes waiting on draft choices: every one, or Chin chin alone. */
function dessertDrafts(all: boolean): EvCourse[] {
  return changed({
    'k3-chinchin': asks([draftChoice('c-chin', 'And a topping?')]),
    ...(all ? { 'k3-zobo': asks([draftChoice('c-zobo')]) } : {}),
  });
}

const SIDE_FORM: readonly Partial<OptionForm>[] = [
  { name: 'Plantain', none: true },
  { name: 'Garden salad', allergens: ['mustard'] },
  { name: 'Moi moi', allergens: ['eggs'] },
];

/** "And a side?" saved with new allergens on its options, by place: the menu after it, and the status line. */
function sideSaved(contains: readonly (DishAllergen[] | null)[]) {
  const was = sideChoice();
  const form = choiceForm(was);
  const edited: ChoiceForm = {
    ...form,
    options: form.options.map((one, at) => {
      const next = contains[at];
      return next == null ? one : { ...one, allergens: next, none: false };
    }),
  };
  const base = choiceCourses();
  const jollof = dishIn(base, 'k2-jollof') as EvDish;
  const saved = withSavedChoice(jollof, 'edit', was.id, edited, 'en');

  return {
    courses: changed({ 'k2-jollof': () => saved.dish }, base),
    said: saved.said,
    saidMore: saved.more,
  };
}

const dishIn = (courses: readonly EvCourse[], id: string): EvDish | undefined =>
  courses.flatMap((one) => one.dishes).find((one) => one.id === id);

const unpicked = (variants: readonly Variant[]): Variant[] =>
  variants.map((one) => ({ ...one, pickers: [] }));

export function libraryWithJollof(currency: string): LibDish[] {
  return SAMPLE_DISHES.filter((one) => !one.archived).map((one) =>
    one.id === 'd-jollof' ? { ...one, variants: libraryJollof(currency) } : one,
  );
}

/** The library's Jollof rice · 3 ways as Late-night bites took it, last priced in the currency given. */
function lateJollof(currency: string): EvCourse[] {
  const lib = libraryWithJollof(currency).find((one) => one.id === 'd-jollof') as LibDish;
  const copy = copyOf(lib, 'k4-jollof');

  return sampleCourses().map((one) => (one.id === 'k4' ? { ...one, dishes: [copy] } : one));
}

const TWO_FISH: readonly Partial<VariantForm>[] = [
  { name: 'Chicken', allergens: ['celery'], diets: ['halal'], amount: '14.00' },
  { name: 'Fish', allergens: ['fish', 'celery'], diets: ['pescatarian'], amount: '15.50' },
];

export type Opened =
  | { kind: 'addCourse'; form?: CourseForm; press?: boolean; serverFull?: boolean }
  | { kind: 'editCourse'; courseId: string; pair?: Partial<DefaultForm>; press?: boolean }
  | {
      kind: 'addDish';
      courseId: string;
      tab: 'library' | 'new';
      q?: string;
      form?: Partial<DishForm>;
      press?: boolean;
    }
  | {
      kind: 'editDish';
      courseId: string;
      dishId: string;
      form?: Partial<DishForm>;
      press?: boolean;
    }
  | {
      kind: 'variants';
      courseId: string;
      dishId: string;
      mode: VariantMode;
      variantId?: string;
      forms?: readonly Partial<VariantForm>[];
      press?: boolean;
    }
  | {
      kind: 'choice';
      courseId: string;
      dishId: string;
      mode: ChoiceMode;
      choiceId?: string;
      form?: Partial<Omit<ChoiceForm, 'options'>>;
      /** Over the form's options, by place; a longer list adds blocks. */
      options?: readonly Partial<OptionForm>[];
      openAt?: number;
      binAt?: number;
      optionsFull?: boolean;
      press?: boolean;
    };

export type Asking =
  | { kind: 'dish'; dishId: string }
  | { kind: 'course'; courseId: string }
  | { kind: 'variant'; dishId: string; ask: VariantAsk }
  | { kind: 'choice'; dishId: string; ask: ChoiceAsk };

export type Refused =
  | { kind: 'dish'; dishId: string }
  | { kind: 'defaultDish'; dishId: string }
  | { kind: 'course'; courseId: string }
  | { kind: 'limit'; at: 'top' | 'end' }
  | { kind: 'addVariant'; dishId: string; why: 'limit' | 'picked' }
  | { kind: 'addChoice'; dishId: string; why: 'limit' | 'picked' };

export interface CoursesStart {
  name: string;
  note: string;
  courses: EvCourse[];
  manage: boolean;
  /** The read-only line: the organisation role's, or a Member's role on this event (sc-59617). */
  lock: string;
  opened: Opened | null;
  asking: Asking | null;
  refused: Refused | null;
  said: string;
  saidMore?: string | readonly string[] | null;
  system: 'none' | 'loading' | 'refreshing' | 'offline' | 'cannotReach' | 'noAccess' | 'gone';
  /** The next save or action fails: no connection, or a role that lost menu.manage. */
  failing: 'none' | 'network' | 'forbidden';
  /** The menu library Add dish lists, when a state needs one with variants. */
  library?: readonly LibDish[];
  /** The menu has loaded and the library Add dish lists has not yet. */
  libraryLoading?: boolean;
  /** The menu has loaded and the library Add dish lists did not. */
  libraryFailed?: boolean;
  /** Try again on a library that did not load fails once more, then loads. */
  libraryRetryFails?: boolean;
  /** sc-3905: the dates every course's close is worked out from. */
  picks: PicksDates;
  /** sc-3905: the reply-by date moves to this, two seconds after the state opens. */
  picksMoveTo?: string;
  /** sc-3909: each dish row and variant inset shows its picks, See picks sits on each course, and the picks summary beside the menu. */
  showPicks?: boolean;
}

function start(over: Partial<CoursesStart> & { name: string; note: string }): CoursesStart {
  return {
    courses: sampleCourses(),
    manage: true,
    lock: CW.lock,
    opened: null,
    asking: null,
    refused: null,
    said: '',
    system: 'none',
    failing: 'none',
    picks: SAMPLE_PICKS,
    ...over,
  };
}

const MAIN = 'k2';

const CANAPE: EvDish = {
  id: 'k1-canape',
  name: 'Canapé selection',
  desc: 'Smoked fish blinis, cheese puffs and small pastries.',
  contains: ['gluten', 'fish', 'milk'],
  diets: ['pescatarian'],
  libraryId: null,
  pickers: [],
};

/** Starter guests choose, so all three courses with dishes ask something. */
function allAskCourses(): EvCourse[] {
  const all = sampleCourses();

  return all.map((one) =>
    one.id === 'k1' ? course('k1', 'Starter', '18:30', [CANAPE, from('d-suya', 'k1-suya')]) : one,
  );
}

const STARTER_OWN = { k1: '2026-10-16' };

const STARTER_DEFAULT: CourseDefault = { dishId: 'k1-canape', variantId: null, optionIds: [] };

const MAIN_DEFAULT: CourseDefault = {
  dishId: 'k2-coconut',
  variantId: 'v-chicken2',
  optionIds: ['c-side-plantain'],
};

/** 23 people given Canapé selection at the date: 21 with no diet recorded, 2 Pescatarian. */
const GIVEN: readonly Given[] = [
  ...Array.from({ length: 21 }, () => []),
  ['pescatarian'],
  ['pescatarian'],
];

/** 4 Pescatarian people given Canapé selection: Beef suya skewers meets none of them, so nobody moves. */
const GIVEN_PESCATARIAN: readonly Given[] = Array.from({ length: 4 }, () => ['pescatarian']);

function withPick(
  courses: readonly EvCourse[],
  courseId: string,
  pick: CourseDefault,
  given: readonly Given[] = [],
): EvCourse[] {
  return courses.map((one) => (one.id === courseId ? { ...one, pick, given } : one));
}

const twoSides = (): Choice =>
  choice(
    'c-two',
    'Two sides?',
    [
      option('c-two-plantain', 'Plantain', 'none'),
      option('c-two-salad', 'Garden salad', ['mustard']),
      option('c-two-moimoi', 'Moi moi', ['eggs']),
    ],
    { pick: 2 },
  );

/** sc-1362's sample: Starter's two dishes; Main's Jollof rice asks for two sides, and Coconut rice has variants and asks for a side. */
function defaultCourses(): EvCourse[] {
  const [fish, chicken] = twoWays() as [Variant, Variant];
  const kids = variant('v-kids2', 'Children’s portion', 'children', ['celery'], ['halal']);

  return allAskCourses().map((one) =>
    one.id === MAIN
      ? {
          ...one,
          dishes: [
            { ...from('d-jollof', 'k2-jollof'), choices: [twoSides()] },
            {
              ...from('d-coconut', 'k2-coconut'),
              variants: [chicken, fish, kids],
              choices: [sideChoice(false)],
            },
            SUYA_WRAP,
          ],
        }
      : one,
  );
}

const MAIN_OWN = { k2: '2026-10-16' };
const AFTER_DATE: PicksDates = { ...SAMPLE_PICKS, today: '2026-10-17', own: STARTER_OWN };

const SIDEBAR_NOTE =
  ' The sidebar keeps sc-3902’s sample event; the close dates are the picks sample’s, an event starting Saturday, Nov 14 at 16:00, Lagos time.';

const STATES = {
  menuPicks: () =>
    start({
      name: 'The menu with its picks (sc-3909)',
      note: 'Each dish row and variant inset shows its picks and share of the room, from the same figures as See picks; See picks on each course, and the picks summary beside the menu.',
      courses: picksCourses(),
      showPicks: true,
    }),
  menuPicksReadOnly: () =>
    start({
      name: 'The menu with its picks, read only (sc-3909)',
      note: 'Without menu.manage: the picks and See picks stay.',
      courses: picksCourses(),
      showPicks: true,
      manage: false,
    }),
  menu: () =>
    start({
      name: 'The menu',
      note: 'Courses in order, each Ready or Empty; a set starter on Everyone gets the same, an optional dessert, and a course with no dishes yet.',
    }),
  loading: () =>
    start({ name: 'Loading', note: 'The skeleton, with Loading the menu….', system: 'loading' }),
  empty: () =>
    start({
      name: 'No menu yet',
      note: 'No courses: the empty card and Add course.',
      courses: [],
    }),
  courseMoved: () =>
    start({
      name: 'Moved, the status line',
      note: 'Main moved up with Move up; the polite line says where it went.',
      courses: (() => {
        const all = sampleCourses();
        return moveCourse(all, 1, 0)?.courses ?? all;
      })(),
      said: CW.moved('Main', 1, 4),
    }),
  addCourse: () =>
    start({
      name: 'Add course',
      note: 'The course form docked beside the menu, with the suggestions and the served time.',
      opened: { kind: 'addCourse' },
    }),
  addCourseBlank: () =>
    start({
      name: 'Add course, the name blank',
      note: 'Checked before it sends: focus on the name.',
      opened: { kind: 'addCourse', form: { name: '', servedAt: '23:00' }, press: true },
    }),
  addCourseLong: () =>
    start({
      name: 'Add course, the name too long',
      note: 'Over 60 characters, counted in red, and a time that is not 24-hour.',
      opened: {
        kind: 'addCourse',
        form: {
          name: 'Late-night bites, suya and small chops served from the garden bar',
          servedAt: '11pm',
        },
        press: true,
      },
    }),
  atLimit: () =>
    start({
      name: 'At the limit, Add course pressed',
      note: 'Ten courses: Add course opens nothing and says why beside the button pressed.',
      courses: tastingCourses(),
      refused: { kind: 'limit', at: 'top' },
    }),
  atLimitForm: () =>
    start({
      name: 'At the limit, refused by the server',
      note: 'Another open Menu page added the 10th while this form was open; nothing is added.',
      courses: tastingCourses().slice(0, 9),
      opened: {
        kind: 'addCourse',
        form: { name: 'Petits fours', servedAt: '22:00' },
        press: true,
        serverFull: true,
      },
    }),
  editCourse: () =>
    start({
      name: 'Edit course',
      note: 'The same form, filled in, docked beside its card.',
      opened: { kind: 'editCourse', courseId: 'k3' },
    }),
  deleteCourse: () =>
    start({
      name: 'Delete course, asked first',
      note: 'Asked inline, once; Keep it puts focus back on Delete….',
      asking: { kind: 'course', courseId: 'k3' },
    }),
  deleteCoursePicked: () =>
    start({
      name: 'Delete course, guests have picked',
      note: 'Refused at once until sc-3913 is built; nothing changes.',
      refused: { kind: 'course', courseId: MAIN },
    }),
  addDish: () =>
    start({
      name: 'Add dish, from the library',
      note: 'Find a dish, each with its Contains and Suitable for, Add or On this course.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'library' },
    }),
  addDishNoMatch: () =>
    start({
      name: 'Add dish, no match',
      note: 'Nothing found, and a new dish with the name filled in.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'library', q: 'plantain' },
    }),
  addDishLoading: () =>
    start({
      name: 'Add dish, the library still loading',
      note: 'Opened before the library has loaded: the count line says so over three bones, and no line quotes a search. New dish works meanwhile.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'library' },
      libraryLoading: true,
    }),
  addDishLibraryFailed: () =>
    start({
      name: 'Add dish, the library did not load',
      note: 'The library request failed: says so with Try again, never that the library is empty. New dish works meanwhile.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'library' },
      libraryFailed: true,
    }),
  addDishLibraryFailsAgain: () =>
    start({
      name: 'Add dish, the library did not load, twice',
      note: 'Try again loads, fails again and comes back to the same state; a second Try again loads the list.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'library' },
      libraryFailed: true,
      libraryRetryFails: true,
    }),
  addDishEmptyLibrary: () =>
    start({
      name: 'Add dish, the library has no dishes',
      note: 'Nothing to find: says the library is empty and starts a new dish instead.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'library' },
      library: [],
    }),
  addDishSame: () =>
    start({
      name: 'Add dish, on an Everyone gets the same course',
      note: 'Add a second dish to the Starter: it goes back to Guests choose, and says so.',
      opened: { kind: 'addDish', courseId: 'k1', tab: 'library' },
    }),
  addDishNew: () =>
    start({
      name: 'Add dish, a new dish',
      note: 'sc-3901’s form, with Only for this event; Last price only while unticked.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'new' },
    }),
  addDishNewBlank: () =>
    start({
      name: 'Add dish, a new dish with nothing filled in',
      note: 'Checked before it sends: the name and Contains.',
      opened: { kind: 'addDish', courseId: MAIN, tab: 'new', press: true },
    }),
  editDish: () =>
    start({
      name: 'Edit dish',
      note: 'The event’s copy only; the library keeps its own.',
      opened: { kind: 'editDish', courseId: MAIN, dishId: 'k2-coconut' },
    }),
  editDishAllergen: () =>
    start({
      name: 'Edit dish, an allergen added to a picked dish',
      note: 'Sesame ticked on Jollof rice, which guests have picked. Press Save changes: never refused, and the line counts who has Sesame recorded.',
      opened: {
        kind: 'editDish',
        courseId: MAIN,
        dishId: 'k2-jollof',
        form: { allergens: ['celery', 'sesame'] },
      },
    }),
  editDishAllergenSaved: () => {
    const all = sampleCourses();
    const main = all[1] as EvCourse;
    const jollof = main.dishes[0] as EvDish;
    const contains: DishAllergen[] = ['celery', 'sesame'];

    return start({
      name: 'Edit dish, saved with the picked-guests line',
      note: 'Each person counts once, and the Other allergy is not matched. Removing an allergen adds no line.',
      courses: all.map((one) =>
        one.id === MAIN
          ? {
              ...one,
              dishes: one.dishes.map((d) => (d.id === jollof.id ? { ...d, contains } : d)),
            }
          : one,
      ),
      said: CW.saved(jollof.name),
      saidMore: addedAllergenLine(jollof, jollof.contains, contains),
    });
  },
  removeDish: () =>
    start({
      name: 'Remove dish, asked first',
      note: 'Asked inline, once; the library keeps its own copy.',
      asking: { kind: 'dish', dishId: 'k3-chinchin' },
    }),
  removeDishPicked: () =>
    start({
      name: 'Remove dish, guests have picked it',
      note: 'Refused at once until sc-3913 is built; nothing changes.',
      refused: { kind: 'dish', dishId: 'k2-jollof' },
    }),
  picksOneDate: () =>
    start({
      name: 'Picks close on one date',
      note:
        'Today is Wednesday, Oct 14. Starter, Main and Dessert ask guests something and close on the reply-by date: the header reads “picks close Monday, Oct 19”, each course a clock pill and the host-only source line. Late-night bites has no dishes, so no close.' +
        SIDEBAR_NOTE,
      courses: allAskCourses(),
    }),
  picksDifferentDates: () =>
    start({
      name: 'Picks close on different dates',
      note:
        'No reply-by date. Starter on its own choose-by date, with its default’s line, Main and Dessert at the event’s start: “picks close from Friday, Oct 16”.' +
        SIDEBAR_NOTE,
      courses: withPick(allAskCourses(), 'k1', STARTER_DEFAULT),
      picks: { ...SAMPLE_PICKS, replyBy: null, own: STARTER_OWN },
    }),
  picksOneClosed: () =>
    start({
      name: 'One course closed',
      note:
        'Today is Saturday, Oct 17, Starter closed Friday: a grey padlock pill, its default given to 23 guests, the closed line and Who hasn’t picked. The header counts only the open courses: “picks close Saturday, Nov 14”.' +
        SIDEBAR_NOTE,
      courses: withPick(allAskCourses(), 'k1', STARTER_DEFAULT, GIVEN),
      picks: { ...SAMPLE_PICKS, today: '2026-10-17', replyBy: null, own: STARTER_OWN },
    }),
  picksAllClosed: () =>
    start({
      name: 'All courses closed',
      note:
        'Today is Tuesday, Oct 20: Starter closed on its own choose-by date with its default given, Main and Dessert on the reply-by date, and the header reads “picks closed on Monday, Oct 19”, the last close.' +
        SIDEBAR_NOTE,
      courses: withPick(allAskCourses(), 'k1', STARTER_DEFAULT, GIVEN),
      picks: { ...SAMPLE_PICKS, today: '2026-10-20', own: STARTER_OWN },
    }),
  picksAllClosedReadOnly: () =>
    start({
      name: 'All courses closed, read only',
      note:
        'Without guests.manage: the closed line’s first sentence only, and no Who hasn’t picked.' +
        SIDEBAR_NOTE,
      courses: withPick(allAskCourses(), 'k1', STARTER_DEFAULT, GIVEN),
      picks: { ...SAMPLE_PICKS, today: '2026-10-20', own: STARTER_OWN },
      manage: false,
    }),
  picksDateChanged: () =>
    start({
      name: 'Close date changed',
      note:
        'Two seconds after it opens, as a change from Event details would arrive, the reply-by date moves to Friday, Oct 23: the pills, the header and the source lines change together, and the status line names the new date.' +
        SIDEBAR_NOTE,
      courses: allAskCourses(),
      picksMoveTo: '2026-10-23',
    }),
  defaultUnset: () =>
    start({
      name: 'Default and choose-by date, unset',
      note:
        'Edit course on Starter, where guests choose: the group under Served at, with No default selected and Choose by blank. Pick a dish and a date, then Save changes: the card says when it is given.' +
        SIDEBAR_NOTE,
      courses: defaultCourses(),
      opened: { kind: 'editCourse', courseId: 'k1' },
    }),
  defaultSet: () =>
    start({
      name: 'Default and choose-by date, set',
      note:
        'Starter’s default is Canapé selection, by Friday, Oct 16: its own close, the line under it, and Clear the default and date in Edit course.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), 'k1', STARTER_DEFAULT),
      picks: { ...SAMPLE_PICKS, own: STARTER_OWN },
      opened: { kind: 'editCourse', courseId: 'k1' },
    }),
  defaultWholePick: () =>
    start({
      name: 'Default, a whole pick',
      note:
        'Main’s default is Coconut rice, Chicken, Plantain: the dish, one of its Everyone variants, and the option its required choice asks for. Jollof rice asks for two sides, as checkboxes.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), MAIN, MAIN_DEFAULT),
      picks: { ...SAMPLE_PICKS, own: MAIN_OWN },
      opened: { kind: 'editCourse', courseId: MAIN },
    }),
  defaultOnlyOne: () =>
    start({
      name: 'Default, only one of the two set',
      note:
        'Canapé selection with no date, Save changes pressed: refused before sending, the line under Choose by and focus on it. Set No default and a date for the other line.' +
        SIDEBAR_NOTE,
      courses: defaultCourses(),
      opened: { kind: 'editCourse', courseId: 'k1', pair: { dishId: 'k1-canape' }, press: true },
    }),
  defaultAfterEvent: () =>
    start({
      name: 'Default, a date on the event’s day',
      note: 'Choose by Saturday, Nov 14, the event’s own date: refused.' + SIDEBAR_NOTE,
      courses: defaultCourses(),
      opened: {
        kind: 'editCourse',
        courseId: 'k1',
        pair: { dishId: 'k1-canape', chooseBy: '2026-11-14' },
        press: true,
      },
    }),
  defaultPast: () =>
    start({
      name: 'Default, a date that has passed',
      note:
        'Choose by Monday, Oct 12, newly entered: refused. A stored date is never checked against today.' +
        SIDEBAR_NOTE,
      courses: defaultCourses(),
      opened: {
        kind: 'editCourse',
        courseId: 'k1',
        pair: { dishId: 'k1-canape', chooseBy: '2026-10-12' },
        press: true,
      },
    }),
  defaultChoiceUnanswered: () =>
    start({
      name: 'Default, a required choice unanswered',
      note:
        'Coconut rice, Chicken and no side: the line names “And a side?”, and focus is on its first option.' +
        SIDEBAR_NOTE,
      courses: defaultCourses(),
      opened: {
        kind: 'editCourse',
        courseId: MAIN,
        pair: { dishId: 'k2-coconut', variantId: 'v-chicken2', chooseBy: '2026-10-16' },
        press: true,
      },
    }),
  defaultAfterDate: () =>
    start({
      name: 'Default, after the date',
      note:
        'Today is Saturday, Oct 17: 23 guests were given Canapé selection. Choose by is locked as text, No default is gone, and the default can still change.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), 'k1', STARTER_DEFAULT, GIVEN),
      picks: AFTER_DATE,
      opened: { kind: 'editCourse', courseId: 'k1' },
    }),
  defaultMove: () =>
    start({
      name: 'Default, moving the guests given it',
      note:
        'Beef suya skewers chosen after the date, Save changes pressed: 21 guests move, and the 2 Pescatarian go back to not chosen. Cancel changes nothing.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), 'k1', STARTER_DEFAULT, GIVEN),
      picks: AFTER_DATE,
      opened: { kind: 'editCourse', courseId: 'k1', pair: { dishId: 'k1-suya' }, press: true },
    }),
  defaultMoveNone: () =>
    start({
      name: 'Default, changed with nobody to move',
      note:
        'Beef suya skewers chosen after the date, Save changes pressed: the 4 guests given Canapé selection are all Pescatarian, so nobody moves and all 4 go back to not chosen. The question says the default changes instead of “Move 0 guests”.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), 'k1', STARTER_DEFAULT, GIVEN_PESCATARIAN),
      picks: AFTER_DATE,
      opened: { kind: 'editCourse', courseId: 'k1', pair: { dishId: 'k1-suya' }, press: true },
    }),
  defaultRemoveDish: () =>
    start({
      name: 'Remove… the default dish',
      note:
        'Remove… on Canapé selection, Starter’s default: refused at once, nothing removed.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), 'k1', STARTER_DEFAULT),
      picks: { ...SAMPLE_PICKS, own: STARTER_OWN },
      refused: { kind: 'defaultDish', dishId: 'k1-canape' },
    }),
  defaultRemoveVariant: () =>
    start({
      name: 'Remove… the default variant',
      note:
        'Remove… on Coconut rice’s Chicken, Main’s default variant: refused at once.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), MAIN, MAIN_DEFAULT),
      picks: { ...SAMPLE_PICKS, own: MAIN_OWN },
      asking: {
        kind: 'variant',
        dishId: 'k2-coconut',
        ask: {
          variantId: 'v-chicken2',
          kind: 'refused',
          lines: [],
          said: DFW.refuseVariant('Chicken', 'Main'),
        },
      },
    }),
  defaultRemoveOption: () =>
    start({
      name: 'Remove an option of the default',
      note:
        'Edit “And a side?” on Coconut rice: the bin on Plantain, part of Main’s default, removes nothing. Focus stays on the bin.' +
        SIDEBAR_NOTE,
      courses: withPick(defaultCourses(), MAIN, MAIN_DEFAULT),
      picks: { ...SAMPLE_PICKS, own: MAIN_OWN },
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'edit',
        choiceId: 'c-side',
        binAt: 0,
      },
    }),
  defaultAsksNothing: () =>
    start({
      name: 'Default, a course that asks nothing',
      note: 'Edit course on Starter, where everyone gets Catfish pepper soup with no variant or choice to answer: no default group at all.',
      opened: { kind: 'editCourse', courseId: 'k1' },
    }),
  menuReadOnly: () =>
    start({
      name: 'Read only, without menu.manage',
      note: 'Every course and dish as text, and no controls.',
      manage: false,
    }),
  readOnlyCanView: () =>
    start({
      name: 'Read only, a Member with Can view',
      note: 'The line names the role on this event, as People shows it, not the organisation role.',
      manage: false,
      lock: CW.lockOnEvent('Can view'),
    }),
  readOnlyCheckIn: () =>
    start({
      name: 'Read only, a Member with Can check guests in',
      note: 'The longest line the Menu shows: it wraps whole at 1280 px and at a 320 px window.',
      manage: false,
      lock: CW.lockOnEvent('Can check guests in'),
    }),
  emptyReadOnly: () =>
    start({
      name: 'No menu yet, read only',
      note: 'No courses, and no Add course.',
      courses: [],
      manage: false,
    }),
  refreshing: () =>
    start({ name: 'Refreshing', note: 'Refreshing… in the header.', system: 'refreshing' }),
  offline: () =>
    start({
      name: 'Offline',
      note: 'The stale band above the title, unchanged (sc-22586).',
      system: 'offline',
    }),
  cannotReach: () =>
    start({ name: 'Cannot reach Soirely', note: 'The menu did not load.', system: 'cannotReach' }),
  moveFailed: () =>
    start({
      name: 'A move that fails',
      note: 'Press Move up on Main: nothing moves, and the status line says so.',
      failing: 'network',
    }),
  saveFailed: () =>
    start({
      name: 'A save that fails',
      note: 'Press Add dish: nothing is saved, and the form says so.',
      opened: {
        kind: 'addDish',
        courseId: MAIN,
        tab: 'new',
        form: { name: 'Plantain skewers', allergens: [], none: true },
      },
      failing: 'network',
    }),
  saveForbidden: () =>
    start({
      name: 'A 403 on save',
      note: 'The role lost menu.manage while the form was open: press Save changes.',
      opened: { kind: 'editCourse', courseId: MAIN },
      failing: 'forbidden',
    }),
  noAccess: () =>
    start({
      name: 'Without menu.read',
      note: 'The page is withheld, as Guests, Seating and Schedule are.',
      system: 'noAccess',
    }),
  gone: () =>
    start({
      name: 'Another organisation’s event, 404',
      note: 'This event is not available.',
      system: 'gone',
    }),
  menuVariants: () =>
    start({
      name: 'The menu with variants',
      note: 'Jollof rice · 3 ways, each variant in an inset with its Contains, Suitable for and picks; Add variant on every dish row; a dish with variants counts once.',
      courses: variantCourses(),
    }),
  variantsReadOnly: () =>
    start({
      name: 'Variants, read only',
      note: 'The insets with no Add variant, Edit or Remove….',
      courses: variantCourses(),
      manage: false,
    }),
  addFirst: () =>
    start({
      name: 'Add variant, the first two',
      note: 'Add variant on Coconut rice: two blocks, each blank, beside what the dish said until now.',
      opened: { kind: 'variants', courseId: MAIN, dishId: 'k2-coconut', mode: 'addFirst' },
    }),
  addFirstBlank: () =>
    start({
      name: 'Add variants, pressed blank',
      note: 'Checked before it sends, across both blocks: focus on the first variant’s Name.',
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'addFirst',
        press: true,
      },
    }),
  addFirstConflict: () =>
    start({
      name: 'Add variants, a diet conflict',
      note: 'Fish ticked as Vegetarian in the second block: sc-3901’s line, and focus on the diet.',
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'addFirst',
        forms: [TWO_FISH[0] ?? {}, { ...TWO_FISH[1], diets: ['vegetarian'] }],
        press: true,
      },
    }),
  addFirstSameName: () =>
    start({
      name: 'Add variants, the same name twice',
      note: 'Chicken and chicken: each variant needs its own name, ignoring case.',
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'addFirst',
        forms: [TWO_FISH[0] ?? {}, { ...TWO_FISH[1], name: 'chicken' }],
        press: true,
      },
    }),
  addFirstNoEveryone: () =>
    start({
      name: 'Add variants, no variant for Everyone',
      note: 'Both blocks Children only: the line under each For, focus on the first block’s Children only. Set either to Everyone and both lines clear.',
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'addFirst',
        forms: [
          { ...TWO_FISH[0], name: 'Children’s portion', for: 'children' },
          { ...TWO_FISH[1], name: 'Children’s plain', for: 'children' },
        ],
        press: true,
      },
    }),
  addFirstPicked: () =>
    start({
      name: 'Add variant on a picked dish',
      note: 'Until sc-3913 is built, Add variant on Jollof rice, which guests have picked, opens nothing and says so under the row.',
      refused: { kind: 'addVariant', dishId: 'k2-jollof', why: 'picked' },
    }),
  addedTwo: () =>
    start({
      name: 'Added, the first two',
      note: 'Coconut rice · 2 ways, and the status line.',
      courses: changed({ 'k2-coconut': ways(twoWays().reverse()) }),
      said: VW.addedTwo('Coconut rice', 'Chicken', 'Fish'),
    }),
  addVariant: () =>
    start({
      name: 'Add variant, a dish with variants',
      note: 'One block, on Jollof rice · 3 ways, whatever its picks.',
      courses: variantCourses(),
      opened: { kind: 'variants', courseId: MAIN, dishId: 'k2-jollof', mode: 'add' },
    }),
  addVariantLong: () =>
    start({
      name: 'Add variant, the name too long',
      note: 'Over 60 characters, counted in red.',
      courses: variantCourses(),
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'add',
        forms: [
          {
            name: 'Smoked turkey with fried plantain and a side of peppered gizzard',
            none: true,
          },
        ],
        press: true,
      },
    }),
  atLimitVariants: () =>
    start({
      name: 'Variants at the limit',
      note: 'Jollof rice · 6 ways: Add variant opens nothing, and says why under the row.',
      courses: changed({ 'k2-jollof': ways(sixWays()) }),
      refused: { kind: 'addVariant', dishId: 'k2-jollof', why: 'limit' },
    }),
  childrenOnly: () =>
    start({
      name: 'Edit variant, Children only',
      note: 'Edit on Children’s portion: the variant form, filled, with For Children only.',
      courses: variantCourses(),
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        variantId: 'v-kids',
      },
    }),
  editNoEveryone: () =>
    start({
      name: 'Edit variant, no variant left for Everyone',
      note: 'Chicken, the only one for Everyone, set to Children only: nothing is sent, and focus is on For.',
      courses: variantCourses(),
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        variantId: 'v-chicken',
        forms: [{ for: 'children' }],
        press: true,
      },
    }),
  editVariantAllergen: () =>
    start({
      name: 'Edit variant, an allergen added to a picked variant',
      note: 'Sesame ticked on Chicken, which guests have picked. Press Save variant: never refused, and the line counts who has Sesame recorded.',
      courses: variantCourses(),
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        variantId: 'v-chicken',
        forms: [{ allergens: ['celery', 'sesame'] }],
      },
    }),
  editVariantAllergenSaved: () => {
    const chicken = jollofVariants()[0] as Variant;
    const contains: DishAllergen[] = ['celery', 'sesame'];

    return start({
      name: 'Edit variant, saved with the picked-guests line',
      note: 'Each person counts once, and the Other allergy is not matched.',
      courses: changed(
        {
          'k2-jollof': ways(
            jollofVariants().map((one) => (one.id === chicken.id ? { ...one, contains } : one)),
          ),
        },
        variantCourses(),
      ),
      said: VW.saved(chicken.name),
      saidMore: variantAllergenLine('Jollof rice', chicken, chicken.contains, contains),
    });
  },
  editDishVariants: () =>
    start({
      name: 'Edit dish, a dish with variants',
      note: 'Only Name and Description: the variants hold its allergens and diets.',
      courses: variantCourses(),
      opened: { kind: 'editDish', courseId: MAIN, dishId: 'k2-jollof' },
    }),
  removeVariant: () =>
    start({
      name: 'Remove… a variant, asked first',
      note: 'From 3 or more: asked inline; Keep it puts focus back on Remove….',
      courses: variantCourses(),
      asking: { kind: 'variant', dishId: 'k2-jollof', ask: { variantId: 'v-plain', kind: 'ask' } },
    }),
  removeVariantPicked: () =>
    start({
      name: 'Remove… a variant guests have picked',
      note: 'Refused at once until sc-3913 is built.',
      courses: variantCourses(),
      asking: {
        kind: 'variant',
        dishId: 'k2-jollof',
        ask: { variantId: 'v-kids', kind: 'refused', lines: ['picked'] },
      },
    }),
  removeLastEveryone: () =>
    start({
      name: 'Remove… the last variant for Everyone',
      note: 'Chicken stays enabled and opens nothing. Guests have picked it, so that line comes first.',
      courses: variantCourses(),
      asking: {
        kind: 'variant',
        dishId: 'k2-jollof',
        ask: { variantId: 'v-chicken', kind: 'refused', lines: ['picked', 'lastEveryone'] },
      },
    }),
  foldToOne: () =>
    start({
      name: 'Fold to one',
      note: 'Remove… on Chicken, from Coconut rice · 2 ways: Make this a single dish?, with Fish’s Cost.',
      courses: variantCourses(),
      asking: {
        kind: 'variant',
        dishId: 'k2-coconut',
        ask: { variantId: 'v-chicken2', kind: 'fold' },
      },
    }),
  foldChildren: () =>
    start({
      name: 'Fold to one, Children only stays',
      note: 'Remove… on Full bowl: the dish is no longer for children only.',
      courses: variantCourses(),
      asking: { kind: 'variant', dishId: 'k1-pepper', ask: { variantId: 'v-full', kind: 'fold' } },
    }),
  foldNoCost: () =>
    start({
      name: 'Fold to one, no cost',
      note: 'Remove… on Chicken, from Suya wrap: Beef has no cost, so the dish has none.',
      courses: variantCourses(),
      asking: {
        kind: 'variant',
        dishId: 'ev-wrap',
        ask: { variantId: 'v-chicken3', kind: 'fold' },
      },
    }),
  setCourseWay: () =>
    start({
      name: 'Set course, guests pick the way',
      note: 'Main is Everyone gets the same, its one dish with two variants for Everyone: the hint under the radios. Add variant opens on the Starter’s soup, and adds no line.',
      courses: setMain(
        unpicked(sixWays().filter((one) => ['v-chicken', 'v-fish6', 'v-kids'].includes(one.id))),
      ),
    }),
  setCourseChildren: () =>
    start({
      name: 'Set course, a children’s portion',
      note: 'One variant for Everyone and one Children only: guests are asked nothing, and there is no hint.',
      courses: setMain(unpicked(jollofVariants().slice(0, 2))),
    }),
  libAdded: () =>
    start({
      name: 'From the library, with variants',
      note: 'Jollof rice · 3 ways copied to Late-night bites, last priced in EUR like the event: Children’s portion’s Cost arrives filled.',
      courses: lateJollof('EUR'),
      library: libraryWithJollof('EUR'),
      said: CW.addedTo('Jollof rice', 'Late-night bites'),
      opened: {
        kind: 'variants',
        courseId: 'k4',
        dishId: 'k4-jollof',
        mode: 'edit',
        variantId: 'k4-jollof-lv-kids',
      },
    }),
  libAddedOther: () =>
    start({
      name: 'From the library, another currency',
      note: 'Last priced in GBP: the Cost stays blank and says so until one is saved. Nothing is converted.',
      courses: lateJollof('GBP'),
      library: libraryWithJollof('GBP'),
      said: CW.addedTo('Jollof rice', 'Late-night bites'),
      opened: {
        kind: 'variants',
        courseId: 'k4',
        dishId: 'k4-jollof',
        mode: 'edit',
        variantId: 'k4-jollof-lv-kids',
      },
    }),
  libToAdd: () =>
    start({
      name: 'Add dish, a library dish with variants',
      note: 'The library lists Jollof rice · 3 ways; Add copies every variant.',
      library: libraryWithJollof('EUR'),
      opened: { kind: 'addDish', courseId: 'k4', tab: 'library' },
    }),
  variantSaveFailed: () =>
    start({
      name: 'Add variants, a save that fails',
      note: 'Press Add variants: nothing is saved, and the form says so.',
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'addFirst',
        forms: TWO_FISH,
      },
      failing: 'network',
    }),
  variantForbidden: () =>
    start({
      name: 'Save variant, a 403',
      note: 'The role lost menu.manage while the form was open: press Save variant.',
      courses: variantCourses(),
      opened: {
        kind: 'variants',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        variantId: 'v-kids',
      },
      failing: 'forbidden',
    }),
  foldFailed: () =>
    start({
      name: 'Fold to one, that fails',
      note: 'Press Make it a single dish: nothing changes, and the status line says so.',
      courses: variantCourses(),
      asking: {
        kind: 'variant',
        dishId: 'k2-coconut',
        ask: { variantId: 'v-chicken2', kind: 'fold' },
      },
      failing: 'network',
    }),

  choices: () =>
    start({
      name: 'A dish with choices',
      note: 'Jollof rice asks “And a side?”, answered, with Kitchen prep, and “And a sauce?”, optional; Add a choice on every dish row.',
      courses: choiceCourses(),
    }),
  choicesReadOnly: () =>
    start({
      name: 'Choices, read only',
      note: 'The insets and Kitchen prep, with no Add a choice, Edit or Remove….',
      courses: choiceCourses(),
      manage: false,
    }),
  addChoice: () =>
    start({
      name: 'Add a choice',
      note: 'On Coconut rice, nobody having picked it: the question, two option blocks, Guests pick exactly and Required, on.',
      opened: { kind: 'choice', courseId: MAIN, dishId: 'k2-coconut', mode: 'add' },
    }),
  addChoiceDraft: () =>
    start({
      name: 'Add a choice, a draft',
      note: 'One option named: the amber box says it saves as a draft, with the reason, and the button reads Save as a draft.',
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'add',
        form: { question: 'And a side?' },
        options: [{ name: 'Plantain', none: true }],
      },
    }),
  addChoiceTooLong: () =>
    start({
      name: 'Add a choice, too long',
      note: 'A question over 80 and an option over 60, pressed: refused before sending, focus on the question.',
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'add',
        form: {
          question:
            'Which side would you like with your coconut rice, and would you like it warm or cold?',
        },
        options: [
          { name: 'Plantain', none: true },
          {
            name: 'Garden salad of lettuce, tomato, cucumber, red onion and sweetcorn',
            allergens: ['mustard'],
          },
        ],
        press: true,
      },
    }),
  addChoiceDuplicate: () =>
    start({
      name: 'Add a choice, the same name twice',
      note: 'Plantain and “plantain ”: each option needs its own name, ignoring case and spaces.',
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'add',
        form: { question: 'And a side?' },
        options: [
          { name: 'Plantain', none: true },
          { name: 'plantain ', none: true },
        ],
        press: true,
      },
    }),
  addChoiceContains: () =>
    start({
      name: 'Add a choice, allergens not answered',
      note: 'Garden salad named with nothing ticked: its allergens open, focus on the first.',
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'add',
        form: { question: 'And a side?' },
        options: [{ name: 'Plantain', none: true }, { name: 'Garden salad' }],
        press: true,
      },
    }),
  containsOpen: () =>
    start({
      name: 'Add a choice, an option’s allergens open',
      note: 'Set allergens on Garden salad: the 14 in Annex II order, Contains none of these below a rule. One list is open at a time.',
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'add',
        form: { question: 'And a side?' },
        options: [
          { name: 'Plantain', none: true },
          { name: 'Garden salad', allergens: ['mustard'] },
        ],
        openAt: 1,
      },
    }),
  optionsLimit: () =>
    start({
      name: 'Add a choice, 8 options',
      note: 'Add an option pressed with 8: nothing is added, and the line says why.',
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-coconut',
        mode: 'add',
        form: { question: 'And a side?', pick: 2 },
        options: eightOptions(),
        optionsFull: true,
      },
    }),
  addChoicePicked: () =>
    start({
      name: 'Add a choice on a picked dish',
      note: 'Until sc-3913 is built, Add a choice on Jollof rice, which guests have picked, opens nothing and says so under the row. It holds for every later choice.',
      courses: choiceCourses(),
      refused: { kind: 'addChoice', dishId: 'k2-jollof', why: 'picked' },
    }),
  choicesAtLimit: () =>
    start({
      name: 'Choices at the limit',
      note: 'A 4th Add a choice opens nothing: a dish can have at most 3 choices, said before the picks.',
      courses: choiceCourses([sideChoice(), sauceChoice(), thirdChoice()]),
      refused: { kind: 'addChoice', dishId: 'k2-jollof', why: 'limit' },
    }),
  choiceSaved: () =>
    start({
      name: 'A choice added',
      note: 'Coconut rice now asks “And a side?”; the status line says so.',
      courses: changed({ 'k2-coconut': asks([sideChoice(false, 'c-new')]) }),
      said: '“And a side?” added to Coconut rice.',
    }),
  choiceOptional: () =>
    start({
      name: 'A choice, optional',
      note: 'Required off: guests also see None for me.',
      courses: changed({
        'k2-coconut': asks([{ ...sideChoice(false, 'c-opt'), required: false }]),
      }),
    }),
  choiceAsDraft: () =>
    start({
      name: 'A draft choice',
      note: 'Coconut rice waits on a choice with one option and no question: the Draft tag and its reasons, Not offered to guests by the name, and Finish for Edit.',
      courses: changed({ 'k2-coconut': asks([draftChoice()]) }),
    }),
  editChoice: () =>
    start({
      name: 'Edit a choice',
      note: 'Edit on “And a sauce?”, nobody having answered it.',
      courses: choiceCourses(),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        choiceId: 'c-sauce',
      },
    }),
  choiceRemoveConfirm: () =>
    start({
      name: 'Remove a choice, asked',
      note: 'Remove… on “And a sauce?”, which nobody has answered: Keep it or Remove choice.',
      courses: choiceCourses(),
      asking: { kind: 'choice', dishId: 'k2-jollof', ask: { choiceId: 'c-sauce', kind: 'ask' } },
    }),
  choiceRemoveAnswered: () =>
    start({
      name: 'Remove an answered choice',
      note: 'Until sc-3913 is built, Remove… on “And a side?” opens nothing: guests have answered it.',
      courses: choiceCourses(),
      asking: {
        kind: 'choice',
        dishId: 'k2-jollof',
        ask: { choiceId: 'c-side', kind: 'answered' },
      },
    }),
  editPickedOption: () =>
    start({
      name: 'Edit, a picked option’s bin',
      note: 'The bin on Plantain removes nothing: guests have picked it. Focus stays on the bin.',
      courses: choiceCourses(),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        choiceId: 'c-side',
        binAt: 0,
      },
    }),
  editCountAnswered: () =>
    start({
      name: 'Edit, the count of an answered choice',
      note: 'Guests pick exactly 2, pressed: refused under the stepper, focus on One fewer.',
      courses: choiceCourses(),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        choiceId: 'c-side',
        form: { pick: 2 },
        press: true,
      },
    }),
  editRequiredAnswered: () =>
    start({
      name: 'Edit, Required over None for me',
      note: '“And a side?” is optional and 4 guests answered None for me: Required turned on is refused under it.',
      courses: choiceCourses([optionalSide(), sauceChoice()]),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        choiceId: 'c-side',
        form: { required: true },
        press: true,
      },
    }),
  editAnsweredDraft: () =>
    start({
      name: 'Edit, an answered choice made unfinished',
      note: 'The question cleared: no draft box, the button stays Save choice, and Save is refused with the reasons.',
      courses: choiceCourses(),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'edit',
        choiceId: 'c-side',
        form: { question: '' },
        press: true,
      },
    }),
  editChoiceAllergenAdded: () =>
    start({
      name: 'Edit, an allergen added to a picked option',
      note: 'Crustaceans added to Moi moi and saved: the confirmation, and under it the line until sc-3913 is built.',
      ...sideSaved([null, null, ['crustaceans', 'eggs']]),
    }),
  editChoiceAllergensTwo: () =>
    start({
      name: 'Edit, allergens added to two picked options',
      note: 'Celery on Garden salad, crustaceans and milk on Moi moi: one line per option, naming only what somebody who picked it has recorded.',
      ...sideSaved([null, ['celery', 'mustard'], ['crustaceans', 'eggs', 'milk']]),
    }),
  variantsAndChoices: () =>
    start({
      name: 'Variants and choices',
      note: 'Jollof rice · 2 ways, then “And a side?”, which applies to every variant, with one Kitchen prep total per option.',
      courses: waysAndChoices([sideChoice()], true),
    }),
  vcReadOnly: () =>
    start({
      name: 'Variants and choices, read only',
      note: 'The variants and the choice with no actions.',
      courses: waysAndChoices([sideChoice()], true),
      manage: false,
    }),
  vcAddChoice: () =>
    start({
      name: 'Variants and choices, Add a choice',
      note: 'On Jollof rice · 2 ways, nobody having picked: the options apply to both variants.',
      courses: waysAndChoices([], false),
      opened: { kind: 'choice', courseId: MAIN, dishId: 'k2-jollof', mode: 'add' },
    }),
  vcAddChoiceDraft: () =>
    start({
      name: 'Variants and choices, a draft',
      note: 'One option: the draft box says guests can’t choose this dish in either variant.',
      courses: waysAndChoices([], false),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'add',
        form: { question: 'And a side?' },
        options: [{ name: 'Plantain', none: true }],
      },
    }),
  vcDuplicate: () =>
    start({
      name: 'Variants and choices, the same name twice',
      note: 'Moi moi twice: refused before sending.',
      courses: waysAndChoices([], false),
      opened: {
        kind: 'choice',
        courseId: MAIN,
        dishId: 'k2-jollof',
        mode: 'add',
        form: { question: 'And a side?' },
        options: [...SIDE_FORM, { name: 'MOI MOI', allergens: ['eggs'] }],
        press: true,
      },
    }),
  vcDraft: () =>
    start({
      name: 'Variants and choices, a draft choice',
      note: 'Hidden in both variants until the draft choice is finished.',
      courses: waysAndChoices([draftChoice()], false),
    }),
  vcAtLimit: () =>
    start({
      name: 'Variants and choices at the limit',
      note: 'Three choices on Jollof rice · 2 ways: a 4th is refused.',
      courses: waysAndChoices([sideChoice(false), sauceChoice(), thirdChoice()], false),
      refused: { kind: 'addChoice', dishId: 'k2-jollof', why: 'limit' },
    }),
  setCourseChoices: () =>
    start({
      name: 'A set course, choices only',
      note: 'Main is Everyone gets the same, Short rib alone, with two choices: the setting stays, and the hint says guests answer its choices.',
      courses: setMainOf({ ...SHORT_RIB, choices: [sideChoice(false), sauceChoice()] }),
    }),
  setCourseVariantsChoices: () =>
    start({
      name: 'A set course, variants and choices',
      note: 'Jollof rice · 2 ways for Everyone and a choice: sc-3903’s “Guests pick the way.” alone.',
      courses: setMainOf({
        ...SHORT_RIB,
        id: 'k2-jollof',
        name: 'Jollof rice',
        desc: 'Smoky party jollof.',
        variants: twoWays(),
        choices: [sideChoice(false)],
      }),
    }),
  setCourseChildrenChoice: () =>
    start({
      name: 'A set course, a children’s portion and a choice',
      note: 'One Everyone variant and one Children only: guests answer the choice alone.',
      courses: setMainOf({
        ...SHORT_RIB,
        id: 'k2-jollof',
        name: 'Jollof rice',
        desc: 'Smoky party jollof.',
        variants: jollofVariants()
          .slice(0, 2)
          .map((one) => ({ ...one, pickers: [] })),
        choices: [sideChoice(false)],
      }),
    }),
  courseOfDrafts: () =>
    start({
      name: 'A course of drafts',
      note: 'Every Dessert dish waits on a draft choice: No finished dish · not shown to guests, and 2 of 4 courses ready.',
      courses: dessertDrafts(true),
    }),
  courseOneFinished: () =>
    start({
      name: 'A course with one finished dish',
      note: 'Chin chin waits on a draft, Zobo is finished: Dessert stays Ready, and only Chin chin is not offered.',
      courses: dessertDrafts(false),
    }),
} satisfies Record<string, () => CoursesStart>;

export type CoursesStateName = keyof typeof STATES;

export const isCoursesState = (raw: string | null): raw is CoursesStateName =>
  raw != null && Object.hasOwn(STATES, raw);

export function coursesStart(raw: CoursesStateName): CoursesStart {
  return STATES[raw]();
}

export function coursesAt(state: CoursesStateName, more = ''): string {
  return `/demo/events/${MENU_EVENT}/menu?state=${state}${more}`;
}

function link(state: CoursesStateName): DemoLink {
  return { to: coursesAt(state), name: STATES[state]().name };
}

export const COURSES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The menu, its courses and their order',
    states: (
      [
        'menu',
        'loading',
        'empty',
        'courseMoved',
        'menuReadOnly',
        'readOnlyCanView',
        'readOnlyCheckIn',
        'emptyReadOnly',
      ] as const
    ).map(link),
  },
  {
    name: 'When picks close (sc-3905)',
    states: (
      [
        'picksOneDate',
        'picksDifferentDates',
        'picksOneClosed',
        'picksAllClosed',
        'picksAllClosedReadOnly',
        'picksDateChanged',
      ] as const
    ).map(link),
  },
  {
    name: 'A default and a choose-by date (sc-1362)',
    states: (
      [
        'defaultUnset',
        'defaultSet',
        'defaultWholePick',
        'defaultOnlyOne',
        'defaultAfterEvent',
        'defaultPast',
        'defaultChoiceUnanswered',
        'defaultAfterDate',
        'defaultMove',
        'defaultMoveNone',
        'defaultRemoveDish',
        'defaultRemoveVariant',
        'defaultRemoveOption',
        'defaultAsksNothing',
      ] as const
    ).map(link),
  },
  {
    name: 'Add course and Edit course',
    states: (
      [
        'addCourse',
        'addCourseBlank',
        'addCourseLong',
        'atLimit',
        'atLimitForm',
        'editCourse',
      ] as const
    ).map(link),
  },
  {
    name: 'Add dish, from the library or new',
    states: (
      [
        'addDish',
        'addDishLoading',
        'addDishLibraryFailed',
        'addDishLibraryFailsAgain',
        'addDishNoMatch',
        'addDishEmptyLibrary',
        'addDishSame',
        'addDishNew',
        'addDishNewBlank',
      ] as const
    ).map(link),
  },
  {
    name: 'Edit dish, Remove… and Delete…',
    states: (
      [
        'editDish',
        'editDishAllergen',
        'editDishAllergenSaved',
        'removeDish',
        'removeDishPicked',
        'deleteCourse',
        'deleteCoursePicked',
      ] as const
    ).map(link),
  },
  {
    name: 'Variants of a dish (sc-3903): the rows',
    states: (
      ['menuVariants', 'variantsReadOnly', 'addFirstPicked', 'atLimitVariants', 'addedTwo'] as const
    ).map(link),
  },
  {
    name: 'Variants: Add variant and Edit',
    states: (
      [
        'addFirst',
        'addFirstBlank',
        'addFirstConflict',
        'addFirstSameName',
        'addFirstNoEveryone',
        'addVariant',
        'addVariantLong',
        'childrenOnly',
        'editNoEveryone',
        'editVariantAllergen',
        'editVariantAllergenSaved',
        'editDishVariants',
      ] as const
    ).map(link),
  },
  {
    name: 'Variants: Remove… and fold to one',
    states: [
      ...(
        [
          'removeVariant',
          'removeVariantPicked',
          'removeLastEveryone',
          'foldToOne',
          'foldChildren',
          'foldNoCost',
        ] as const
      ).map(link),
      { to: coursesAt('foldToOne', '&budget=no'), name: 'Fold to one, without budget.read' },
    ],
  },
  {
    name: 'Variants: a set course, and the library',
    states: (
      ['setCourseWay', 'setCourseChildren', 'libToAdd', 'libAdded', 'libAddedOther'] as const
    ).map(link),
  },
  {
    name: 'Variants: the system’s states',
    states: [
      ...(['variantSaveFailed', 'variantForbidden', 'foldFailed'] as const).map(link),
      { to: coursesAt('addFirst', '&budget=no'), name: 'Add variants, without budget.read' },
    ],
  },
  {
    name: 'Choices in a dish (sc-3904): the rows',
    states: (
      [
        'choices',
        'choicesReadOnly',
        'choiceSaved',
        'choiceOptional',
        'choiceAsDraft',
        'addChoicePicked',
        'choicesAtLimit',
        'choiceRemoveConfirm',
        'choiceRemoveAnswered',
      ] as const
    ).map(link),
  },
  {
    name: 'Choices: Add a choice and Edit',
    states: (
      [
        'addChoice',
        'addChoiceDraft',
        'addChoiceTooLong',
        'addChoiceDuplicate',
        'addChoiceContains',
        'containsOpen',
        'optionsLimit',
        'editChoice',
        'editPickedOption',
        'editCountAnswered',
        'editRequiredAnswered',
        'editAnsweredDraft',
        'editChoiceAllergenAdded',
        'editChoiceAllergensTwo',
      ] as const
    ).map(link),
  },
  {
    name: 'Choices: with variants, a set course, and drafts',
    states: (
      [
        'variantsAndChoices',
        'vcReadOnly',
        'vcAddChoice',
        'vcAddChoiceDraft',
        'vcDuplicate',
        'vcDraft',
        'vcAtLimit',
        'setCourseChoices',
        'setCourseVariantsChoices',
        'setCourseChildrenChoice',
        'courseOfDrafts',
        'courseOneFinished',
      ] as const
    ).map(link),
  },
  {
    name: 'The system’s states',
    states: (
      [
        'refreshing',
        'offline',
        'cannotReach',
        'moveFailed',
        'saveFailed',
        'saveForbidden',
        'noAccess',
        'gone',
      ] as const
    ).map(link),
  },
];
