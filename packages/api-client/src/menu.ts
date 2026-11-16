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
  unwarned: UnwarnedPickers | null;
}

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

function asMenuDish(raw: unknown): MenuDish | null {
  if (!isRecord(raw)) return null;
  const { id, name, description, allergens, diets, libraryDishId, picked } = raw;
  const contains = allergens === null ? null : codes(allergens, DISH_ALLERGENS);
  const suits = codes(diets, DISH_DIETS);
  const variants = Array.isArray(raw.variants) ? raw.variants.map(asMenuDishVariant) : null;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (description !== null && typeof description !== 'string') ||
    (allergens !== null && contains == null) ||
    suits == null ||
    (libraryDishId !== null && typeof libraryDishId !== 'string') ||
    typeof picked !== 'boolean' ||
    variants == null ||
    variants.some((one) => one == null)
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
