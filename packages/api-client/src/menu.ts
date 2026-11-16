import { DISH_ALLERGENS, DISH_DIETS, type DishAllergen, type DishDiet } from './dishes.ts';

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

function asMenuDish(raw: unknown): MenuDish | null {
  if (!isRecord(raw)) return null;
  const { id, name, description, allergens, diets, libraryDishId, picked } = raw;
  const contains = allergens === null ? null : codes(allergens, DISH_ALLERGENS);
  const suits = codes(diets, DISH_DIETS);

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (description !== null && typeof description !== 'string') ||
    (allergens !== null && contains == null) ||
    suits == null ||
    (libraryDishId !== null && typeof libraryDishId !== 'string') ||
    typeof picked !== 'boolean'
  )
    return null;

  return { id, name, description, allergens: contains, diets: suits, libraryDishId, picked };
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
