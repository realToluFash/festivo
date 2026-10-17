import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from 'libphonenumber-js/min';

export type PhoneLengthProblem = 'blank' | 'noCountry' | 'tooShort' | 'tooLong';

/** Present, and a length the country uses. Full validity is the API's, by the same library's rules. */
export function phoneLengthProblem(typed: string, country: string): PhoneLengthProblem | null {
  if (typed.trim() === '') return 'blank';
  // Nothing named a country, so the code started blank: never assume one (sc-945).
  if (country === '') return 'noCountry';

  // A country the library has no lengths for is checked for presence only, and the API decides.
  if (!isPhoneCountry(country)) return null;

  switch (validatePhoneNumberLength(typed, country)) {
    case 'TOO_SHORT':
    case 'INVALID_LENGTH':
    case 'NOT_A_NUMBER':
      return 'tooShort';
    case 'TOO_LONG':
      return 'tooLong';
    default:
      return null;
  }
}

/** "+234" for Nigeria, for the code beside the number. */
export function callingCode(country: string): string | null {
  return isPhoneCountry(country) ? `+${getCountryCallingCode(country)}` : null;
}

function isPhoneCountry(country: string): country is CountryCode {
  return (getCountries() as string[]).includes(country);
}

/** "+234 803 555 0142": an E.164 number as people read it. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** The mobile number's country code on "A few details" (sc-485): it follows the Country until picked by hand. */
export interface PhoneCountry {
  code: string;
  picked: boolean;
}

/** Where it starts: the Country on the screen, else the organisation's country, else the device's region. */
export function startingPhoneCountry(
  screenCountry: string | null,
  organisationCountry: string | null,
  deviceCountry: string | null,
): PhoneCountry {
  return { code: screenCountry ?? organisationCountry ?? deviceCountry ?? '', picked: false };
}

/** A changed Country carries the code with it, unless the person has chosen the code themselves. */
export function followCountry(phone: PhoneCountry, country: string): PhoneCountry {
  return phone.picked ? phone : { code: country, picked: false };
}

export function pickPhoneCountry(code: string): PhoneCountry {
  return { code, picked: true };
}

/** The phone screens' code (sc-945): the current number's country, the account's Country, the device's region, else blank. */
export function phoneScreenCountry(
  numberCountry: string | null | undefined,
  accountCountry: string | null | undefined,
  deviceCountry: string | null | undefined,
): string {
  return (
    [numberCountry, accountCountry, deviceCountry].find((code) => code != null && code !== '') ?? ''
  );
}

/** Where focus goes when a number is refused: the code when none is chosen, else the number itself. */
export function refusedPhoneField(problem: PhoneLengthProblem | null): 'country' | 'number' | null {
  if (problem == null) return null;

  return problem === 'noCountry' ? 'country' : 'number';
}
