import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from 'libphonenumber-js/min';

export type PhoneLengthProblem = 'blank' | 'tooShort' | 'tooLong';

/** Present, and a length the country uses. Full validity is the API's, by the same library's rules. */
export function phoneLengthProblem(typed: string, country: string): PhoneLengthProblem | null {
  if (typed.trim() === '') return 'blank';

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
