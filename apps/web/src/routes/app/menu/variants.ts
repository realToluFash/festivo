import type { DishPrice, MenuDish } from '@soirely/api-client';
import { type MoneyLanguage, type VariantRefusal, typedAmount } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { ShownVariant } from './VariantParts.tsx';

export const shownVariants = (dish: MenuDish): ShownVariant[] =>
  dish.variants.map((one) => ({ ...one, price: one.cost ?? null }));

export function moneyLine(price: DishPrice, language: MoneyLanguage): string {
  return `${price.currency} ${typedAmount(price.amount, language, price.currency)}`;
}

export function refusalWords(t: TFunction, refusal: VariantRefusal, variant: string): string {
  return refusal === 'picked'
    ? t('dishVariants.variantPicked')
    : t('dishVariants.lastEveryone', { variant });
}
