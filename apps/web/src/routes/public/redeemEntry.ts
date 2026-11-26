import { callingCode, deviceCountry, formatPhone } from '@soirely/domain';

export const PHONE_CODE_LENGTH = 6;

/** Signed out at a door code (sc-4235): the name and the number a code goes to. */
export interface PhoneEntry {
  named: string;
  country: string;
  number: string;
  checked: boolean;
  /** The right code was for an alternative number, which signs into nothing. */
  alternative: boolean;
  /** What the API said of each field Send code sent, until that field is typed in again. */
  refused: { name: string | null; number: string | null };
}

export function startingEntry(): PhoneEntry {
  return {
    named: '',
    country: deviceCountry(navigator.languages) ?? '',
    number: '',
    checked: false,
    alternative: false,
    refused: { name: null, number: null },
  };
}

/** "+351 912 345 412", the number the code went to as it was typed. */
export function shownNumber(entry: PhoneEntry): string {
  return formatPhone(`${callingCode(entry.country) ?? ''}${entry.number.replace(/\D/gu, '')}`);
}
