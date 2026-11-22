import type { Allergen } from './guestKitchenWords.ts';
import { type Diet, type DishAllergen, type Lang, DISH_ALLERGENS } from './menuLibrary.ts';
import { allergenList } from './mealStep.ts';
import { type PicksDates, SAMPLE_PICKS, closeOf } from './picksClose.ts';
import { SAMPLE } from './rules.ts';
import type { DemoLink } from './settings.ts';

/** sc-3907's meal step for each person coming (board MealStep, page e32): person by person, course by course, then Check and send. */
export type Who = 'me' | 'chidi';
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
  | { kind: 'host' };

export type Answers = Readonly<Partial<Record<RowKey, PartyAnswer>>>;
export type Allergies = Readonly<Record<Who, readonly Allergen[]>>;

export const rowKey = (who: Who, course: CourseKey): RowKey => `${who}|${course}`;

export const PARTY: readonly PartyPerson[] = [
  { key: 'me', name: 'Maria Fernanda Albuquerque Santos', you: true },
  { key: 'chidi', name: 'Chidi Okonkwo-Williams', you: false },
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
  party: (names: readonly string[]) => names.join(' and '),
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
  nothingSaved: '[Nothing was saved.]',
  again: 'Start this state again',
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

export const EVERYONE: readonly Who[] = PARTY.map((one) => one.key);

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

export const screenAt = (who: Who, course: CourseKey): number =>
  SCREENS.findIndex((one) => one.who === who && one.course === course);

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
): { answers: Answers; cleared: Cleared } {
  const next: Partial<Record<RowKey, PartyAnswer>> = { ...answers };
  const cleared: Partial<Record<RowKey, ClearedPick>> = {};
  for (const { who, course } of SCREENS) {
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
): RowKey[] {
  return SCREENS.map(({ who, course }) => rowKey(who, course)).filter(
    (key) =>
      !closed(key.split('|')[1] as CourseKey) && markOf(key, answers, allergies, lang) != null,
  );
}

export const sameAnswer = (a: PartyAnswer | undefined, b: PartyAnswer | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const sameAllergies = (a: readonly Allergen[], b: readonly Allergen[]): boolean =>
  a.length === b.length && a.every((one) => b.includes(one));

export const NO_ALLERGIES: Allergies = { me: [], chidi: [] };

export const ONE_CLOSE: PicksDates = { ...SAMPLE_PICKS };
export const MAIN_FIRST: PicksDates = {
  ...SAMPLE_PICKS,
  today: '2026-10-17',
  own: { main: '2026-10-16' },
};

export const oneDate = (dates: PicksDates): boolean =>
  new Set(COURSES.map((one) => closeOf(one.key, dates).on)).size === 1;

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
  view: { kind: 'course'; at: number } | { kind: 'check' };
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
const FISH_CELERY: Allergies = { me: ['celery', 'fish'], chidi: [] };
const MILK: Allergies = { me: [], chidi: ['milk'] };
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
      recorded: { me: [], chidi: ['peanuts', 'sesame'] },
      answers: MINE,
      view: at('chidi', 'starter'),
    }),
  nothingSafe: () =>
    start({
      name: 'Nothing safe on a course',
      note: 'Chidi is allergic to celery and fish: every main is ruled out. The red-outlined box says the host will be in touch, there is no Let the kitchen choose, and Next records needs the host.',
      recorded: { me: [], chidi: ['celery', 'fish'] },
      answers: without(PICKED, 'chidi|main', 'chidi|dessert'),
      view: at('chidi', 'main'),
    }),
  nothingSafeOptional: () =>
    start({
      name: 'Nothing safe, on an optional course',
      note: 'Chidi is allergic to eggs: every dessert is ruled out. No dessert for me is the one answer left; Next without it records needs the host.',
      recorded: { me: [], chidi: ['eggs'] },
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

export type PartyStateName = keyof typeof PARTY_STATES;

export const isPartyState = (raw: string | null): raw is PartyStateName =>
  raw != null && Object.hasOwn(PARTY_STATES, raw);

export const partyStart = (state: PartyStateName): PartyStart => PARTY_STATES[state]();

const MENU_WITH_PREVIEW = '/demo/events/evt-wed-4/menu';

const partyAt = (state: PartyStateName, preview = false) =>
  `/demo/guest/meal?state=${state}${preview ? '&preview=1' : ''}`;

export const PARTY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'A meal for each person coming (sc-3907)',
    states: (Object.keys(PARTY_STATES) as PartyStateName[])
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
    ],
  },
];
