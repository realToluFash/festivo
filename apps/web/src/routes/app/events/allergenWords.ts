import { listFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';

export function allergensInSentence(
  t: TFunction,
  language: string,
  codes: readonly string[],
  type: 'conjunction' | 'disjunction' = 'conjunction',
): string {
  return listFormat(language, { type }).format(
    codes.map((code) => t(`guestNeeds.allergen.${code}`).toLocaleLowerCase(language)),
  );
}
