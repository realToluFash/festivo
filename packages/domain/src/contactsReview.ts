import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

import { emailProblem } from './forms.ts';
import { GUEST_NAME_MAXIMUM, MOST_COMPANIONS, nameLength } from './guestForm.ts';
import { nameKey } from './nameKey.ts';
import { USAGE_THRESHOLDS } from './notificationSettings.ts';
import { formatPhone, phoneE164 } from './phone.ts';

/** The most one pick adds, as the API's FROM_CONTACTS_MOST. */
export const MOST_PICKED = 250;

export interface ContactNumber {
  number: string;
  label: string;
  mobile: boolean;
}

export interface PickedPerson {
  name: string;
  numbers: readonly ContactNumber[];
  email: string | null;
}

export interface ReviewRow {
  key: string;
  name: string;
  numbers: readonly ContactNumber[];
  numberAt: number;
  country: string;
  number: string;
  email: string;
  places: number;
}

export interface RowProblems {
  name: 'blank' | 'tooLong' | null;
  number: boolean;
  email: boolean;
  listed: boolean;
}

/** The first 250 picked, each with its mobile number chosen, or else its first; `picked` is how many there were. */
export function reviewRowsOf(
  picked: readonly PickedPerson[],
  organisationCountry: string,
): { rows: ReviewRow[]; picked: number } {
  const rows = picked.slice(0, MOST_PICKED).map((person, index): ReviewRow => {
    const mobile = person.numbers.findIndex((one) => one.mobile);
    const numberAt = mobile === -1 ? 0 : mobile;

    return {
      key: `picked-${index}`,
      name: person.name.trim(),
      numbers: person.numbers,
      numberAt,
      ...numberFields(person.numbers[numberAt]?.number ?? '', organisationCountry),
      email: person.email?.trim() ?? '',
      places: 0,
    };
  });

  return { rows, picked: picked.length };
}

/** A number as written in the contact, in the field's country and national form; one written without a code is read for the organisation's country. */
export function numberFields(
  written: string,
  organisationCountry: string,
): { country: string; number: string } {
  const parsed =
    organisationCountry === ''
      ? parsePhoneNumberFromString(written)
      : parsePhoneNumberFromString(written, organisationCountry as CountryCode);

  return parsed?.country != null && parsed.isValid()
    ? { country: parsed.country, number: parsed.formatNational() }
    : { country: parsed?.country ?? organisationCountry, number: written.trim() };
}

export function readable(row: Pick<ReviewRow, 'number' | 'country'>): boolean {
  if (row.number.trim() === '') return true;
  const e164 = phoneE164(row.number, row.country);

  return e164 != null && parsePhoneNumberFromString(e164)?.isValid() === true;
}

/** "+234 803 123 4567", the E.164 the API is sent; null for no number or one that can't be read. */
export function savedAs(row: Pick<ReviewRow, 'number' | 'country'>): string | null {
  if (row.number.trim() === '' || !readable(row)) return null;
  const e164 = phoneE164(row.number, row.country);

  return e164 == null ? null : formatPhone(e164);
}

/** A row's own problems, and whether its name is already on the list or on another row of the pick: a warning, never a refusal. */
export function rowProblems(
  row: ReviewRow,
  rows: readonly ReviewRow[],
  listedNames: readonly string[],
): RowProblems {
  const key = nameKey(row.name);
  const trimmed = row.name.trim();

  return {
    name: trimmed === '' ? 'blank' : nameLength(trimmed) > GUEST_NAME_MAXIMUM ? 'tooLong' : null,
    number: !readable(row),
    email: emailProblem(row.email) === 'shape',
    listed:
      key !== '' &&
      (listedNames.some((name) => nameKey(name) === key) ||
        rows.some((other) => other.key !== row.key && nameKey(other.name) === key)),
  };
}

export function toFix(problems: RowProblems): boolean {
  return problems.name != null || problems.number || problems.email;
}

export function reviewCounts(
  rows: readonly ReviewRow[],
  listedNames: readonly string[],
): { fix: number; listed: number } {
  const all = rows.map((row) => rowProblems(row, rows, listedNames));

  return { fix: all.filter(toFix).length, listed: all.filter((one) => one.listed).length };
}

export function peopleIn(rows: readonly ReviewRow[]): number {
  return rows.reduce((sum, row) => sum + 1 + row.places, 0);
}

/** Below 80% of the plan's people per event, nothing; from it, the room left after these; past the limit, over. A plan with no limit says nothing. */
export function planRoom(
  room: { allowed: number | null; people: number },
  adding: number,
): { after: number; room: number; over: boolean; allowed: number } | null {
  if (room.allowed == null) return null;
  const after = room.people + adding;
  if (after < room.allowed * USAGE_THRESHOLDS.low) return null;

  return { after, room: room.allowed - after, over: after > room.allowed, allowed: room.allowed };
}

export function stepPlaces(places: number, by: 1 | -1): number {
  return Math.min(MOST_COMPANIONS, Math.max(0, places + by));
}

export function contactsBody(rows: readonly ReviewRow[]): {
  fullName: string;
  email: string | null;
  mobile: { countryCode: string; number: string } | null;
  companions: number;
}[] {
  return rows.map((row) => ({
    fullName: row.name.trim(),
    email: row.email.trim() === '' ? null : row.email.trim(),
    mobile: row.number.trim() === '' ? null : { countryCode: row.country, number: row.number },
    companions: row.places,
  }));
}
