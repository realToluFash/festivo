import type { Allergen } from './guestKitchenWords.ts';
import { type Diet, type DishAllergen, type Lang, DISH_ALLERGENS } from './menuLibrary.ts';
import { allergenList } from './mealStep.ts';
import { coursesAt } from './menuCourses.ts';
import { type PicksDates, SAMPLE_PICKS, closeOf } from './picksClose.ts';
import { SAMPLE } from './rules.ts';
import type { DemoLink } from './settings.ts';

/** sc-3907's meal step for each person coming (board MealStep, page e32): person by person, course by course, then Check and send. */
export type Who = 'me' | 'chidi' | 'isabela' | 'kemi' | 'tom';
export type CourseKey = 'starter' | 'main' | 'dessert';
export type RowKey = `${Who}|${CourseKey}`;

export interface PartyPerson {
  key: Who;
  name: string;
  you: boolean;
}

export interface PartyDish {
  id: string;
  name: string;
  desc: string;
  diets: readonly Diet[];
  /** null is Allergens not stated. */
  contains: readonly DishAllergen[] | 'none' | null;
}

export interface PartyCourse {
  key: CourseKey;
  name: string;
  skip: boolean;
  dishes: readonly PartyDish[];
}

export type PartyAnswer =
  | { kind: 'chosen'; dishId: string; by: 'guest' | 'host' }
  | { kind: 'kitchen' }
  | { kind: 'skipped' }
  | { kind: 'host' }
  | MenuChanged;

/** sc-3913: the host changed the menu after this pick. The course is asked again, and the pick is kept by the dish's name as picked. */
export type MenuChanged = { kind: 'changed'; dish: string } & (
  { why: 'removed' } | { why: 'ways'; ways: number } | { why: 'choices' }
);

export const isChanged = (answer: PartyAnswer | undefined): answer is MenuChanged =>
  answer?.kind === 'changed';

export type Answers = Readonly<Partial<Record<RowKey, PartyAnswer>>>;
export type Allergies = Readonly<Record<Who, readonly Allergen[]>>;

export const rowKey = (who: Who, course: CourseKey): RowKey => `${who}|${course}`;

export const PARTY: readonly PartyPerson[] = [
  { key: 'me', name: 'Maria Fernanda Albuquerque Santos', you: true },
  { key: 'chidi', name: 'Chidi Okonkwo-Williams', you: false },
  { key: 'isabela', name: 'Isabela Cristina Alves Ribeiro', you: false },
  { key: 'kemi', name: 'Kemi', you: false },
  { key: 'tom', name: 'Tom', you: false },
];

export const HOSTS = 'Amara and Tomi';

const dish = (
  id: string,
  name: string,
  desc: string,
  diets: readonly Diet[],
  contains: PartyDish['contains'],
): PartyDish => ({ id, name, desc, diets, contains });

export const COURSES: readonly PartyCourse[] = [
  {
    key: 'starter',
    name: 'Starter',
    skip: false,
    dishes: [
      dish(
        'canape',
        'Canapé selection',
        'Small bites of puff-puff, suya and plantain.',
        [],
        ['gluten', 'peanuts', 'sesame'],
      ),
      dish('pepper', 'Pepper soup', 'Goat meat in a light, spiced broth.', ['halal'], 'none'),
      dish('gizdodo', 'Gizdodo', 'Gizzards and ripe plantain in pepper sauce.', ['halal'], null),
    ],
  },
  {
    key: 'main',
    name: 'Main',
    skip: false,
    dishes: [
      dish(
        'jollof',
        'Jollof rice',
        'Long-grain rice cooked in a tomato and pepper base.',
        ['vegetarian', 'vegan', 'halal'],
        ['celery'],
      ),
      dish(
        'egusi',
        'Pounded yam and egusi',
        'Melon seed soup with stockfish and spinach, cooked with a little cream.',
        ['halal'],
        ['fish', 'milk'],
      ),
      dish(
        'croaker',
        'Grilled croaker',
        'Whole croaker grilled with pepper and onion.',
        ['pescatarian', 'halal'],
        ['fish'],
      ),
    ],
  },
  {
    key: 'dessert',
    name: 'Dessert',
    skip: true,
    dishes: [
      dish(
        'chinchin',
        'Chin chin',
        'Crunchy fried dough with nutmeg.',
        ['vegetarian'],
        ['gluten', 'eggs', 'milk'],
      ),
      dish(
        'icecream',
        'Vanilla ice cream',
        'Made in the kitchen that morning.',
        ['vegetarian'],
        ['eggs', 'milk'],
      ),
      dish(
        'coconut',
        'Coconut cake',
        'A light sponge with toasted coconut.',
        ['vegetarian'],
        ['gluten', 'eggs'],
      ),
    ],
  },
];

export const courseOf = (key: CourseKey): PartyCourse =>
  COURSES.find((one) => one.key === key) as PartyCourse;

export const personOf = (key: Who): PartyPerson =>
  PARTY.find((one) => one.key === key) as PartyPerson;

export const dishOf = (course: CourseKey, id: string): PartyDish | null =>
  courseOf(course).dishes.find((one) => one.id === id) ?? null;

const lower = (words: string) => words.toLocaleLowerCase('en');

const sameAs = (from: PartyPerson) => (from.you ? 'Same as mine' : `Same as ${from.name}`);

export const PW = {
  forWho: (person: PartyPerson) => (person.you ? 'For you' : `For ${person.name}`),
  forWhoLegend: (person: PartyPerson, course: string, n: number, total: number) =>
    `${person.you ? 'For you' : `For ${person.name}`}, ${course}, ${n} of ${total}.`,
  of: (n: number, total: number) => `${n} of ${total}`,
  which: (course: string) => `Which ${lower(course)}?`,
  suitableFor: 'Suitable for',
  contains: (list: string) => `Contains: ${list}`,
  containsNone: 'Contains none of the 14 allergens',
  notStated: 'Allergens not stated',
  allergy: 'Allergy',
  allergicTo: (person: PartyPerson, list: string) =>
    person.you ? `You are allergic to: ${list}.` : `${person.name} is allergic to: ${list}.`,
  notStatedReason: (person: PartyPerson) =>
    `The kitchen hasn’t said what’s in this, so it can’t be picked for ${person.you ? 'you' : person.name}.`,
  hostLine: (person: PartyPerson) =>
    person.you
      ? '[The host can arrange a dish for you.]'
      : `The host can arrange a dish for ${person.name} with you.`,
  nothingSafe: (person: PartyPerson) =>
    `None of these can be picked for ${person.you ? 'you' : person.name}. The host will be in touch.`,
  other: (person: PartyPerson, allergy: string) =>
    person.you
      ? `[Your ${lower(allergy)} allergy isn’t checked against the menu. The host will confirm.]`
      : `${person.name}’s ${lower(allergy)} allergy isn’t checked against the menu. The host will confirm.`,
  cleared: (person: PartyPerson, dishName: string, list: string) =>
    `[Your pick for ${person.you ? 'you' : person.name}, ${dishName}, was cleared because it contains ${list}.]`,
  letKitchen: 'Let the kitchen choose for me',
  noCourse: (course: string) => `No ${lower(course)} for me`,
  chooseFor: (course: string, person: PartyPerson) =>
    `Choose a ${lower(course)} for ${person.you ? 'you' : person.name}, or let the kitchen choose.`,
  back: 'Back',
  next: 'Next',
  kitchenTitle: 'Anything the kitchen must know?',
  kitchenStandIn:
    'The kitchen note is sc-3778’s, drawn on page 30 · Guests. It stands in here so Back has somewhere to land and Change on its row has somewhere to open.',
  kitchenDemo: 'Demo only: give an allergy on the kitchen note',
  kitchenAllergy: (person: PartyPerson, allergy: string) =>
    person.you ? `You: ${lower(allergy)}` : `${person.name}: ${lower(allergy)}`,
  check: 'Check and send',
  yourAnswer: 'Your answer',
  coming: 'Coming',
  whoComing: 'Who’s coming',
  party: (names: readonly string[]) =>
    names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`,
  kitchenRow: 'For the kitchen',
  kitchenNothing: '[Nothing for the kitchen.]',
  kitchenWho: (person: PartyPerson) => (person.you ? 'You' : person.name),
  allergyIs: (list: string) => `Allergy: ${list}`,
  changeKitchen: 'Change what the kitchen must know',
  checkMeals: '[Check your meal picks]',
  hostsGet: `This is what ${HOSTS} will get.`,
  picksClose: (date: string) => `Picks close ${date}.`,
  picksClosed: (date: string) => `Picks closed on ${date}.`,
  yourMeals: 'Your meals',
  theirMeals: (name: string) => `${name}’s meals`,
  change: 'Change',
  changeAria: (course: string, person: PartyPerson) =>
    `Change ${lower(course)} for ${person.you ? 'you' : person.name}`,
  kitchenChooses: '[The kitchen will choose]',
  skipped: (course: string) => `[No ${lower(course)}]`,
  hostInTouch: 'The host will be in touch',
  hostInTouchLine: 'The host will be in touch.',
  marked: (n: number) =>
    n === 1
      ? '[A pick contains an allergen. Change it before you send.]'
      : `[${n} picks contain an allergen. Change them before you send.]`,
  send: 'Send my answer',
  sendChanges: '[Send my changes]',
  sent: '[Your answer is sent.]',
  yourPicks: '[Your meal picks]',
  savedUntil: (date: string) => `[Saved. You can change them until ${date}.]`,
  notSent: '[Not sent yet]',
  nothingToSend: '[Nothing has changed, so there is nothing to send.]',
  changesSaved: '[Your changes are saved.]',
  preview: 'Preview. Nothing is saved.',
  closePreview: 'Close preview',
  again: 'Start this state again',
  sameAs,
  sameAsName: (from: PartyPerson, to: PartyPerson) =>
    `${sameAs(from)}, for ${to.you ? 'you' : to.name}`,
  cantCopy: (from: PartyPerson, course: string, to: PartyPerson) =>
    `${from.you ? 'Your' : `${from.name}’s`} ${lower(course)} can’t be picked for ${to.you ? 'you' : to.name}.`,
  copiedFrom: (from: PartyPerson) =>
    from.you
      ? 'Copied from your picks. Change anything that should be different.'
      : `Copied from ${from.name}. Change anything that should be different.`,
  continue: 'Continue',
  pickNew: (course: string) => `Pick a new ${lower(course)}`,
  menuChanged: 'Menu changed',
  changedLine: (person: PartyPerson, answer: MenuChanged) => {
    const who = person.you ? 'You' : `[${person.name}`;
    const end = person.you ? '' : ']';
    if (answer.why === 'removed')
      return `${who} picked ${answer.dish}, which is no longer on the menu.${end}`;
    if (answer.why === 'ways')
      return `${who} picked ${answer.dish}, which now comes ${answer.ways} ways.${end}`;

    return `${who} picked ${answer.dish}, and its choices have changed.${end}`;
  },
  changedOpen: (n: number) =>
    n === 1
      ? '[The menu changed for a pick. Pick again before you send.]'
      : `[The menu changed for ${n} picks. Pick again before you send.]`,
} as const;

export type Ruled = { kind: 'allergen'; codes: DishAllergen[] } | { kind: 'notStated' } | null;

/** Why a dish can't be picked for a person: the allergens of theirs it contains, in Annex II order, or that it states none while they have one of the 14. */
export function ruledOut(one: PartyDish, allergies: readonly Allergen[]): Ruled {
  const theirs = DISH_ALLERGENS.filter((code) => allergies.includes(code as Allergen));
  if (one.contains == null) return theirs.length > 0 ? { kind: 'notStated' } : null;
  if (one.contains === 'none') return null;
  const codes = theirs.filter((code) => (one.contains as readonly DishAllergen[]).includes(code));

  return codes.length > 0 ? { kind: 'allergen', codes } : null;
}

export function reasonOf(ruled: Ruled, person: PartyPerson, lang: Lang): string | null {
  if (ruled == null) return null;
  if (ruled.kind === 'notStated') return PW.notStatedReason(person);

  return PW.allergicTo(person, allergenList(ruled.codes, lang));
}

export const nothingSafe = (course: PartyCourse, allergies: readonly Allergen[]): boolean =>
  course.dishes.every((one) => ruledOut(one, allergies) != null);

export interface MealScreen {
  who: Who;
  course: CourseKey;
  n: number;
  total: number;
}

export const EVERYONE: readonly Who[] = ['me', 'chidi'];

export const partyOf = (people: readonly Who[]): readonly PartyPerson[] =>
  PARTY.filter((one) => people.includes(one.key));

export const screensOf = (people: readonly Who[]): readonly MealScreen[] =>
  partyOf(people).flatMap((person) =>
    COURSES.map((course, at) => ({
      who: person.key,
      course: course.key,
      n: at + 1,
      total: COURSES.length,
    })),
  );

export const SCREENS: readonly MealScreen[] = screensOf(EVERYONE);

export const screenAt = (
  who: Who,
  course: CourseKey,
  screens: readonly MealScreen[] = SCREENS,
): number => screens.findIndex((one) => one.who === who && one.course === course);

/** sc-3913: the screens a Menu changed visit walks, in party order: only the changed courses still open, of only the people they changed. */
export const changedRoute = (
  answers: Answers,
  screens: readonly MealScreen[],
  closed: (course: CourseKey) => boolean,
): number[] =>
  screens.flatMap((one, at) =>
    isChanged(answers[rowKey(one.who, one.course)]) && !closed(one.course) ? [at] : [],
  );

export interface ClearedPick {
  dishId: string;
  codes: readonly DishAllergen[];
}

export type Cleared = Readonly<Partial<Record<RowKey, ClearedPick>>>;

export const allergyList = (allergies: readonly Allergen[], lang: Lang): string =>
  allergenList(
    DISH_ALLERGENS.filter((code) => allergies.includes(code as Allergen)),
    lang,
  );

export function clearRuledOut(
  answers: Answers,
  allergies: Allergies,
  screens: readonly MealScreen[],
): { answers: Answers; cleared: Cleared } {
  const next: Partial<Record<RowKey, PartyAnswer>> = { ...answers };
  const cleared: Partial<Record<RowKey, ClearedPick>> = {};
  for (const { who, course } of screens) {
    const key = rowKey(who, course);
    const answer = answers[key];
    if (answer?.kind !== 'chosen' || answer.by === 'host') continue;
    const picked = dishOf(course, answer.dishId);
    const ruled = picked == null ? null : ruledOut(picked, allergies[who]);
    if (ruled == null) continue;
    delete next[key];
    cleared[key] = { dishId: answer.dishId, codes: ruled.kind === 'allergen' ? ruled.codes : [] };
  }

  return { answers: next, cleared };
}

/** The reason a guest's own pick now contains one of that person's allergens; a pick the host made is never marked. */
export function markOf(
  key: RowKey,
  answers: Answers,
  allergies: Allergies,
  lang: Lang,
): string | null {
  const answer = answers[key];
  if (answer?.kind !== 'chosen' || answer.by === 'host') return null;
  const [who, course] = key.split('|') as [Who, CourseKey];
  const picked = dishOf(course, answer.dishId);

  return picked == null ? null : reasonOf(ruledOut(picked, allergies[who]), personOf(who), lang);
}

export function markedOpen(
  answers: Answers,
  allergies: Allergies,
  closed: (course: CourseKey) => boolean,
  lang: Lang,
  screens: readonly MealScreen[],
): RowKey[] {
  return screens
    .map(({ who, course }) => rowKey(who, course))
    .filter(
      (key) =>
        !closed(key.split('|')[1] as CourseKey) && markOf(key, answers, allergies, lang) != null,
    );
}

export const sameAnswer = (a: PartyAnswer | undefined, b: PartyAnswer | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const sameAllergies = (a: readonly Allergen[], b: readonly Allergen[]): boolean =>
  a.length === b.length && a.every((one) => b.includes(one));

export const NO_ALLERGIES: Allergies = { me: [], chidi: [], isabela: [], kemi: [], tom: [] };

export const mapWho = (of: (who: Who) => readonly Allergen[]): Allergies => ({
  me: of('me'),
  chidi: of('chidi'),
  isabela: of('isabela'),
  kemi: of('kemi'),
  tom: of('tom'),
});

/** sc-17283: whether one person's answer on a course can be copied to another, under sc-3907's allergy rule. */
export function copyable(
  answer: PartyAnswer | undefined,
  course: PartyCourse,
  allergies: readonly Allergen[],
): boolean {
  if (answer == null) return false;
  if (answer.kind === 'kitchen') return !nothingSafe(course, allergies);
  if (answer.kind === 'skipped') return course.skip;
  if (answer.kind === 'host' || answer.kind === 'changed') return false;
  const picked = dishOf(course.key, answer.dishId);

  return picked != null && ruledOut(picked, allergies) == null;
}

export interface Copied {
  answers: Answers;
  /** The courses not copied, in course order: asked straight after the press. */
  asked: CourseKey[];
}

/** Same as {name}: every open course of `to` takes `from`'s answer where it can be picked, and is cleared where it can't. */
export function copyAnswers(
  answers: Answers,
  from: Who,
  to: Who,
  allergies: readonly Allergen[],
  closed: (course: CourseKey) => boolean,
): Copied {
  const next: Partial<Record<RowKey, PartyAnswer>> = { ...answers };
  const asked: CourseKey[] = [];
  for (const course of COURSES) {
    if (closed(course.key)) continue;
    const source = answers[rowKey(from, course.key)];
    const key = rowKey(to, course.key);
    if (source != null && copyable(source, course, allergies)) {
      next[key] =
        source.kind === 'chosen'
          ? { kind: 'chosen', dishId: source.dishId, by: 'guest' }
          : { ...source };
      continue;
    }
    delete next[key];
    asked.push(course.key);
  }

  return { answers: next, asked };
}

export const ONE_CLOSE: PicksDates = { ...SAMPLE_PICKS };
export const MAIN_FIRST: PicksDates = {
  ...SAMPLE_PICKS,
  today: '2026-10-17',
  own: { main: '2026-10-16' },
};

export const oneDate = (dates: PicksDates): boolean =>
  new Set(COURSES.map((one) => closeOf(one.key, dates).on)).size === 1;

export interface CopyMade {
  who: Who;
  from: Who;
  asked: readonly CourseKey[];
}

export interface PartyStart {
  name: string;
  note: string;
  /** Who is coming; Preview as guest runs the host alone, as For you. */
  people: readonly Who[];
  /** The person replying's full name: the guest's, or in Preview as guest the signed-in host's. */
  you: string;
  mode: 'reply' | 'back';
  /** What is recorded (sc-3777) before this answer. */
  recorded: Allergies;
  /** What the kitchen note adds in this answer. */
  added: Allergies;
  /** Others the kitchen note names: never matched against the menu. */
  other: Partial<Record<Who, string>>;
  answers: Answers;
  /** On coming back, what was saved before; a row differing from it is not sent yet. */
  saved: Answers;
  savedAdded: Allergies;
  view: { kind: 'course'; at: number } | { kind: 'check' } | { kind: 'card' };
  /** sc-17283: a Same as press already made, opening on a course it left unanswered or on the card. */
  copy?: CopyMade;
  cleared: Cleared;
  pressed: boolean;
  dates: PicksDates;
}

const PICKED: Answers = {
  'me|starter': { kind: 'chosen', dishId: 'pepper', by: 'guest' },
  'me|main': { kind: 'kitchen' },
  'me|dessert': { kind: 'skipped' },
  'chidi|starter': { kind: 'chosen', dishId: 'pepper', by: 'guest' },
  'chidi|main': { kind: 'chosen', dishId: 'egusi', by: 'guest' },
  'chidi|dessert': { kind: 'chosen', dishId: 'icecream', by: 'guest' },
};

function without(answers: Answers, ...keys: RowKey[]): Answers {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => !keys.includes(key as RowKey)),
  ) as Answers;
}

const MINE: Answers = without(PICKED, 'chidi|starter', 'chidi|main', 'chidi|dessert');
const HOST_MAIN: Answers = { ...PICKED, 'me|main': { kind: 'host' } };
const FISH_CELERY: Allergies = { ...NO_ALLERGIES, me: ['celery', 'fish'] };
const MILK: Allergies = { ...NO_ALLERGIES, chidi: ['milk'] };
const COCONUT_DESSERT: Answers = {
  ...PICKED,
  'chidi|dessert': { kind: 'chosen', dishId: 'coconut', by: 'guest' },
};

function start(over: Partial<PartyStart> & { name: string; note: string }): PartyStart {
  return {
    people: EVERYONE,
    you: personOf('me').name,
    mode: 'reply',
    recorded: NO_ALLERGIES,
    added: NO_ALLERGIES,
    other: {},
    answers: {},
    saved: {},
    savedAdded: NO_ALLERGIES,
    view: { kind: 'course', at: 0 },
    cleared: {},
    pressed: false,
    dates: ONE_CLOSE,
    ...over,
  };
}

const at = (who: Who, course: CourseKey) =>
  ({ kind: 'course', at: screenAt(who, course) }) as const;

export const PARTY_STATES = {
  preview: () =>
    start({
      name: 'Preview as guest, from the Menu',
      note: 'Opened from Preview as guest on the Menu, with Preview on: the host alone, as For you, with no allergies, on the first meal screen. Back goes to the kitchen note, where an allergy can be tried. Close preview, in the band or at Check and send, goes back to the Menu.',
      people: ['me'],
      you: SAMPLE.name,
    }),
  start: () =>
    start({
      name: 'The first meal screen',
      note: 'For you · Starter · 1 of 3, after the kitchen note: each dish with its Suitable for tags and its Contains line in one of three shapes. Pick, then Next, through both people to Check and send. Back here goes to the kitchen note.',
    }),
  blankRefused: () =>
    start({
      name: 'Next with nothing chosen',
      note: '“Choose a starter for you, or let the kitchen choose.” above the options, a red edge on the enabled ones, focus on the first.',
      pressed: true,
    }),
  ruledOut: () =>
    start({
      name: 'A dish ruled out, and Allergens not stated',
      note: 'Chidi Okonkwo-Williams is allergic to peanuts and sesame: Canapé selection is dashed and greyed with the reason, Gizdodo states no allergens and gives its own reason, both out of the Tab order, and the host’s line shows once below.',
      recorded: { ...NO_ALLERGIES, chidi: ['peanuts', 'sesame'] },
      answers: MINE,
      view: at('chidi', 'starter'),
    }),
  nothingSafe: () =>
    start({
      name: 'Nothing safe on a course',
      note: 'Chidi is allergic to celery and fish: every main is ruled out. The red-outlined box says the host will be in touch, there is no Let the kitchen choose, and Next records needs the host.',
      recorded: { ...NO_ALLERGIES, chidi: ['celery', 'fish'] },
      answers: without(PICKED, 'chidi|main', 'chidi|dessert'),
      view: at('chidi', 'main'),
    }),
  nothingSafeOptional: () =>
    start({
      name: 'Nothing safe, on an optional course',
      note: 'Chidi is allergic to eggs: every dessert is ruled out. No dessert for me is the one answer left; Next without it records needs the host.',
      recorded: { ...NO_ALLERGIES, chidi: ['eggs'] },
      answers: without(PICKED, 'chidi|dessert'),
      view: at('chidi', 'dessert'),
    }),
  otherAllergy: () =>
    start({
      name: 'An Other allergy',
      note: 'Chidi’s kiwi allergy, given as Other: the line on his first course only, and nothing ruled out for it, Gizdodo included.',
      other: { chidi: 'Kiwi' },
      answers: MINE,
      view: at('chidi', 'starter'),
    }),
  backPickCleared: () =>
    start({
      name: 'Back, a pick cleared',
      note: 'The guest went Back to the kitchen note and gave milk for Chidi. Every earlier answer is kept but his main, Pounded yam and egusi, which contains milk: nothing is chosen, the dish is greyed, and the notice says why. Next with nothing chosen is refused.',
      added: MILK,
      answers: without(PICKED, 'chidi|main'),
      cleared: { 'chidi|main': { dishId: 'egusi', codes: ['milk'] } },
      view: at('chidi', 'main'),
    }),
  checkAndSend: () =>
    start({
      name: 'Check and send',
      note: 'The kitchen row above the meal cards, one card per person and one row per course, each with Change. Your starter is chef’s choice, your main needs the host (you are allergic to celery and fish) and your dessert is skipped; Chidi’s are dishes.',
      recorded: FISH_CELERY,
      answers: { ...HOST_MAIN, 'me|starter': { kind: 'kitchen' } },
      view: { kind: 'check' },
    }),
  checkAllergyAdded: () =>
    start({
      name: 'Check and send, an allergy added',
      note: 'Milk given for Chidi by Change on the kitchen row, after his picks: his main is marked, and Send my answer is refused with focus on that row’s Change. Change opens Main with the dish ruled out and nothing chosen.',
      added: MILK,
      answers: COCONUT_DESSERT,
      view: { kind: 'check' },
    }),
  checkAllergyAddedTwo: () =>
    start({
      name: 'Check and send, two picks marked',
      note: 'As above, with his dessert, Vanilla ice cream, marked too: “2 picks contain an allergen.”',
      added: MILK,
      answers: PICKED,
      view: { kind: 'check' },
    }),
  closedAllergyAdded: () =>
    start({
      name: 'A closed course, an allergy added by the host',
      note: 'Today is Saturday, Oct 17. Main closed Friday, Oct 16 (its own date, sample only); Starter and Dessert are open. The host added milk for Chidi since: his main is read-only with the mark, the reason and “The host will be in touch.”, not a change and not refused. Send my changes says nothing has changed.',
      mode: 'back',
      recorded: MILK,
      answers: COCONUT_DESSERT,
      saved: COCONUT_DESSERT,
      dates: MAIN_FIRST,
      view: { kind: 'check' },
    }),
  closedAllergyAddedGuest: () =>
    start({
      name: 'A closed course, an allergy added by the guest',
      note: 'As above, but the guest gave milk by Change on the kitchen row: the kitchen row is the change, with [Not sent yet], and Send my changes saves it.',
      mode: 'back',
      added: MILK,
      answers: COCONUT_DESSERT,
      saved: COCONUT_DESSERT,
      dates: MAIN_FIRST,
      view: { kind: 'check' },
    }),
  closedAllergyAddedOpenToo: () =>
    start({
      name: 'A closed course, and an open pick marked too',
      note: 'The host added milk; his dessert, Vanilla ice cream, is open and contains milk. The refusal counts that row alone and focus goes to its Change.',
      mode: 'back',
      recorded: MILK,
      answers: PICKED,
      saved: PICKED,
      dates: MAIN_FIRST,
      view: { kind: 'check' },
    }),
  comingBack: () =>
    start({
      name: 'Coming back, the party',
      note: 'Today is Wednesday, Oct 14: both people’s saved picks with a green check and the one close date. Change a pick to see [Not sent yet] and send it; Send with nothing changed sends nothing.',
      mode: 'back',
      recorded: FISH_CELERY,
      answers: HOST_MAIN,
      saved: HOST_MAIN,
      view: { kind: 'check' },
    }),
  comingBackAllergyAdded: () =>
    start({
      name: 'Coming back, an allergy added',
      note: 'Every course open; the host added milk for Chidi since the picks were saved, and nothing else changed. His main is marked, and Send my changes is refused with focus on its Change, because that pick is still the guest’s to change.',
      mode: 'back',
      recorded: MILK,
      answers: COCONUT_DESSERT,
      saved: COCONUT_DESSERT,
      view: { kind: 'check' },
    }),
} satisfies Record<string, () => PartyStart>;

const THREE: readonly Who[] = ['me', 'chidi', 'tom'];
const FIVE: readonly Who[] = ['me', 'chidi', 'isabela', 'kemi', 'tom'];
const TOM_MILK: Allergies = { ...NO_ALLERGIES, tom: ['milk'] };

/** Earlier people's picks, as the guest made them before reaching the next person's first course. */
const EARLIER_PICKS: Answers = {
  'me|starter': { kind: 'chosen', dishId: 'gizdodo', by: 'guest' },
  'me|main': { kind: 'kitchen' },
  'me|dessert': { kind: 'skipped' },
  'chidi|starter': { kind: 'chosen', dishId: 'pepper', by: 'guest' },
  'chidi|main': { kind: 'chosen', dishId: 'egusi', by: 'guest' },
  'chidi|dessert': { kind: 'skipped' },
  'isabela|starter': { kind: 'chosen', dishId: 'pepper', by: 'guest' },
  'isabela|main': { kind: 'chosen', dishId: 'croaker', by: 'guest' },
  'isabela|dessert': { kind: 'chosen', dishId: 'coconut', by: 'guest' },
  'kemi|starter': { kind: 'kitchen' },
  'kemi|main': { kind: 'chosen', dishId: 'jollof', by: 'guest' },
  'kemi|dessert': { kind: 'skipped' },
};

const UP_TO_CHIDI = without(
  EARLIER_PICKS,
  'isabela|starter',
  'isabela|main',
  'isabela|dessert',
  'kemi|starter',
  'kemi|main',
  'kemi|dessert',
);
const ME_ONLY = without(UP_TO_CHIDI, 'chidi|starter', 'chidi|main', 'chidi|dessert');

function copied(answers: Answers, from: Who, to: Who, allergies: Allergies): Answers {
  return copyAnswers(
    answers,
    from,
    to,
    allergies[to],
    (course) => closeOf(course, ONE_CLOSE).closed,
  ).answers;
}

const TOM_FROM_CHIDI = copied(UP_TO_CHIDI, 'chidi', 'tom', TOM_MILK);

const at3 = (who: Who, course: CourseKey) =>
  ({ kind: 'course', at: screenAt(who, course, screensOf(THREE)) }) as const;

export const SAME_AS_STATES = {
  sameAsTwo: () =>
    start({
      name: 'Same as, two earlier',
      note: 'You, Chidi Okonkwo-Williams and Tom, who is allergic to milk. Tom’s starter, reached by Next: Same as mine and Same as Chidi Okonkwo-Williams under the progress line, outside the dishes’ group. Same as Chidi copies his starter and dessert and asks his main (Pounded yam and egusi contains milk); Same as mine asks his starter (Gizdodo states no allergens) and copies the rest. Back from the card and from Tom’s main come back here with the buttons.',
      people: THREE,
      recorded: TOM_MILK,
      answers: UP_TO_CHIDI,
      view: at3('tom', 'starter'),
    }),
  sameAsWrap: () =>
    start({
      name: 'Same as, four earlier, 320 wide',
      note: 'Narrow the window to 320: four earlier people, Isabela Cristina Alves Ribeiro’s 30-character name among them. The buttons share each row and wrap; a long label wraps inside its own button, never cut off.',
      people: FIVE,
      recorded: TOM_MILK,
      answers: EARLIER_PICKS,
      view: { kind: 'course', at: screenAt('tom', 'starter', screensOf(FIVE)) },
    }),
  partlyCopied: () =>
    start({
      name: 'Partly copied, from a name',
      note: 'Same as Chidi Okonkwo-Williams pressed on Tom’s starter: his starter and dessert copied, his main cleared and asked, with “Chidi Okonkwo-Williams’s main can’t be picked for Tom.” as the group’s description. Next unanswered is refused. Answer it for the card.',
      people: THREE,
      recorded: TOM_MILK,
      answers: TOM_FROM_CHIDI,
      copy: { who: 'tom', from: 'chidi', asked: ['main'] },
      view: at3('tom', 'main'),
    }),
  partlyCopiedYours: () =>
    start({
      name: 'Partly copied, from your picks',
      note: 'Same as mine pressed on Tom’s starter: Gizdodo states no allergens, so his starter is asked straight after the press, with “Your starter can’t be picked for Tom.” and no Same as buttons. His main (chef’s choice) and dessert (skipped) are copied.',
      people: THREE,
      recorded: TOM_MILK,
      answers: copied(UP_TO_CHIDI, 'me', 'tom', TOM_MILK),
      copy: { who: 'tom', from: 'me', asked: ['starter'] },
      view: at3('tom', 'starter'),
    }),
  copiedCard: () =>
    start({
      name: 'The copied card, from a name',
      note: 'Tom’s card after Same as Chidi Okonkwo-Williams and Jollof rice for his main: For Tom is focused, the Copied from line, a row per course with Change. Change opens the course, and Next or Back there returns here. Back goes to Tom’s starter with Pepper soup selected; Continue goes to Check and send.',
      people: THREE,
      recorded: TOM_MILK,
      answers: { ...TOM_FROM_CHIDI, 'tom|main': { kind: 'chosen', dishId: 'jollof', by: 'guest' } },
      copy: { who: 'tom', from: 'chidi', asked: ['main'] },
      view: { kind: 'card' },
    }),
  copiedCardYours: () =>
    start({
      name: 'The copied card, from your picks',
      note: 'Chidi Okonkwo-Williams’s card after Same as mine: every course copied, so the press came straight here, “Copied from your picks.” Continue goes to Tom’s starter, which has both buttons.',
      people: THREE,
      recorded: TOM_MILK,
      answers: copied(ME_ONLY, 'me', 'chidi', TOM_MILK),
      copy: { who: 'chidi', from: 'me', asked: [] },
      view: { kind: 'card' },
    }),
} satisfies Record<string, () => PartyStart>;

const PREVIEW_STATES = {
  previewSameAs: () =>
    start({
      name: 'Preview as guest, Same as',
      note: 'In preview with a companion: Same as mine under the amber band copies within the preview, and Check and send’s button is Close preview. Nothing is saved.',
      you: SAMPLE.name,
      answers: {
        'me|starter': { kind: 'chosen', dishId: 'pepper', by: 'guest' },
        'me|main': { kind: 'kitchen' },
        'me|dessert': { kind: 'skipped' },
      },
      view: at('chidi', 'starter'),
    }),
} satisfies Record<string, () => PartyStart>;

const SEA_BASS: MenuChanged = { kind: 'changed', dish: 'Sea bass', why: 'removed' };
const SUYA: MenuChanged = { kind: 'changed', dish: 'Suya skewers', why: 'removed' };
const CHIDI_SEA_BASS: Answers = { ...PICKED, 'chidi|main': SEA_BASS };
const comeBack = (over: Partial<PartyStart> & { name: string; note: string }) =>
  start({ mode: 'back', ...over, saved: over.answers ?? {} });

/** sc-3913's guest side: the host changed the menu after these picks were sent, and the guest opens the RSVP again. */
export const MENU_CHANGED_STATES = {
  menuChanged: () =>
    comeBack({
      name: 'Menu changed, a dish taken off',
      note: 'Chidi Okonkwo-Williams picked Sea bass for his main, and the host took it off the menu. Opening the RSVP goes straight to his Main and nothing else: Pick a new main, the line naming the pick he kept, the dishes left and Let the kitchen choose for me. Next goes to Your picks with the new pick as Not sent yet; Send my changes saves it. Back goes to Your picks with the row still Menu changed.',
      answers: CHIDI_SEA_BASS,
      view: at('chidi', 'main'),
    }),
  menuChangedTwo: () =>
    comeBack({
      name: 'Menu changed, two people on one course',
      note: 'You and Chidi Okonkwo-Williams both picked Suya skewers, which came off the Starter. Only the two starters are asked, 1 of 2 then 2 of 2; the mains and desserts you sent are not shown again. Then Your picks.',
      answers: { ...PICKED, 'me|starter': SUYA, 'chidi|starter': SUYA },
      view: at('me', 'starter'),
    }),
  menuChangedWays: () =>
    comeBack({
      name: 'Menu changed, a dish now comes 2 ways',
      note: 'Chidi picked Pounded yam and egusi, which now comes 2 ways (its first Add variant, sc-3903). His Main is asked with nothing chosen and the dish still listed. Its ways are sc-3903’s step, shown on the single-person meal step demo, so here Next takes the dish as picked.',
      answers: {
        ...PICKED,
        'chidi|main': { kind: 'changed', dish: 'Pounded yam and egusi', why: 'ways', ways: 2 },
      },
      view: at('chidi', 'main'),
    }),
  menuChangedChoices: () =>
    comeBack({
      name: 'Menu changed, a dish’s choices changed',
      note: 'You picked Jollof rice, and its choices changed (a choice added, removed, or its Guests pick exactly changed, sc-3904). Your Main is asked with nothing chosen. Its choices are sc-3904’s step, shown on the single-person meal step demo.',
      answers: { ...PICKED, 'me|main': { kind: 'changed', dish: 'Jollof rice', why: 'choices' } },
      view: at('me', 'main'),
    }),
  menuChangedCheck: () =>
    comeBack({
      name: 'Menu changed, on Your picks',
      note: 'Back from the changed course, or a visit that goes to Your picks: Chidi’s main reads Menu changed with the two-arrow shape and the word, and the pick he kept. Send my changes is refused with focus on that row’s Change while it is still Menu changed.',
      answers: CHIDI_SEA_BASS,
      view: { kind: 'check' },
    }),
  menuChangedClosed: () =>
    comeBack({
      name: 'Menu changed, after Main closed',
      note: 'Today is Saturday, Oct 17, and Main closed Friday, Oct 16 (sample only). The host took Sea bass off after that: the guest can’t answer it, so the visit opens on Your picks with his main read-only, Menu changed and “The host will be in touch.” The host chooses for him from Who hasn’t picked (sc-3909). Send my changes is not refused.',
      answers: CHIDI_SEA_BASS,
      dates: MAIN_FIRST,
      view: { kind: 'check' },
    }),
} satisfies Record<string, () => PartyStart>;

const ALL_PARTY = {
  ...PARTY_STATES,
  ...SAME_AS_STATES,
  ...PREVIEW_STATES,
  ...MENU_CHANGED_STATES,
};

export type PartyStateName = keyof typeof ALL_PARTY;

export const isPartyState = (raw: string | null): raw is PartyStateName =>
  raw != null && Object.hasOwn(ALL_PARTY, raw);

export const partyStart = (state: PartyStateName): PartyStart => ALL_PARTY[state]();

export const MENU_WITH_PREVIEW = coursesAt('menu');

const partyAt = (state: PartyStateName, preview = false) =>
  `/demo/guest/meal?state=${state}${preview ? '&preview=1' : ''}`;

export const PARTY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'A meal for each person coming (sc-3907)',
    states: (Object.keys(PARTY_STATES) as (keyof typeof PARTY_STATES)[])
      .filter((state) => state !== 'preview')
      .map((state) => ({
        to: partyAt(state),
        name: PARTY_STATES[state]().name,
      })),
  },
  {
    name: 'Preview as guest (sc-3907, the host with menu.read)',
    states: [
      { to: MENU_WITH_PREVIEW, name: 'The way in: Preview as guest on the Menu' },
      { to: partyAt('preview', true), name: 'Preview as guest, the host alone' },
      { to: partyAt('start', true), name: 'Preview, the first meal screen' },
      { to: partyAt('checkAndSend', true), name: 'Preview, Close preview in place of Send' },
      { to: partyAt('previewSameAs', true), name: 'Preview, Same as (sc-17283)' },
    ],
  },
  {
    name: 'Same as an earlier person (sc-17283)',
    states: (Object.keys(SAME_AS_STATES) as (keyof typeof SAME_AS_STATES)[]).map((state) => ({
      to: partyAt(state),
      name: SAME_AS_STATES[state]().name,
    })),
  },
  {
    name: 'Menu changed after you picked (sc-3913)',
    states: (Object.keys(MENU_CHANGED_STATES) as (keyof typeof MENU_CHANGED_STATES)[]).map(
      (state) => ({ to: partyAt(state), name: MENU_CHANGED_STATES[state]().name }),
    ),
  },
];
