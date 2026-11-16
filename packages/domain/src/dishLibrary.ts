import {
  DISH_ALLERGENS,
  DISH_DESCRIPTION_MAXIMUM,
  DISH_DIETS,
  DISH_NAME_MAXIMUM,
  type Dish,
  type DishAllergen,
  type DishDetails,
  type DishDiet,
} from '@soirely/api-client';
import { numberFormat } from './locales.ts';
import { nameKey } from './nameKey.ts';
import { visibleLength } from './visibleText.ts';

export type DishLanguage = 'en' | 'es' | 'fr' | 'pt';

/** The marks the AC fixes for each interface language: fr groups with a space, es and pt with a dot. */
const MARKS: Record<DishLanguage, { group: string; decimal: string }> = {
  en: { group: ',', decimal: '.' },
  fr: { group: ' ', decimal: ',' },
  es: { group: '.', decimal: ',' },
  pt: { group: '.', decimal: ',' },
};

export function dishLanguage(locale: string): DishLanguage {
  const base = locale.slice(0, 2);

  return base === 'es' || base === 'fr' || base === 'pt' ? base : 'en';
}

export function minorDigits(currency: string): number {
  try {
    return (
      numberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

const escaped = (mark: string): string => mark.replace(/[.]/gu, '\\.');

/** The typed amount as the API takes it ("4500.00"), or null: a grouping mark only between groups of three, and never more decimals than the currency's minor unit. */
export function readPrice(typed: string, language: DishLanguage, currency: string): string | null {
  const plain = typed.trim().replace(/[\u00a0\u202f]/gu, ' ');
  const { group, decimal } = MARKS[language];
  const found = new RegExp(
    `^(\\d{1,3}(?:${escaped(group)}\\d{3})+|\\d+)(?:${escaped(decimal)}(\\d+))?$`,
    'u',
  ).exec(plain);
  if (found == null) return null;
  const whole = (found[1] ?? '').split(group).join('');
  const fraction = found[2] ?? '';
  const digits = minorDigits(currency);
  if (fraction.length > digits || whole.length > 15) return null;

  return digits === 0 ? whole : `${whole}.${fraction.padEnd(digits, '0')}`;
}

function written(amount: number, language: DishLanguage, digits: number): string {
  const { group, decimal } = MARKS[language];
  const [whole = '0', fraction = ''] = amount.toFixed(digits).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, group);

  return fraction === '' ? grouped : `${grouped}${decimal}${fraction}`;
}

/** 12.50 written to the currency's minor unit in the language's format: en 12.50, fr 12,50, JPY 12, KWD 12.500. */
export function priceExample(language: DishLanguage, currency: string): string {
  const digits = minorDigits(currency);

  return written(digits === 0 ? 12 : 12.5, language, digits);
}

/** The API's amount as the form shows it to be typed again: "4,500.00" in en, "4 500,00" in fr. */
export function typedPrice(amount: string, language: DishLanguage, currency: string): string {
  const digits = minorDigits(currency);
  const [whole = '0', fraction = ''] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, MARKS[language].group);

  return digits === 0
    ? grouped
    : `${grouped}${MARKS[language].decimal}${fraction.padEnd(digits, '0')}`;
}

export type DietClash = 'vegetarianSea' | 'veganAnimal' | 'veganSea' | 'veganBoth';

const SEA: readonly DishAllergen[] = ['fish', 'crustaceans', 'molluscs'];
const ANIMAL: readonly DishAllergen[] = ['milk', 'eggs'];

export function dietClashes(
  allergens: readonly DishAllergen[],
  diets: readonly DishDiet[],
): { diet: DishDiet; clash: DietClash }[] {
  const sea = allergens.some((code) => SEA.includes(code));
  const animal = allergens.some((code) => ANIMAL.includes(code));
  const found: { diet: DishDiet; clash: DietClash }[] = [];

  if (sea && diets.includes('vegetarian'))
    found.push({ diet: 'vegetarian', clash: 'vegetarianSea' });
  if ((sea || animal) && diets.includes('vegan'))
    found.push({
      diet: 'vegan',
      clash: sea && animal ? 'veganBoth' : sea ? 'veganSea' : 'veganAnimal',
    });

  return found;
}

export interface DishForm {
  name: string;
  description: string;
  allergens: readonly DishAllergen[];
  none: boolean;
  diets: readonly DishDiet[];
  amount: string;
  currency: string;
}

export interface DishProblems {
  name: 'blank' | 'long' | null;
  description: 'long' | null;
  contains: 'blank' | null;
  clashes: { diet: DishDiet; clash: DietClash }[];
  currency: 'blank' | null;
  amount: 'wrong' | null;
}

export const dishLength = (text: string): number => visibleLength(text.trim());

export function dishProblems(
  form: DishForm,
  language: DishLanguage,
  prices: boolean,
): DishProblems {
  const name = dishLength(form.name);
  const amount = form.amount.trim();
  const priced = prices && amount !== '';

  return {
    name: name === 0 ? 'blank' : name > DISH_NAME_MAXIMUM ? 'long' : null,
    description: dishLength(form.description) > DISH_DESCRIPTION_MAXIMUM ? 'long' : null,
    contains: form.allergens.length === 0 && !form.none ? 'blank' : null,
    clashes: dietClashes(form.allergens, form.diets),
    currency: priced && form.currency === '' ? 'blank' : null,
    amount:
      priced && form.currency !== '' && readPrice(amount, language, form.currency) == null
        ? 'wrong'
        : null,
  };
}

/** The field focus moves to: the first problem in the order of the fields, the picker before the amount. */
export function firstDishProblem(problems: DishProblems): string | null {
  if (problems.name != null) return 'lib-name';
  if (problems.description != null) return 'lib-desc';
  if (problems.contains != null) return `lib-has-${DISH_ALLERGENS[0] ?? 'gluten'}`;
  const clash = problems.clashes[0];
  if (clash != null) return `lib-diet-${clash.diet}`;
  if (problems.currency != null) return 'lib-currency';
  if (problems.amount != null) return 'lib-amount';

  return null;
}

export function blankDishForm(currency: string): DishForm {
  return { name: '', description: '', allergens: [], none: false, diets: [], amount: '', currency };
}

export function dishFormOf(dish: Dish, language: DishLanguage, currency: string): DishForm {
  const price = dish.lastPrice ?? null;

  return {
    name: dish.name,
    description: dish.description ?? '',
    allergens: dish.allergens ?? [],
    none: dish.allergens != null && dish.allergens.length === 0,
    diets: dish.diets,
    amount: price == null ? '' : typedPrice(price.amount, language, price.currency),
    currency: price?.currency ?? currency,
  };
}

/** What the API takes: without budget.read no last price is sent, so an edit keeps it; a cleared amount clears it. */
export function dishDetailsOf(
  form: DishForm,
  language: DishLanguage,
  prices: boolean,
  allowShared: boolean,
): DishDetails {
  const amount =
    prices && form.amount.trim() !== '' ? readPrice(form.amount, language, form.currency) : null;
  const price = prices
    ? { lastPrice: amount == null ? null : { amount, currency: form.currency } }
    : {};

  return {
    name: form.name.trim(),
    description: form.description.trim() === '' ? null : form.description.trim(),
    allergens: form.none ? [] : DISH_ALLERGENS.filter((code) => form.allergens.includes(code)),
    containsNone: form.none,
    diets: DISH_DIETS.filter((code) => form.diets.includes(code)),
    ...price,
    ...(allowShared ? { allowShared } : {}),
  };
}

export function shownDishes(
  dishes: readonly Dish[],
  query: string,
  diets: readonly DishDiet[],
  locale: string,
): Dish[] {
  const wanted = nameKey(query);
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });

  return dishes
    .filter(
      (dish) =>
        (wanted === '' || nameKey(dish.name).includes(wanted)) &&
        diets.every((diet) => dish.diets.includes(diet)),
    )
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** The dish a name lands on, archived ones included; an active match wins over an archived one. */
export function sameNamedDish(
  name: string,
  dishes: readonly Dish[],
  exceptId: string | null,
): { dish: Dish; archivedOnly: boolean } | null {
  const key = nameKey(name);
  const matches = dishes.filter((one) => one.id !== exceptId && nameKey(one.name) === key);
  const active = matches.find((one) => one.archivedAt == null);
  const first = active ?? matches[0];

  return first == null ? null : { dish: first, archivedOnly: active == null };
}
