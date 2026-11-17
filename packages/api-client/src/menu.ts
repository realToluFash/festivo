import {
  DISH_ALLERGENS,
  DISH_DIETS,
  type DishAllergen,
  type DishDiet,
  type DishPrice,
  type VariantFor,
  asVariantFor,
  priceOf,
} from './dishes.ts';

/** One way a dish on the menu comes (sc-3903): guests pick a variant, never the dish. */
export interface MenuDishVariant {
  id: string;
  name: string;
  for: VariantFor;
  allergens: DishAllergen[];
  diets: DishDiet[];
  picked: boolean;
  /** In the event's currency; undefined without budget.read, and on the hub. */
  cost?: DishPrice | null;
  /** The library's currency when the copy's cost was left for the host to set. */
  pricedIn?: string | null;
}

/** One answer to a dish's choice (sc-3904), with what it contains; `picks` counts the stored answers naming it, as Kitchen prep sums them. */
export interface MenuChoiceOption {
  id: string;
  name: string;
  /** Empty is none of the 14. */
  allergens: DishAllergen[];
  picks: number;
}

/** A question inside a dish (sc-3904); a draft hides the dish from guests until it is finished. */
export interface MenuDishChoice {
  id: string;
  question: string;
  pick: number;
  required: boolean;
  draft: boolean;
  noneAnswers: number;
  options: MenuChoiceOption[];
}

export interface ChoiceOptionDetails {
  id?: string;
  name: string;
  allergens: DishAllergen[];
  containsNone: boolean;
}

export interface ChoiceDetails {
  question: string;
  options: ChoiceOptionDetails[];
  pick: number;
  required: boolean;
}

/** Who picked an option and has an allergen just added to it recorded, until sc-3913 tells them. */
export interface UnwarnedOption {
  optionId: string;
  option: string;
  count: number;
  allergens: DishAllergen[];
}

/** An event's menu as the API answers and the hub publishes it (sc-3902): courses in order, each with the event's own copy of its dishes. */

export interface MenuDish {
  id: string;
  name: string;
  description: string | null;
  /** Null is never stated; empty is none of the 14. */
  allergens: DishAllergen[] | null;
  diets: DishDiet[];
  /** The library dish it was copied from; null when it was added only for this event. */
  libraryDishId: string | null;
  /** A guest has picked it (sc-3907): Remove… is refused until sc-3913. */
  picked: boolean;
  variants: MenuDishVariant[];
  choices: MenuDishChoice[];
  /** False while a draft choice hides it from guests. */
  offered: boolean;
  /** Taken from the variant it folded back from; undefined without budget.read, and on the hub. */
  cost?: DishPrice | null;
}

export type MenuAnswer = 'choose' | 'same';

export interface MenuCourse {
  id: string;
  name: string;
  /** "20:30" in the event's zone, or null. */
  servedAt: string | null;
  answer: MenuAnswer;
  skippable: boolean;
  dishes: MenuDish[];
}

export interface EventMenu {
  courses: MenuCourse[];
}

export interface MenuCourseDetails {
  name: string;
  servedAt: string | null;
}

/** Who picked a dish and has an allergen just added to it recorded, until sc-3913 tells them. */
export interface UnwarnedPickers {
  count: number;
  allergens: DishAllergen[];
}

export interface MenuChange {
  menu: EventMenu;
  courseId: string | null;
  dishId: string | null;
  choiceId: string | null;
  unwarned: UnwarnedPickers | null;
  unwarnedOptions: UnwarnedOption[];
}

/** sc-3904: MenuDishChoice's limits on the API, in visible characters. */
export const CHOICES_PER_DISH_MAXIMUM = 3;
export const CHOICE_QUESTION_MAXIMUM = 80;
export const CHOICE_OPTIONS_MINIMUM = 2;
export const CHOICE_OPTIONS_MAXIMUM = 8;
export const CHOICE_OPTION_NAME_MAXIMUM = 60;

export const MENU_COURSE_MAXIMUM = 10;
export const MENU_COURSE_NAME_MAXIMUM = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function codes<T extends string>(raw: unknown, known: readonly T[]): T[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.every((code) => known.includes(code as T)) ? (raw as T[]) : null;
}

function asMenuDishVariant(raw: unknown): MenuDishVariant | null {
  if (!isRecord(raw)) return null;
  const contains = codes(raw.allergens, DISH_ALLERGENS);
  const suits = codes(raw.diets, DISH_DIETS);
  const chosen = asVariantFor(raw.for);

  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    chosen == null ||
    contains == null ||
    suits == null ||
    typeof raw.picked !== 'boolean'
  )
    return null;

  const variant: MenuDishVariant = {
    id: raw.id,
    name: raw.name,
    for: chosen,
    allergens: contains,
    diets: suits,
    picked: raw.picked,
  };

  if ('cost' in raw) {
    const cost = priceOf(raw.cost);
    if (cost === undefined) return null;
    variant.cost = cost;
    variant.pricedIn = typeof raw.pricedIn === 'string' ? raw.pricedIn : null;
  }

  return variant;
}

function asMenuChoiceOption(raw: unknown): MenuChoiceOption | null {
  if (!isRecord(raw)) return null;
  const contains = codes(raw.allergens, DISH_ALLERGENS);

  return typeof raw.id === 'string' &&
    typeof raw.name === 'string' &&
    contains != null &&
    typeof raw.picks === 'number'
    ? { id: raw.id, name: raw.name, allergens: contains, picks: raw.picks }
    : null;
}

function asMenuDishChoice(raw: unknown): MenuDishChoice | null {
  if (!isRecord(raw) || !Array.isArray(raw.options)) return null;
  const { id, question, pick, required, draft, noneAnswers } = raw;
  const options = raw.options.map(asMenuChoiceOption);

  if (
    typeof id !== 'string' ||
    typeof question !== 'string' ||
    typeof pick !== 'number' ||
    typeof required !== 'boolean' ||
    typeof draft !== 'boolean' ||
    typeof noneAnswers !== 'number' ||
    options.some((one) => one == null)
  )
    return null;

  return {
    id,
    question,
    pick,
    required,
    draft,
    noneAnswers,
    options: options as MenuChoiceOption[],
  };
}

function asMenuDish(raw: unknown): MenuDish | null {
  if (!isRecord(raw)) return null;
  const { id, name, description, allergens, diets, libraryDishId, picked } = raw;
  const contains = allergens === null ? null : codes(allergens, DISH_ALLERGENS);
  const suits = codes(diets, DISH_DIETS);
  const variants = Array.isArray(raw.variants) ? raw.variants.map(asMenuDishVariant) : null;
  const choices = Array.isArray(raw.choices) ? raw.choices.map(asMenuDishChoice) : null;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (description !== null && typeof description !== 'string') ||
    (allergens !== null && contains == null) ||
    suits == null ||
    (libraryDishId !== null && typeof libraryDishId !== 'string') ||
    typeof picked !== 'boolean' ||
    variants == null ||
    variants.some((one) => one == null) ||
    choices == null ||
    choices.some((one) => one == null) ||
    typeof raw.offered !== 'boolean'
  )
    return null;

  const dish: MenuDish = {
    id,
    name,
    description,
    allergens: contains,
    diets: suits,
    libraryDishId,
    picked,
    variants: variants as MenuDishVariant[],
    choices: choices as MenuDishChoice[],
    offered: raw.offered,
  };

  if ('cost' in raw) {
    const cost = priceOf(raw.cost);
    if (cost === undefined) return null;
    dish.cost = cost;
  }

  return dish;
}

function asMenuCourse(raw: unknown): MenuCourse | null {
  if (!isRecord(raw)) return null;
  const { id, name, servedAt, answer, skippable, dishes } = raw;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (servedAt !== null && typeof servedAt !== 'string') ||
    (answer !== 'choose' && answer !== 'same') ||
    typeof skippable !== 'boolean' ||
    !Array.isArray(dishes)
  )
    return null;

  const read = dishes.map(asMenuDish);

  return read.every((dish) => dish != null)
    ? { id, name, servedAt, answer, skippable, dishes: read as MenuDish[] }
    : null;
}

export function asEventMenu(raw: unknown): EventMenu | null {
  if (!isRecord(raw) || !Array.isArray(raw.courses)) return null;
  const courses = raw.courses.map(asMenuCourse);

  return courses.every((course) => course != null) ? { courses: courses as MenuCourse[] } : null;
}

export function asUnwarnedPickers(raw: unknown): UnwarnedPickers | null {
  if (!isRecord(raw) || typeof raw.count !== 'number') return null;
  const allergens = codes(raw.allergens, DISH_ALLERGENS);

  return allergens == null || allergens.length === 0 ? null : { count: raw.count, allergens };
}

export function asUnwarnedOptions(raw: unknown): UnwarnedOption[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((one): UnwarnedOption[] => {
    if (!isRecord(one)) return [];
    const allergens = codes(one.allergens, DISH_ALLERGENS);

    return typeof one.optionId === 'string' &&
      typeof one.option === 'string' &&
      typeof one.count === 'number' &&
      allergens != null &&
      allergens.length > 0
      ? [{ optionId: one.optionId, option: one.option, count: one.count, allergens }]
      : [];
  });
}
