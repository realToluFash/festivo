import type { Allergen } from './guestKitchenWords.ts';
import { type DishAllergen, type Lang, DISH_ALLERGENS, allergenName } from './menuLibrary.ts';
import type { DemoLink } from './settings.ts';
import { EARLIER, type Person, type Saved, type SummaryStart } from './mealClose.ts';

/** sc-3904's questions inside a dish on the guest's meal step (board MealStep, page e32): the way, then each choice, one per screen. */
export type MealContains = readonly DishAllergen[] | 'none';

export interface MealOption {
  id: string;
  name: string;
  contains: MealContains;
}

export interface MealChoice {
  id: string;
  question: string;
  pick: number;
  required: boolean;
  options: readonly MealOption[];
}

export interface MealDish {
  id: string;
  name: string;
  desc: string;
  contains: MealContains;
  /** The ways guests pick from; a Children only variant is never offered. */
  ways: readonly MealOption[];
  choices: readonly MealChoice[];
}

export interface MealCourse {
  name: string;
  set: boolean;
  skip: boolean;
  dishes: readonly MealDish[];
}

export type Screen =
  | { kind: 'dish' }
  | { kind: 'way'; dishId: string }
  | { kind: 'choice'; dishId: string; choiceId: string }
  | { kind: 'done' };

export type Recorded = 'chosen' | 'kitchen' | 'skipped' | 'host';

export interface MealAnswer {
  dishId: string | null;
  wayId: string | null;
  picks: Readonly<Record<string, readonly string[] | 'none'>>;
  way: 'chosen' | 'kitchen' | 'skipped' | null;
}

export const PERSON = 'Chidi Okonkwo-Williams';

export const MW = {
  of: (n: number, total: number) => `${n} of ${total}`,
  chooseDish: 'Choose one dish.',
  wayQuestion: (dish: string, ways: readonly MealOption[]) =>
    `${dish} · ${ways.map((one) => one.name).join(' or ')}?`,
  question: (dish: string, question: string) => `${dish} · ${question}`,
  pickExactly: (n: number) => `Pick exactly ${n}.`,
  sameForEither: (dish: string, way: string) =>
    `${dish} with ${way.toLocaleLowerCase('en')}. These options are the same for either way.`,
  sameForEvery: 'These options are the same for every way.',
  noneForMe: 'None for me',
  letKitchen: 'Let the kitchen choose for me',
  noCourse: (course: string) => `No ${course.toLocaleLowerCase('en')} for me`,
  chooseOne: 'Choose one, so the kitchen knows.',
  pickOrNone: 'Pick one, or None for me.',
  wrongCount: (n: number, had: number) => `Pick exactly ${n}. You’ve picked ${had}.`,
  chooseFor: (course: string, name: string) =>
    `Choose a ${course.toLocaleLowerCase('en')} for ${name}, or let the kitchen choose.`,
  allergicTo: (name: string, allergens: string) => `${name} is allergic to: ${allergens}.`,
  hostLine: (name: string) => `The host can arrange a dish for ${name} with you.`,
  nothingSafe: (name: string) =>
    `None of these can be picked for ${name}. The host will be in touch.`,
  contains: (allergens: string) => `Contains: ${allergens}`,
  containsNone: 'Contains none of the 14 allergens',
  noneOf14: 'none of the 14 allergens',
  pickWayNext: '[Each way has its own allergens. You pick the way next.]',
  allergy: 'Allergy',
  back: 'Back',
  next: 'Next',
  recorded: (course: string, how: string) => `${course} is recorded as ${how}.`,
  howChosen: (parts: string) => `chosen: ${parts}`,
  howKitchen: 'chef’s choice',
  howSkipped: 'skipped',
  howHost: 'needs the host',
  again: 'Start this step again',
} as const;

export const allergenList = (codes: readonly DishAllergen[], lang: Lang): string =>
  DISH_ALLERGENS.filter((code) => codes.includes(code))
    .map((code) => allergenName(code, lang).toLocaleLowerCase(lang))
    .join(', ');

export function containsLine(contains: MealContains, lang: Lang): string {
  return contains === 'none' ? MW.containsNone : MW.contains(allergenList(contains, lang));
}

const codesOf = (contains: MealContains): readonly DishAllergen[] =>
  contains === 'none' ? [] : contains;

/** The allergens of the person that something contains, in Annex II order; empty when it can be picked. */
export function ruledOutBy(contains: MealContains, allergies: readonly Allergen[]): DishAllergen[] {
  return DISH_ALLERGENS.filter(
    (code) => codesOf(contains).includes(code) && allergies.includes(code as Allergen),
  );
}

export const dishOf = (course: MealCourse, id: string | null): MealDish | null =>
  course.dishes.find((one) => one.id === id) ?? null;

export const asksWay = (dish: MealDish): boolean => dish.ways.length >= 2;

/** The screens a course asks, in order: the dish unless the course is set, the way where there are two, then each choice. */
export function screensOf(course: MealCourse, answer: MealAnswer): Screen[] {
  const dish = course.set ? (course.dishes[0] ?? null) : dishOf(course, answer.dishId);
  const head: Screen[] = course.set ? [] : [{ kind: 'dish' }];
  if (dish == null) return [...head, { kind: 'done' }];

  return [
    ...head,
    ...(asksWay(dish) ? [{ kind: 'way', dishId: dish.id } as const] : []),
    ...dish.choices.map((one) => ({ kind: 'choice', dishId: dish.id, choiceId: one.id }) as const),
    { kind: 'done' },
  ];
}

/** The dish itself is ruled out, or a required choice has fewer options left than guests must pick. */
export function nothingSafe(dish: MealDish, allergies: readonly Allergen[]): boolean {
  if (ruledOutBy(dish.contains, allergies).length > 0) return true;
  if (
    dish.ways.length > 0 &&
    dish.ways.every((one) => ruledOutBy(one.contains, allergies).length > 0)
  )
    return true;

  return dish.choices.some(
    (choice) =>
      choice.required &&
      choice.options.filter((one) => ruledOutBy(one.contains, allergies).length === 0).length <
        choice.pick,
  );
}

/** What Next refuses on a screen, or null. On a set course's first screen, nothing chosen asks for the course or the kitchen. */
export function refusalOf(
  screen: Screen,
  course: MealCourse,
  answer: MealAnswer,
  first: boolean,
): string | null {
  if (answer.way === 'kitchen' || answer.way === 'skipped') return null;
  const setFirst = course.set && first;
  if (screen.kind === 'dish') return answer.dishId == null ? MW.chooseOne : null;
  if (screen.kind === 'way') {
    if (answer.wayId != null) return null;

    return setFirst ? MW.chooseFor(course.name, PERSON) : MW.chooseOne;
  }
  if (screen.kind !== 'choice') return null;
  const choice = dishOf(course, screen.dishId)?.choices.find((one) => one.id === screen.choiceId);
  if (choice == null) return null;
  const picked = answer.picks[choice.id];
  if (picked === 'none') return null;
  const had = picked?.length ?? 0;
  if (had === 0) {
    if (setFirst) return MW.chooseFor(course.name, PERSON);

    return choice.required ? MW.chooseOne : MW.pickOrNone;
  }

  return had === choice.pick ? null : MW.wrongCount(choice.pick, had);
}

/** The dish card's Contains once answered: the way's allergens plus the picked options', with each source on its own line. */
export function cardLines(
  dish: MealDish,
  answer: MealAnswer,
  lang: Lang,
): { contains: string; sources: string[] } | null {
  if (answer.dishId !== dish.id) return null;
  const way = dish.ways.find((one) => one.id === answer.wayId) ?? null;
  const parts: { name: string; contains: MealContains }[] = [
    way == null
      ? { name: dish.name, contains: dish.contains }
      : { name: `${dish.name} with ${way.name.toLocaleLowerCase('en')}`, contains: way.contains },
    ...dish.choices.flatMap((choice) => {
      const picked = answer.picks[choice.id];
      if (picked == null || picked === 'none') return [];

      return choice.options.filter((one) => picked.includes(one.id));
    }),
  ];
  const all = DISH_ALLERGENS.filter((code) =>
    parts.some((one) => codesOf(one.contains).includes(code)),
  );

  return {
    contains: all.length === 0 ? MW.containsNone : MW.contains(allergenList(all, lang)),
    sources: parts.map(
      (one) =>
        `${one.name} · ${one.contains === 'none' ? MW.noneOf14 : allergenList(one.contains, lang)}`,
    ),
  };
}

export function recordedOf(course: MealCourse, answer: MealAnswer, host: boolean): string {
  if (host) return MW.recorded(course.name, MW.howHost);
  if (answer.way === 'kitchen') return MW.recorded(course.name, MW.howKitchen);
  if (answer.way === 'skipped') return MW.recorded(course.name, MW.howSkipped);
  const dish = course.set ? course.dishes[0] : dishOf(course, answer.dishId);
  if (dish == null) return MW.recorded(course.name, MW.howSkipped);
  const way = dish.ways.find((one) => one.id === answer.wayId);
  const picks = dish.choices.map((choice) => {
    const picked = answer.picks[choice.id];
    if (picked === 'none') return MW.noneForMe;

    return choice.options
      .filter((one) => picked?.includes(one.id))
      .map((one) => one.name)
      .join(' and ');
  });

  return MW.recorded(
    course.name,
    MW.howChosen(
      [dish.name, way?.name, ...picks].filter((one) => one != null && one !== '').join(', '),
    ),
  );
}

const option = (id: string, name: string, contains: MealContains): MealOption => ({
  id,
  name,
  contains,
});

const SIDE: MealChoice = {
  id: 'side',
  question: 'And a side?',
  pick: 1,
  required: true,
  options: [
    option('plantain', 'Plantain', 'none'),
    option('salad', 'Garden salad', ['mustard']),
    option('moimoi', 'Moi moi', ['eggs']),
  ],
};

const SAUCE: MealChoice = {
  id: 'sauce',
  question: 'And a sauce?',
  pick: 1,
  required: false,
  options: [option('shito', 'Shito', ['crustaceans', 'fish']), option('ata', 'Ata dindin', 'none')],
};

const TWO_SIDES: MealChoice = { ...SIDE, id: 'sides', question: 'And two sides?', pick: 2 };

const JOLLOF: MealDish = {
  id: 'jollof',
  name: 'Jollof rice',
  desc: 'Long-grain rice cooked in a tomato and pepper base.',
  contains: 'none',
  ways: [option('chicken', 'Chicken', 'none'), option('fish', 'Fish', ['fish'])],
  choices: [SIDE, SAUCE],
};

const COCONUT: MealDish = {
  id: 'coconut',
  name: 'Coconut rice',
  desc: 'Rice cooked in coconut milk.',
  contains: 'none',
  ways: [],
  choices: [],
};

const SHORT_RIB: MealDish = {
  id: 'rib',
  name: 'Short rib',
  desc: 'Braised beef short rib in pepper sauce, cooked for six hours.',
  contains: ['celery'],
  ways: [],
  choices: [SIDE, SAUCE],
};

const CHOOSE: MealCourse = { name: 'Main', set: false, skip: false, dishes: [JOLLOF, COCONUT] };
const SET: MealCourse = { name: 'Main', set: true, skip: true, dishes: [SHORT_RIB] };
const SET_WAYS: MealCourse = { ...SET, dishes: [{ ...JOLLOF, choices: [SIDE] }] };
const SET_TWO: MealCourse = { ...SET, dishes: [{ ...SHORT_RIB, choices: [TWO_SIDES, SAUCE] }] };

const BLANK: MealAnswer = { dishId: null, wayId: null, picks: {}, way: null };

export interface MealStart {
  name: string;
  note: string;
  course: MealCourse;
  n: number;
  total: number;
  allergies: readonly Allergen[];
  answer: MealAnswer;
  at: number;
  pressed: boolean;
  /** Picks close, sc-3905's line, on a course guests see. */
  closes: boolean;
  /** sc-3905: coming back to the step, a row per course with its close. */
  summary?: SummaryStart;
}

function start(over: Partial<MealStart> & { name: string; note: string }): MealStart {
  return {
    course: CHOOSE,
    n: 2,
    total: 3,
    allergies: [],
    answer: BLANK,
    at: 0,
    pressed: false,
    closes: true,
    ...over,
  };
}

const JOLLOF_PICKED: MealAnswer = { ...BLANK, dishId: 'jollof', way: 'chosen' };
const FISH: MealAnswer = { ...JOLLOF_PICKED, wayId: 'fish' };

const STATES = {
  variant: () =>
    start({
      name: 'The way',
      note: 'Jollof rice picked: “Chicken or fish?”, each a card with its Contains. Children only variants aren’t offered.',
      answer: JOLLOF_PICKED,
      at: 1,
    }),
  variantBlank: () =>
    start({
      name: 'The way, Next with nothing chosen',
      note: 'Refused: a red edge on the ways, focus on the first.',
      answer: JOLLOF_PICKED,
      at: 1,
      pressed: true,
    }),
  side: () =>
    start({
      name: 'A choice: the side',
      note: '“Jollof rice · And a side?”, Pick exactly 1, the same for either way.',
      answer: FISH,
      at: 2,
    }),
  sideBlank: () =>
    start({
      name: 'The side, Next with nothing chosen',
      note: 'A required choice: “Choose one, so the kitchen knows.”',
      answer: FISH,
      at: 2,
      pressed: true,
    }),
  sauce: () =>
    start({
      name: 'An optional choice: the sauce',
      note: 'None for me under a rule.',
      answer: { ...FISH, picks: { side: ['plantain'] } },
      at: 3,
    }),
  sauceBlank: () =>
    start({
      name: 'The sauce, Next with nothing chosen',
      note: 'An optional choice: “Pick one, or None for me.”',
      answer: { ...FISH, picks: { side: ['plantain'] } },
      at: 3,
      pressed: true,
    }),
  card: () =>
    start({
      name: 'The dish card, answered',
      note: 'Back on the dish screen: Jollof rice reads the fish way’s allergens plus Plantain’s, each source on its own line.',
      answer: { ...FISH, picks: { side: ['plantain'], sauce: 'none' } },
    }),
  cardShito: () =>
    start({
      name: 'The dish card, with Shito',
      note: 'Shito adds crustaceans: “Contains: crustaceans, fish”.',
      answer: { ...FISH, picks: { side: ['plantain'], sauce: ['shito'] } },
    }),
  setChoices: () =>
    start({
      name: 'A set course, choices only',
      note: 'Main is Short rib for everyone: no dish screen, the side first, with Let the kitchen choose for me and No main for me under a rule.',
      course: SET,
      closes: true,
    }),
  setSecond: () =>
    start({
      name: 'A set course, the second choice',
      note: '“Short rib · And a sauce?” on its own screen.',
      course: SET,
      answer: { ...BLANK, way: 'chosen', picks: { side: ['moimoi'] } },
      at: 1,
      closes: true,
    }),
  setVariants: () =>
    start({
      name: 'A set course, variants and choices',
      note: 'Two ways for Everyone: the way is the first screen, then the side.',
      course: SET_WAYS,
      closes: true,
    }),
  setRuledOut: () =>
    start({
      name: 'A set course, an option ruled out',
      note: 'Chidi is allergic to mustard: Garden salad is dashed and greyed, out of the Tab order, with the reason, and the host’s line once.',
      course: SET,
      allergies: ['mustard'],
      closes: true,
    }),
  setNoAnswer: () =>
    start({
      name: 'A set course, no answer',
      note: 'Next with nothing chosen on the first screen.',
      course: SET,
      pressed: true,
      closes: true,
    }),
  setWrongCount: () =>
    start({
      name: 'A set course, the wrong count',
      note: '“And two sides?”, one picked: “Pick exactly 2. You’ve picked 1.”',
      course: SET_TWO,
      answer: { ...BLANK, way: 'chosen', picks: { sides: ['plantain'] } },
      pressed: true,
      closes: true,
    }),
  setNothingSafe: () =>
    start({
      name: 'A set course, nothing safe',
      note: 'Chidi is allergic to celery, which Short rib contains: the host will be in touch, no Let the kitchen choose, and Next records needs the host.',
      course: SET,
      allergies: ['celery'],
      closes: true,
    }),
  courseOfDrafts: () =>
    start({
      name: 'A course of drafts is no screen',
      note: 'Dessert waits on draft choices, so it is left out: Main reads 2 of 2, with no Picks close line for Dessert.',
      total: 2,
    }),
} satisfies Record<string, () => MealStart>;

function back(over: Partial<SummaryStart> & { name: string; note: string }): MealStart {
  const { name, note, ...summary } = over;

  return start({
    name,
    note,
    summary: {
      today: '2026-10-14',
      saved: EARLIER,
      changed: {},
      sendOn: null,
      screen: null,
      ...summary,
    },
  });
}

const CLOSE_STATES = {
  picksOpen: () =>
    back({
      name: 'Picks open, coming back',
      note: 'Today is Wednesday, Oct 14. A row per course with its pick, “Picks close {date}.” with the clock, and Change. Change opens the course’s screen; a change reads [Not sent yet] until [Send my changes] sends it. Send with nothing changed sends nothing.',
    }),
  oneClosed: () =>
    back({
      name: 'One course closed',
      note: 'Today is Saturday, Oct 17. Starter closed on Friday, Oct 16 (its own choose-by date, sc-1362’s, sample only): its row is grey, with the padlock and “Picks closed on Friday, Oct 16.”, and no Change.',
      today: '2026-10-17',
    }),
  allClosed: () =>
    back({
      name: 'All courses closed',
      note: 'Today is Tuesday, Oct 20: every row read-only, no send button, and the page says to ask the hosts.',
      today: '2026-10-20',
    }),
  paused: () =>
    back({
      name: 'Paused before Reply by',
      note: 'Today is Saturday, Oct 17 and the host has paused the event: answers are closed while Main and Dessert are still open by date. Under the paused card, Your meal picks stays, every row read-only with its own close line (Starter’s padlock, the others’ clock), no Change and no send button.',
      today: '2026-10-17',
      paused: true,
    }),
  refused: () =>
    back({
      name: 'Refused: Starter had a pick, Main still open',
      note: 'Opened Thursday, Oct 15 with Starter changed to Pepper soup and Main to Grilled croaker, not sent. Press [Send my changes]: it arrives Saturday, Oct 17, the 409 refuses Starter, which keeps Canapé selection with the alert and focus on it; Main is saved and the status line says so.',
      today: '2026-10-15',
      changed: { starter: 'pepper', main: 'croaker' },
      sendOn: '2026-10-17',
    }),
  refusedNoPick: () =>
    back({
      name: 'Refused: Starter had no pick',
      note: 'As Refused, but Chidi had no starter before the send. After the 409 the row shows Starter’s default, Canapé selection, with “You had not chosen by then, so this is your starter.”',
      today: '2026-10-15',
      saved: { ...EARLIER, starter: null },
      changed: { starter: 'pepper', main: 'croaker' },
      sendOn: '2026-10-17',
    }),
  refusedClosedToo: () =>
    back({
      name: 'Refused: Main closed too',
      note: 'The send arrives Tuesday, Oct 20, past the reply-by date: both rows refused, each with its own line, Main keeping Jollof rice, focus on Starter’s, no status line, and every course now closed, so no send button.',
      today: '2026-10-15',
      changed: { starter: 'pepper', main: 'croaker' },
      sendOn: '2026-10-20',
    }),
  refusedOnly: () =>
    back({
      name: 'Refused: nothing else in the send',
      note: 'Only Starter was changed: the alert, and no status line.',
      today: '2026-10-15',
      changed: { starter: 'pepper' },
      sendOn: '2026-10-17',
    }),
  courseClosed: () =>
    back({
      name: 'A course screen, closed',
      note: 'Today is Saturday, Oct 17. Starter’s screen: [Your starter], the pick as a card and the padlock line, no options and no Let the kitchen choose. Next goes on to Main, still open.',
      today: '2026-10-17',
      screen: 'starter',
    }),
} satisfies Record<string, () => MealStart>;

const UNANSWERED: Saved = { ...EARLIER, starter: null };
const SESAME: Person = { name: PERSON, companion: false, allergies: ['sesame'], diets: [] };

const DEFAULT_STATES = {
  chooseByBefore: () =>
    back({
      name: 'Choose by, before the date',
      note: 'Today is Wednesday, Oct 14 and Chidi has not answered Starter, whose default is Canapé selection: its screen says the default will be waiting. Choosing a dish brings back “Picks close Friday, Oct 16.”',
      saved: UNANSWERED,
      screen: 'starter',
    }),
  chooseByBack: () =>
    back({
      name: 'Choose by, coming back',
      note: 'The rows on coming back: Starter’s row carries the choose-by line until Chidi answers it. Change, pick and send to see it go back to sc-3905’s line.',
      saved: UNANSWERED,
    }),
  chooseByCompanion: () =>
    back({
      name: 'Choose by, a companion',
      note: 'Kofi, covered by Chidi’s reply: the line names Kofi, with no pronoun.',
      saved: UNANSWERED,
      person: { name: 'Kofi', companion: true, allergies: [], diets: [] },
    }),
  excludedBefore: () =>
    back({
      name: 'Excluded, before the date',
      note: 'Chidi has a sesame allergy recorded, so is never given the default: Starter’s row says only “Picks close Friday, Oct 16.” This sample’s Canapé selection claims no Suitable for, unlike the Menu sample’s Pescatarian, so a recorded diet would exclude Chidi as well.',
      saved: UNANSWERED,
      person: SESAME,
    }),
  excludedAfter: () =>
    back({
      name: 'Excluded, after the date',
      note: 'Today is Saturday, Oct 17, the allergy recorded and Starter never answered: read-only with the padlock, no dish, no Change, and the host will be in touch.',
      today: '2026-10-17',
      saved: UNANSWERED,
      person: SESAME,
    }),
  refusedExcluded: () =>
    back({
      name: 'Refused: Starter had no pick, and Chidi is excluded',
      note: 'As Refused: Starter had no pick, but Chidi has a sesame allergy recorded, so was never given the default. After the 409 the row shows no dish, the needs-the-host mark and “The host will be in touch about it.” in place of the default.',
      today: '2026-10-15',
      saved: UNANSWERED,
      person: SESAME,
      changed: { starter: 'pepper', main: 'croaker' },
      sendOn: '2026-10-17',
    }),
  defaulted: () =>
    back({
      name: 'Defaulted',
      note: 'Today is Saturday, Oct 17 and Chidi never answered Starter: the row shows the default, Canapé selection, and “You had not chosen by then, so this is your starter.” Main is still open.',
      today: '2026-10-17',
      saved: UNANSWERED,
    }),
} satisfies Record<string, () => MealStart>;

export type MealStateName = keyof typeof STATES;

export type CloseStateName = keyof typeof CLOSE_STATES | keyof typeof DEFAULT_STATES;

const ALL = { ...STATES, ...CLOSE_STATES, ...DEFAULT_STATES };

export const isMealState = (raw: string | null): raw is MealStateName | CloseStateName =>
  raw != null && Object.hasOwn(ALL, raw);

export const mealStart = (state: MealStateName | CloseStateName): MealStart => ALL[state]();

export const mealAt = (state: MealStateName | CloseStateName): string =>
  `/demo/guest/meal?state=${state}`;

export const MEAL_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The way and each choice, one per screen',
    states: (Object.keys(STATES) as MealStateName[]).map((state) => ({
      to: mealAt(state),
      name: STATES[state]().name,
    })),
  },
  {
    name: 'When picks close (sc-3905)',
    states: (Object.keys(CLOSE_STATES) as (keyof typeof CLOSE_STATES)[]).map((state) => ({
      to: mealAt(state),
      name: CLOSE_STATES[state]().name,
    })),
  },
  {
    name: 'A default and a choose-by date (sc-1362)',
    states: (Object.keys(DEFAULT_STATES) as (keyof typeof DEFAULT_STATES)[]).map((state) => ({
      to: mealAt(state),
      name: DEFAULT_STATES[state]().name,
    })),
  },
];
