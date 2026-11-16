import type { Allergen } from './guestKitchenWords.ts';
import {
  type Contains,
  type Diet,
  type DishAllergen,
  type DishForm,
  type Lang,
  type LibDish,
  DISH_ALLERGENS,
  SAMPLE_DISHES,
  allergenName,
} from './menuLibrary.ts';
import { MENU_EVENT, moved } from './menuServed.ts';
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
}

export interface EvCourse {
  id: string;
  name: string;
  servedAt: string | null;
  answer: Answer;
  skip: boolean;
  dishes: readonly EvDish[];
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
  sameNeedsOne: 'Everyone gets the same needs exactly one dish.',
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
  noAccessTitle: 'You do not have access to this',
  noAccessBody: 'Your role does not include the permission this page needs.',
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

export const isReady = (course: EvCourse): boolean => course.dishes.length > 0;

export const isPicked = (dish: EvDish): boolean => dish.pickers.length > 0;

export const coursePicked = (course: EvCourse): boolean => course.dishes.some(isPicked);

export const canSame = (course: EvCourse): boolean => course.dishes.length === 1;

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
export function copyOf(dish: LibDish): EvDish {
  copies += 1;

  return {
    id: `ev-${dish.id}-${copies}`,
    name: dish.name,
    desc: dish.desc,
    contains: Array.isArray(dish.contains) ? dish.contains.slice() : dish.contains,
    diets: dish.diets.slice(),
    libraryId: dish.id,
    pickers: [],
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
  ...many(3, ['milk']),
  ['milk', 'eggs'],
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
      answer: 'same',
    }),
  );
}

export type Opened =
  | { kind: 'addCourse'; form?: CourseForm; press?: boolean; serverFull?: boolean }
  | { kind: 'editCourse'; courseId: string }
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
    };

export type Asking = { kind: 'dish'; dishId: string } | { kind: 'course'; courseId: string };

export type Refused =
  | { kind: 'dish'; dishId: string }
  | { kind: 'course'; courseId: string }
  | { kind: 'limit'; at: 'top' | 'end' };

export interface CoursesStart {
  name: string;
  note: string;
  courses: EvCourse[];
  manage: boolean;
  opened: Opened | null;
  asking: Asking | null;
  refused: Refused | null;
  said: string;
  saidMore?: string | null;
  system: 'none' | 'loading' | 'refreshing' | 'offline' | 'cannotReach' | 'noAccess' | 'gone';
  /** The next save or action fails: no connection, or a role that lost menu.manage. */
  failing: 'none' | 'network' | 'forbidden';
}

function start(over: Partial<CoursesStart> & { name: string; note: string }): CoursesStart {
  return {
    courses: sampleCourses(),
    manage: true,
    opened: null,
    asking: null,
    refused: null,
    said: '',
    system: 'none',
    failing: 'none',
    ...over,
  };
}

const MAIN = 'k2';

const STATES = {
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
      note: 'Milk ticked on Jollof rice, which guests have picked. Press Save changes: never refused, and the line counts who has Milk recorded.',
      opened: {
        kind: 'editDish',
        courseId: MAIN,
        dishId: 'k2-jollof',
        form: { allergens: ['milk', 'celery'] },
      },
    }),
  editDishAllergenSaved: () => {
    const all = sampleCourses();
    const main = all[1] as EvCourse;
    const jollof = main.dishes[0] as EvDish;
    const contains: DishAllergen[] = ['milk', 'celery'];

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
  menuReadOnly: () =>
    start({
      name: 'Read only, without menu.manage',
      note: 'Every course and dish as text, and no controls.',
      manage: false,
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
    start({ name: 'Without menu.read, 403', note: 'The page is refused.', system: 'noAccess' }),
  gone: () =>
    start({
      name: 'Another organisation’s event, 404',
      note: 'This event is not available.',
      system: 'gone',
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
      ['menu', 'loading', 'empty', 'courseMoved', 'menuReadOnly', 'emptyReadOnly'] as const
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
      ['addDish', 'addDishNoMatch', 'addDishSame', 'addDishNew', 'addDishNewBlank'] as const
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
