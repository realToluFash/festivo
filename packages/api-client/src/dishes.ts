/** An organisation's menu library as the API answers it (sc-3901). */

import { ALLERGENS, type Allergen, DIETS, type Diet } from './guests.ts';

export type DishAllergen = Exclude<Allergen, 'other'>;
export type DishDiet = Exclude<Diet, 'other'>;

/** The 14 of EU 1169/2011 Annex II, in its order: sc-3777's codes without Other. */
export const DISH_ALLERGENS = ALLERGENS.filter(
  (code): code is DishAllergen => code !== 'other',
) as readonly DishAllergen[];

export const DISH_DIETS = DIETS.filter(
  (code): code is DishDiet => code !== 'other',
) as readonly DishDiet[];

/** The API's Dish::NAME_MAXIMUM and DESCRIPTION_MAXIMUM, in visible characters. */
export const DISH_NAME_MAXIMUM = 120;
export const DISH_DESCRIPTION_MAXIMUM = 300;

export interface DishPrice {
  /** A plain decimal to the currency's minor unit: "4500.00", "3500", "12.125". */
  amount: string;
  currency: string;
}

/** sc-3903: the API's DishVariant::NAME_MAXIMUM, in visible characters, and PER_DISH_MAXIMUM. */
export const VARIANT_NAME_MAXIMUM = 60;
export const VARIANTS_PER_DISH_MAXIMUM = 6;

export type VariantFor = 'everyone' | 'children';

export interface DishVariant {
  id: string;
  name: string;
  for: VariantFor;
  /** Empty is none of the 14. */
  allergens: DishAllergen[];
  diets: DishDiet[];
  /** Undefined without budget.read. */
  lastPrice?: DishPrice | null;
}

/** As the variant form sends one; the money is `cost` on an event, in its currency, and `lastPrice` in the library, each only with budget.read. */
export interface VariantDetails {
  name: string;
  for: VariantFor;
  allergens: DishAllergen[];
  containsNone: boolean;
  diets: DishDiet[];
  cost?: string | null;
  lastPrice?: DishPrice | null;
}

export interface Dish {
  id: string;
  name: string;
  description: string | null;
  /** Null is never stated; empty is none of the 14. */
  allergens: DishAllergen[] | null;
  diets: DishDiet[];
  usedByEvent: boolean;
  archivedAt: string | null;
  /** Undefined without budget.read. */
  lastPrice?: DishPrice | null;
  variants: DishVariant[];
}

export interface DishLibrary {
  dishes: Dish[];
  canManage: boolean;
  seesPrices: boolean;
}

export interface DishDetails {
  name: string;
  description: string | null;
  allergens: DishAllergen[];
  containsNone: boolean;
  diets: DishDiet[];
  /** Sent only with budget.read: left out, an edit keeps the price; null clears it. */
  lastPrice?: DishPrice | null;
  allowShared?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function codes<T extends string>(raw: unknown, known: readonly T[]): T[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.every((code) => known.includes(code as T)) ? (raw as T[]) : null;
}

export function priceOf(raw: unknown): DishPrice | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || typeof raw.amount !== 'string' || typeof raw.currency !== 'string')
    return undefined;

  return { amount: raw.amount, currency: raw.currency };
}

export function asVariantFor(raw: unknown): VariantFor | null {
  return raw === 'everyone' || raw === 'children' ? raw : null;
}

function asDishVariant(raw: unknown): DishVariant | null {
  if (!isRecord(raw)) return null;
  const contains = codes(raw.allergens, DISH_ALLERGENS);
  const suits = codes(raw.diets, DISH_DIETS);
  const chosen = asVariantFor(raw.for);

  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    chosen == null ||
    contains == null ||
    suits == null
  )
    return null;

  const variant: DishVariant = {
    id: raw.id,
    name: raw.name,
    for: chosen,
    allergens: contains,
    diets: suits,
  };

  if ('lastPrice' in raw) {
    const price = priceOf(raw.lastPrice);
    if (price === undefined) return null;
    variant.lastPrice = price;
  }

  return variant;
}

export function asDish(raw: unknown): Dish | null {
  if (!isRecord(raw)) return null;
  const { id, name, description, allergens, diets, usedByEvent, archivedAt } = raw;
  const variants = Array.isArray(raw.variants) ? raw.variants.map(asDishVariant) : null;
  const contains = allergens === null ? null : codes(allergens, DISH_ALLERGENS);
  const suits = codes(diets, DISH_DIETS);

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (description !== null && typeof description !== 'string') ||
    (allergens !== null && contains == null) ||
    suits == null ||
    typeof usedByEvent !== 'boolean' ||
    (archivedAt !== null && typeof archivedAt !== 'string') ||
    variants == null ||
    variants.some((one) => one == null)
  )
    return null;

  const dish: Dish = {
    id,
    name,
    description,
    allergens: contains,
    diets: suits,
    usedByEvent,
    archivedAt,
    variants: variants as DishVariant[],
  };

  if ('lastPrice' in raw) {
    const price = priceOf(raw.lastPrice);
    if (price === undefined) return null;
    dish.lastPrice = price;
  }

  return dish;
}

export function asDishLibrary(raw: unknown): DishLibrary | null {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.dishes) ||
    typeof raw.canManage !== 'boolean' ||
    typeof raw.seesPrices !== 'boolean'
  )
    return null;
  const dishes = raw.dishes.map(asDish);

  return dishes.every((dish) => dish != null)
    ? { dishes: dishes as Dish[], canManage: raw.canManage, seesPrices: raw.seesPrices }
    : null;
}
