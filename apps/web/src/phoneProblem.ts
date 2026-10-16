import { type PhoneLengthProblem, countryChoices } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { currentLocale } from './i18n/index.ts';

/** The refusal for a typed number before it is sent, naming the country; null when it may go. */
export function phoneProblemMessage(
  problem: PhoneLengthProblem | null,
  country: string,
  t: TFunction,
): string | null {
  if (problem == null) return null;
  if (problem === 'blank') return t('verifyPhone.numberBlank');

  const name =
    countryChoices(currentLocale()).find(({ code }) => code === country)?.name ?? country;

  return t(problem === 'tooShort' ? 'verifyPhone.tooShort' : 'verifyPhone.tooLong', {
    country: name,
  });
}
