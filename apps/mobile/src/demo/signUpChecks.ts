import { phoneLengthProblem, refusedPhoneField } from '@soirely/domain';

import { COUNTRIES, type Country } from './countries.ts';

/** `?region=none`: a device whose region and languages name no country the list offers. */
export const NO_REGION = 'none';

export const COUNTRY_BLANK = 'Choose a country.';
export const NUMBER_BLANK = 'Enter your mobile number.';

/** Country and Code start from the device; blank when it names none (sc-945). */
export function startCountry(region: string | undefined): Country | null {
  return region === NO_REGION ? null : (COUNTRIES[0] ?? null);
}

/** What Send code refuses; the domain says which control the line names, so the red edge goes there (sc-30447). */
export function mobileRefusal(
  number: string,
  country: Country | null,
): { on: 'number' | 'country'; words: string } | null {
  // The demo's own check stands for the number's: fewer than six digits is a number not yet given.
  const given = number.replace(/\D/gu, '').length < 6 ? '' : number;
  const problem = phoneLengthProblem(given, country?.code ?? '');
  if (problem !== 'blank' && problem !== 'noCountry') return null;

  return refusedPhoneField(problem) === 'country'
    ? { on: 'country', words: COUNTRY_BLANK }
    : { on: 'number', words: NUMBER_BLANK };
}
