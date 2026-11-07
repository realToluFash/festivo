export interface Country {
  flag: string;
  dial: string;
  name: string;
}

/** A short list for the demo; the build keeps today's searchable list of every country. */
export const COUNTRIES: readonly Country[] = [
  { flag: '🇬🇧', dial: '+44', name: 'United Kingdom' },
  { flag: '🇳🇬', dial: '+234', name: 'Nigeria' },
  { flag: '🇺🇸', dial: '+1', name: 'United States' },
  { flag: '🇪🇸', dial: '+34', name: 'Spain' },
  { flag: '🇫🇷', dial: '+33', name: 'France' },
  { flag: '🇧🇷', dial: '+55', name: 'Brazil' },
  { flag: '🇵🇹', dial: '+351', name: 'Portugal' },
  { flag: '🇲🇽', dial: '+52', name: 'Mexico' },
];

/** `?region=none`: a device whose region and languages name no country the list offers. */
export const NO_REGION = 'none';

export const COUNTRY_BLANK = 'Choose a country.';
export const NUMBER_BLANK = 'Enter your mobile number.';

/** Country and Code start from the device; blank when it names none (sc-945). */
export function startCountry(region: string | undefined): Country | null {
  return region === NO_REGION ? null : (COUNTRIES[0] ?? null);
}

/** What Send code refuses, and which control the line names, so the red edge goes there (sc-30447). */
export function mobileRefusal(
  number: string,
  country: Country | null,
): { on: 'number' | 'country'; words: string } | null {
  if (number.replace(/\D/gu, '').length < 6) return { on: 'number', words: NUMBER_BLANK };
  if (country == null) return { on: 'country', words: COUNTRY_BLANK };

  return null;
}
