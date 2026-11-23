import {
  ALLERGENS,
  type GuestMeals,
  type GuestPage,
  type MealAnswerKind,
  type MealChoice,
  type MealCourse,
  type MealDish,
  type MealPick,
} from '@soirely/api-client';

import { type Party, comingWith } from './party.ts';
import { type Kitchen, YOU } from './kitchen.ts';

export interface Eater {
  key: string;
  id: string;
  name: string | null;
  you: boolean;
}

export type Kind = Exclude<MealAnswerKind, 'defaulted' | 'menuChanged'>;

export interface Plate {
  kind: Kind | 'defaulted';
  dish: string | null;
  variant: string | null;
  options: Readonly<Record<string, readonly string[]>>;
  /** Made by the host (sc-3909): never marked, never refused. */
  byHost?: boolean;
}

export type Plates = Readonly<Record<string, Plate>>;

export const keyOf = (eater: string, course: string) => `${eater}|${course}`;

export const changeFocus = (key: string) => `meal-${key}`;

export type Step = { kind: 'dish' } | { kind: 'way' } | { kind: 'choice'; choice: MealChoice };

export type Ruled = { kind: 'allergen'; codes: readonly string[] } | { kind: 'notStated' } | null;

const FOURTEEN: readonly string[] = ALLERGENS.filter((one) => one !== 'other');

/** A person's allergens among the 14, in Annex II order: an Other allergy is never matched against the menu. */
export function fourteen(allergies: readonly string[]): string[] {
  return FOURTEEN.filter((one) => allergies.includes(one));
}

/** The one allergen rule: a plate that never stated its allergens holds any of the 14. */
export function against(plate: readonly string[] | null, allergies: readonly string[]): Ruled {
  const theirs = fourteen(allergies);
  if (plate == null) return theirs.length > 0 ? { kind: 'notStated' } : null;
  const codes = theirs.filter((one) => plate.includes(one));

  return codes.length > 0 ? { kind: 'allergen', codes } : null;
}

const optionsLeft = (choice: MealChoice, allergies: readonly string[]) =>
  choice.options.filter((one) => against(one.allergens, allergies) == null).length;

/** The dish itself, every way of it, or a required choice left with fewer options than it asks. */
export function dishRuled(dish: MealDish, allergies: readonly string[]): Ruled {
  const out =
    dish.variants.length === 0
      ? against(dish.allergens, allergies)
      : dish.variants.every((one) => against(one.allergens, allergies) != null)
        ? (against(dish.variants[0]?.allergens ?? null, allergies) ?? null)
        : null;
  if (out != null) {
    if (out.kind === 'notStated' || dish.variants.length === 0) return out;
    const codes = fourteen(allergies).filter((code) =>
      dish.variants.some((one) => one.allergens.includes(code)),
    );

    return { kind: 'allergen', codes };
  }
  const short = dish.choices.find((one) => one.required && optionsLeft(one, allergies) < one.pick);
  if (short == null) return null;
  const codes = fourteen(allergies).filter((code) =>
    short.options.some((one) => one.allergens.includes(code)),
  );

  return { kind: 'allergen', codes };
}

export function asks(course: MealCourse): boolean {
  if (course.answer === 'choose') return course.dishes.length > 0;
  const dish = course.dishes[0];

  return dish != null && (dish.variants.length >= 2 || dish.choices.length > 0);
}

export const askedCourses = (meals: GuestMeals): MealCourse[] => meals.courses.filter(asks);

export function nothingSafe(course: MealCourse, allergies: readonly string[]): boolean {
  return course.dishes.every((one) => dishRuled(one, allergies) != null);
}

export const dishIn = (course: MealCourse, id: string | null): MealDish | null =>
  course.dishes.find((one) => one.id === id) ?? null;

export const plateDish = (course: MealCourse, plate: Plate | null): MealDish | null =>
  course.answer === 'same' ? (course.dishes[0] ?? null) : dishIn(course, plate?.dish ?? null);

export function firstStep(course: MealCourse): Step {
  const dish = course.dishes[0];
  if (course.answer === 'choose' || dish == null) return { kind: 'dish' };
  if (dish.variants.length >= 2) return { kind: 'way' };
  const choice = dish.choices[0];

  return choice == null ? { kind: 'way' } : { kind: 'choice', choice };
}

function asked(dish: MealDish): Step[] {
  return [
    ...(dish.variants.length >= 2 ? [{ kind: 'way' } as const] : []),
    ...dish.choices.map((choice) => ({ kind: 'choice', choice }) as const),
  ];
}

export function stepsOf(course: MealCourse, plate: Plate | null): Step[] {
  const first = firstStep(course);
  if (plate != null && plate.kind !== 'chosen') return [first];
  if (course.answer === 'same') {
    const dish = course.dishes[0];
    const steps = dish == null ? [] : asked(dish);

    return steps.length === 0 ? [first] : steps;
  }
  const dish = dishIn(course, plate?.dish ?? null);

  return dish == null ? [first] : [first, ...asked(dish)];
}

/** What a dish contains before a way is picked: its only way's allergens, or the dish's own. */
export function dishContains(dish: MealDish): readonly string[] | null {
  if (dish.variants.length === 1) return dish.variants[0]?.allergens ?? null;

  return dish.allergens;
}

type CardPart = { way: string | null; name: string; allergens: readonly string[] | null };

function plateParts(dish: MealDish, plate: Plate): CardPart[] {
  const ways = dish.variants.length >= 2;
  const way = ways ? dish.variants.find((one) => one.id === plate.variant) : undefined;
  const head: CardPart =
    way != null
      ? { way: way.name, name: dish.name, allergens: way.allergens }
      : { way: null, name: dish.name, allergens: dishContains(dish) };

  return [
    head,
    ...dish.choices.flatMap((choice) =>
      choice.options
        .filter((one) => (plate.options[choice.id] ?? []).includes(one.id))
        .map((one) => ({ way: null, name: one.name, allergens: one.allergens })),
    ),
  ];
}

/** What the plate holds, for its mark: not stated while a dish of two ways has no way picked, whatever the dish itself states. */
export function plateAllergens(dish: MealDish, plate: Plate): string[] | null {
  if (dish.variants.length >= 2 && !dish.variants.some((one) => one.id === plate.variant))
    return null;

  return partsAllergens(plateParts(dish, plate));
}

/** The dish card once its dish is picked: the way (or the dish) and each picked option, each with its own allergens. A dish with no ways and no choices keeps its own Contains line. */
export function cardParts(dish: MealDish, plate: Plate | null): CardPart[] | null {
  if (plate?.kind !== 'chosen' || plate.dish !== dish.id) return null;
  if (dish.variants.length < 2 && dish.choices.length === 0) return null;

  return plateParts(dish, plate);
}

/** Every part's allergens together; not stated when any part never stated them. */
export function partsAllergens(
  parts: readonly { allergens: readonly string[] | null }[],
): string[] | null {
  if (parts.some((one) => one.allergens == null)) return null;

  return [...new Set(parts.flatMap((one) => one.allergens ?? []))];
}

export function markOf(
  course: MealCourse,
  plate: Plate | undefined,
  allergies: readonly string[],
): Ruled {
  if (plate == null || plate.byHost === true) return null;
  if (plate.kind !== 'chosen' && plate.kind !== 'needsHost') return null;
  const dish = plateDish(course, plate);
  if (dish == null || (plate.kind === 'needsHost' && plate.dish == null)) return null;

  return against(plateAllergens(dish, plate), allergies);
}

export type Refusal =
  | { kind: 'course' }
  | { kind: 'one' }
  | { kind: 'oneOrNone' }
  | { kind: 'count'; pick: number; had: number }
  | null;

export function refusalOf(step: Step, plate: Plate | null, first: boolean): Refusal {
  if (plate != null && plate.kind !== 'chosen') return null;
  if (step.kind === 'dish') return plate?.dish == null ? { kind: 'course' } : null;
  if (step.kind === 'way') {
    if (plate?.variant != null) return null;

    return first ? { kind: 'course' } : { kind: 'one' };
  }
  const had = plate?.options[step.choice.id];
  if (had != null && had.length === 0 && !step.choice.required) return null;
  const count = had?.length ?? 0;
  if (count === 0) {
    if (first) return { kind: 'course' };

    return step.choice.required ? { kind: 'one' } : { kind: 'oneOrNone' };
  }

  return count === step.choice.pick ? null : { kind: 'count', pick: step.choice.pick, had: count };
}

/** The people a meal is picked for: the guest, then each companion coming who has a name. A place nobody has named waits until it has one. */
export function eatersOf(meals: GuestMeals, party: Party): Eater[] {
  return [
    { key: YOU, id: meals.you, name: null, you: true },
    ...comingWith(party)
      .filter((one) => one.name != null)
      .map((one) => ({ key: one.id, id: one.id, name: one.name, you: false })),
  ];
}

/** Each person's allergens as they will be once this answer is sent: the kitchen step's when it was filled in, else the record. */
export function allergiesOf(
  page: GuestPage,
  kitchen: Kitchen | null,
): (key: string) => readonly string[] {
  return (key) => {
    const card = kitchen?.left === false ? kitchen.people.find((one) => one.key === key) : null;
    if (card != null) return card.allergies;
    if (key === YOU) return page.guest.needs.allergies;
    const one =
      page.guest.companions.find((each) => each.id === key) ??
      page.guest.unnamed.find((each) => each.id === key);

    return one?.needs?.allergies ?? [];
  };
}

export function otherOf(page: GuestPage, kitchen: Kitchen | null): (key: string) => string | null {
  return (key) => {
    const card = kitchen?.left === false ? kitchen.people.find((one) => one.key === key) : null;
    if (card != null)
      return card.allergies.includes('other') && card.other.trim() !== ''
        ? card.other.trim()
        : null;
    const needs =
      key === YOU
        ? page.guest.needs
        : (page.guest.companions.find((each) => each.id === key)?.needs ?? null);

    return needs?.allergies.includes('other') === true ? (needs.otherAllergy ?? null) : null;
  };
}

export function savedPlates(meals: GuestMeals, eaters: readonly Eater[]): Plates {
  const plates: Record<string, Plate> = {};
  for (const eater of eaters) {
    for (const one of meals.answers[eater.id] ?? []) {
      if (one.answer === 'menuChanged') continue;
      const course = meals.courses.find((each) => each.id === one.course);
      const dish = course == null ? null : plateDish(course, { ...blank(), dish: one.dish });
      const options: Record<string, string[]> = {};
      for (const choice of dish?.choices ?? [])
        options[choice.id] = choice.options
          .filter((option) => one.options.includes(option.id))
          .map((option) => option.id);
      plates[keyOf(eater.key, one.course)] = {
        kind: one.answer,
        dish: one.dish,
        variant: one.variant,
        options,
      };
    }
  }

  return plates;
}

export const blank = (): Plate => ({ kind: 'chosen', dish: null, variant: null, options: {} });

export interface Cleared {
  dish: string;
  codes: readonly string[];
}

export function clearRuledOut(
  plates: Plates,
  eaters: readonly Eater[],
  courses: readonly MealCourse[],
  allergies: (key: string) => readonly string[],
): { plates: Plates; cleared: Record<string, Cleared> } {
  const next: Record<string, Plate> = { ...plates };
  const cleared: Record<string, Cleared> = {};
  for (const eater of eaters) {
    for (const course of courses) {
      if (course.picksClose.closed) continue;
      const key = keyOf(eater.key, course.id);
      const plate = plates[key];
      if (plate?.kind !== 'chosen' || plate.byHost === true) continue;
      const ruled = markOf(course, plate, allergies(eater.key));
      if (ruled == null) continue;
      delete next[key];
      const dish = plateDish(course, plate);
      cleared[key] = {
        dish: dish?.name ?? '',
        codes: ruled.kind === 'allergen' ? ruled.codes : [],
      };
    }
  }

  return { plates: next, cleared };
}

export function markedOpen(
  plates: Plates,
  eaters: readonly Eater[],
  courses: readonly MealCourse[],
  allergies: (key: string) => readonly string[],
): string[] {
  return eaters.flatMap((eater) =>
    courses
      .filter((course) => !course.picksClose.closed)
      .map((course) => keyOf(eater.key, course.id))
      .filter((key) => {
        const course = courses.find((one) => key.endsWith(`|${one.id}`));

        return course != null && markOf(course, plates[key], allergies(eater.key)) != null;
      }),
  );
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((one) => b.includes(one));

export function samePlate(a: Plate | undefined, b: Plate | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  const kind = (one: Plate) => (one.kind === 'needsHost' && one.dish != null ? 'chosen' : one.kind);
  if (kind(a) !== kind(b)) return false;
  if (a.kind !== 'chosen' && a.kind !== 'needsHost') return true;
  const choices = new Set([...Object.keys(a.options), ...Object.keys(b.options)]);

  return (
    a.dish === b.dish &&
    a.variant === b.variant &&
    [...choices].every((id) => sameList(a.options[id] ?? [], b.options[id] ?? []))
  );
}

/** What Send sends: every open answer, each person by the id the API knows. A served needs-the-host pick goes back as the pick it is. */
export function picksOf(
  plates: Plates,
  eaters: readonly Eater[],
  courses: readonly MealCourse[],
  ids: (key: string) => string | null,
): MealPick[] {
  return eaters.flatMap((eater) => {
    const person = ids(eater.key);
    if (person == null) return [];

    return courses.flatMap((course): MealPick[] => {
      const plate = plates[keyOf(eater.key, course.id)];
      if (plate == null || course.picksClose.closed || plate.kind === 'defaulted') return [];
      if (plate.byHost === true) return [];
      const chosen = plate.kind === 'chosen' || (plate.kind === 'needsHost' && plate.dish != null);
      if (!chosen) return [{ person, course: course.id, answer: plate.kind }];
      const dish = plateDish(course, plate);

      return [
        {
          person,
          course: course.id,
          answer: 'chosen',
          dish: dish?.id ?? plate.dish,
          variant: plate.variant,
          options: Object.values(plate.options).flat(),
        },
      ];
    });
  });
}

/** Whether an answer could be picked by hand for this person on this course (sc-17283): needs the host never is, and a pick only with its dish, its way and every option allowed. */
export function copyable(
  plate: Plate | undefined,
  course: MealCourse,
  allergies: readonly string[],
): boolean {
  if (plate == null) return false;
  switch (plate.kind) {
    case 'chefsChoice':
      return !nothingSafe(course, allergies);
    case 'skipped':
      return course.skippable;
    case 'chosen':
      break;
    default:
      return false;
  }
  const dish = plateDish(course, plate);
  if (dish == null || dishRuled(dish, allergies) != null) return false;
  const ways = dish.variants.length >= 2;
  if (ways && !dish.variants.some((one) => one.id === plate.variant)) return false;
  if (!ways && plate.variant != null && plate.variant !== dish.variants[0]?.id) return false;
  const known = Object.entries(plate.options).every(([choice, ids]) => {
    const one = dish.choices.find((each) => each.id === choice);

    return one != null && ids.every((id) => one.options.some((option) => option.id === id));
  });
  const complete = stepsOf(course, plate).every(
    (step, at) => refusalOf(step, plate, at === 0) == null,
  );

  return known && complete && against(plateAllergens(dish, plate), allergies) == null;
}

/** Same as {name}: every open course takes the earlier person's answer where it can be picked for this one, and is cleared where it can't. */
export function copyPlates(
  plates: Plates,
  from: string,
  to: string,
  courses: readonly MealCourse[],
  allergies: readonly string[],
): { plates: Plates; asked: string[] } {
  const next: Record<string, Plate> = { ...plates };
  const asked: string[] = [];
  for (const course of courses) {
    if (course.picksClose.closed) continue;
    const source = plates[keyOf(from, course.id)];
    const key = keyOf(to, course.id);
    if (source != null && copyable(source, course, allergies)) {
      next[key] = {
        kind: source.kind,
        dish: source.dish,
        variant: source.variant,
        options: Object.fromEntries(
          Object.entries(source.options).map(([choice, ids]) => [choice, [...ids]]),
        ),
      };
      continue;
    }
    delete next[key];
    asked.push(course.id);
  }

  return { plates: next, asked };
}

/** The day every course's picks close on, while all are open, so one line says it in place of a close line on each row. */
export function oneCloseDay(
  courses: readonly MealCourse[],
  dayOf: (at: string) => string,
): string | null {
  const days = new Set(courses.map((one) => dayOf(one.picksClose.at)));
  const [day] = days;

  return days.size === 1 && day != null && courses.every((one) => !one.picksClose.closed)
    ? day
    : null;
}

/** sc-1362's line for a person's course: the default waiting for them while it is open, the default they were given, or the host in touch for someone it would never be given. */
export type DefaultLine = 'chooseBy' | 'defaulted' | 'hostInTouch' | null;

export function defaultLine(
  meals: GuestMeals,
  course: MealCourse,
  eater: Eater,
  plate: Plate | null | undefined,
  shut: boolean,
): DefaultLine {
  if (course.default == null) return null;
  if (plate?.kind === 'defaulted') return 'defaulted';
  if (plate != null) return null;
  const excluded = (meals.excluded[eater.id] ?? []).some((one) => one.course === course.id);
  if (shut) return excluded ? 'hostInTouch' : null;

  return excluded ? null : 'chooseBy';
}

/** The default's dish, with its variant's name where it has variants. */
export function defaultName(course: MealCourse): string {
  const dish = dishIn(course, course.default?.dish ?? null);
  const way = dish?.variants.find((one) => one.id === course.default?.variant);

  return [dish?.name, way?.name].filter((one) => one != null).join(', ');
}
