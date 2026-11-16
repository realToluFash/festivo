import {
  DISH_ALLERGENS,
  DISH_DIETS,
  VARIANT_NAME_MAXIMUM,
  VARIANTS_PER_DISH_MAXIMUM,
  type DishAllergen,
  type DishDiet,
  type DishPrice,
  type VariantDetails,
  type VariantFor,
} from '@soirely/api-client';
import { type DietClash, dietClashes, dishLength } from './dishLibrary.ts';
import { type MoneyLanguage, readAmount, typedAmount } from './money.ts';
import { nameKey } from './nameKey.ts';

/** Variants of a dish (sc-3903), on an event's menu and in the library: what the variant form checks before it sends, and what Add variant and Remove… do. */

export type VariantWhere = 'event' | 'library';

export interface VariantLike {
  id: string;
  name: string;
  for: VariantFor;
  allergens: readonly DishAllergen[];
  diets: readonly DishDiet[];
}

export interface VariantForm {
  name: string;
  for: VariantFor;
  allergens: readonly DishAllergen[];
  none: boolean;
  diets: readonly DishDiet[];
  amount: string;
  currency: string;
}

export interface VariantProblems {
  name: 'blank' | 'long' | 'taken' | null;
  for: 'noEveryone' | null;
  contains: 'blank' | null;
  clashes: { diet: DishDiet; clash: DietClash }[];
  currency: 'blank' | null;
  amount: 'wrong' | null;
}

export type VariantMode = 'addFirst' | 'add' | 'edit';

export const isForEveryone = (variant: { for: VariantFor }): boolean => variant.for === 'everyone';

export function blankVariantForm(currency: string): VariantForm {
  return { name: '', for: 'everyone', allergens: [], none: false, diets: [], amount: '', currency };
}

export function variantFormOf(
  variant: VariantLike,
  price: DishPrice | null,
  language: MoneyLanguage,
  currency: string,
): VariantForm {
  return {
    name: variant.name,
    for: variant.for,
    allergens: variant.allergens,
    none: variant.allergens.length === 0,
    diets: variant.diets,
    amount: price == null ? '' : typedAmount(price.amount, language, price.currency),
    currency: price?.currency ?? currency,
  };
}

/** Every block at once. A name repeats another variant's or a block's above it, ignoring case; when every block is Children only and no other variant is for Everyone, each block's For is refused. */
export function variantProblems(
  forms: readonly VariantForm[],
  others: readonly Pick<VariantLike, 'name' | 'for'>[],
  language: MoneyLanguage,
  prices: boolean,
): VariantProblems[] {
  const noEveryone = forms.every((one) => one.for === 'children') && !others.some(isForEveryone);

  return forms.map((form, at) => {
    const length = dishLength(form.name);
    const taken = [...others.map((one) => one.name), ...forms.slice(0, at).map((one) => one.name)];
    const amount = form.amount.trim();
    const priced = prices && amount !== '';

    return {
      name:
        length === 0
          ? 'blank'
          : length > VARIANT_NAME_MAXIMUM
            ? 'long'
            : taken.some((one) => nameKey(one) === nameKey(form.name))
              ? 'taken'
              : null,
      for: noEveryone ? 'noEveryone' : null,
      contains: form.allergens.length === 0 && !form.none ? 'blank' : null,
      clashes: dietClashes(form.allergens, form.diets),
      currency: priced && form.currency === '' ? 'blank' : null,
      amount:
        priced && form.currency !== '' && readAmount(amount, language, form.currency) == null
          ? 'wrong'
          : null,
    };
  });
}

export const variantPrefix = (at: number): string => `vb${at}-`;

/** The first problem across the blocks, in the order the fields sit; For lands on its checked radio. */
export function firstVariantProblem(
  problems: readonly VariantProblems[],
  forms: readonly VariantForm[],
): string | null {
  for (const [at, one] of problems.entries()) {
    const p = variantPrefix(at);
    if (one.name != null) return `${p}name`;
    if (one.for != null) return `${p}for-${forms[at]?.for ?? 'everyone'}`;
    if (one.contains != null) return `${p}has-${DISH_ALLERGENS[0] ?? 'gluten'}`;
    const clash = one.clashes[0];
    if (clash != null) return `${p}diet-${clash.diet}`;
    if (one.currency != null) return `${p}currency`;
    if (one.amount != null) return `${p}amount`;
  }

  return null;
}

export const hasProblem = (problems: readonly VariantProblems[]): boolean =>
  problems.some(
    (one) =>
      one.name != null ||
      one.for != null ||
      one.contains != null ||
      one.clashes.length > 0 ||
      one.currency != null ||
      one.amount != null,
  );

/** What the API takes. Without budget.read no money is sent, so an edit keeps it; a cleared amount clears it. */
export function variantDetailsOf(
  form: VariantForm,
  where: VariantWhere,
  language: MoneyLanguage,
  prices: boolean,
): VariantDetails {
  const typed = form.amount.trim();
  const amount = prices && typed !== '' ? readAmount(typed, language, form.currency) : null;
  const money = !prices
    ? {}
    : where === 'event'
      ? { cost: amount }
      : { lastPrice: amount == null ? null : { amount, currency: form.currency } };

  return {
    name: form.name.trim(),
    for: form.for,
    allergens: form.none ? [] : DISH_ALLERGENS.filter((code) => form.allergens.includes(code)),
    containsNone: form.none,
    diets: DISH_DIETS.filter((code) => form.diets.includes(code)),
    ...money,
  };
}

export type AddVariantOutcome = 'open' | 'limit' | 'picked';

export function addVariantOutcome(
  variants: readonly unknown[],
  pickedDish: boolean,
): AddVariantOutcome {
  if (variants.length >= VARIANTS_PER_DISH_MAXIMUM) return 'limit';
  if (variants.length === 0 && pickedDish) return 'picked';

  return 'open';
}

export type VariantRefusal = 'picked' | 'lastEveryone';

export type RemoveVariantOutcome =
  { kind: 'fold' | 'ask' } | { kind: 'refused'; lines: VariantRefusal[] };

/** From two it folds, otherwise it asks; a picked variant is refused first, then the last one for Everyone while two or more would be left. */
export function removeVariantOutcome(
  variants: readonly Pick<VariantLike, 'id' | 'for'>[],
  variant: Pick<VariantLike, 'id' | 'for'> & { picked?: boolean },
): RemoveVariantOutcome {
  const lines: VariantRefusal[] = [];
  if (variant.picked === true) lines.push('picked');
  if (variants.length > 2 && isForEveryone(variant) && variants.filter(isForEveryone).length === 1)
    lines.push('lastEveryone');
  if (lines.length > 0) return { kind: 'refused', lines };

  return { kind: variants.length <= 2 ? 'fold' : 'ask' };
}

/** "Everyone gets {dish}. Guests pick the way." shows under a set course only while two or more of its dish's variants are for Everyone. */
export const guestsPickTheWay = (
  dishes: readonly { variants: readonly { for: VariantFor }[] }[],
): boolean => dishes.length === 1 && (dishes[0]?.variants.filter(isForEveryone).length ?? 0) >= 2;
