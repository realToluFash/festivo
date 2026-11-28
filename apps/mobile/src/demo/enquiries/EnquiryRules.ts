import {
  CURRENCY_CODES,
  countryChoices,
  emailProblem,
  phoneE164,
  phoneLengthProblem,
} from '@soirely/domain';

import type { Enquiry, Person } from './EnquiriesModel.ts';

export const NAME_MOST = 100;
export const NOTE_MOST = 5000;
export const WHERE_MOST = 200;
export const LINE_MOST = 200;
export const GUESTS_MOST = 100_000;
export const NOTE_COUNTER_FROM = 4500;

export const E = {
  nameBlank: 'Enter the client’s name.',
  nameLong: 'Keep the name to 100 characters.',
  phone: {
    invalid: (country: string) =>
      `That is not a phone number for ${country}. Check it and try again.`,
    tooShort: (country: string) =>
      `That number looks too short for ${country}. Check it and try again.`,
    tooLong: (country: string) =>
      `That number looks too long for ${country}. Check it and try again.`,
  },
  email: 'That does not look like an email address. Check it has an @ and a domain.',
  contact: 'Add a phone or an email, so you can reach the client.',
  noteLong: 'Keep it to 5,000 characters.',
  noteBlank: 'Write the note first.',
  datePassed: 'The date has passed.',
  guests: 'Enter a whole number from 1 to 100,000.',
  whereLong: 'Keep it to 200 characters.',
  amount: 'Enter an amount above 0.',
  decimals: (currency: string, digits: number) =>
    digits === 0
      ? `${currency} takes no decimal places.`
      : `${currency} takes ${digits} decimal ${digits === 1 ? 'place' : 'places'}.`,
  currency: 'Choose a currency from the list.',
  reason: 'Choose why it was lost.',
  lineLong: 'Keep it to 200 characters.',
} as const;

/** ISO 4217 minor units where they are not 2. */
const MINOR_UNITS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency] ?? 2;
}

export function isCurrency(code: string): boolean {
  return CURRENCY_CODES.includes(code);
}

export function budgetCheck(
  typed: string,
  currency: string,
): { amount: string } | { problem: string } | null {
  const plain = typed.trim().replaceAll(',', '');
  if (plain === '') return null;
  if (!isCurrency(currency)) return { problem: E.currency };
  const found = /^(\d+)(?:\.(\d+))?$/u.exec(plain);
  if (found == null || Number(plain) <= 0) return { problem: E.amount };
  const fraction = found[2] ?? '';
  const digits = minorUnits(currency);
  if (fraction.length > digits) return { problem: E.decimals(currency, digits) };

  return { amount: fraction === '' ? (found[1] ?? '') : `${found[1]}.${fraction}` };
}

export function guestsCheck(typed: string): number | 'refused' | null {
  const plain = typed.trim().replaceAll(',', '');
  if (plain === '') return null;
  if (!/^\d+$/u.test(plain)) return 'refused';
  const guests = Number(plain);

  return guests >= 1 && guests <= GUESTS_MOST ? guests : 'refused';
}

export function letters(text: string): number {
  return [...text].length;
}

const WITH_THE: ReadonlySet<string> = new Set(['AE', 'BS', 'GB', 'GM', 'NL', 'PH', 'US']);

/** A country's name as it reads in a sentence: "for the United Kingdom". */
export function countryName(code: string): string {
  const name = countryChoices('en').find((one) => one.code === code)?.name ?? code;

  return WITH_THE.has(code) && !name.startsWith('the ') ? `the ${name}` : name;
}

export type PhoneProblem = 'invalid' | 'tooShort' | 'tooLong';

/** Stands in for the server's check of a UK number: ten digits after the 0, in a range that is dialled. */
function ukProblem(e164: string): PhoneProblem | null {
  const national = e164.slice(3);
  if (national.length < 10) return 'tooShort';
  if (national.length > 10) return 'tooLong';

  return /^[12378]/u.test(national) ? null : 'invalid';
}

/** E.164, or null with nothing typed, or the account phone's refusal; a fixed line is a phone too. */
export function phoneCheck(
  number: string,
  country: string,
): string | { problem: PhoneProblem } | null {
  if (number.trim() === '') return null;
  const length = phoneLengthProblem(number, country);
  if (length === 'tooShort' || length === 'tooLong') return { problem: length };
  const e164 = phoneE164(number, country);
  if (e164 == null || length != null) return { problem: 'invalid' };
  const uk = e164.startsWith('+44') ? ukProblem(e164) : null;

  return uk == null ? e164 : { problem: uk };
}

export function datePassed(date: string, today: string, saved: string | null): boolean {
  return date !== '' && date !== saved && date < today;
}

export interface EnquiryTyped {
  name: string;
  country: string;
  number: string;
  email: string;
  mind: string;
  bestWay: Enquiry['bestWay'];
  type: Enquiry['type'];
  date: string;
  guests: string;
  where: string;
  amount: string;
  currency: string;
  foundVia: Enquiry['foundVia'];
  assignedTo: string | null;
}

export const FIELDS = [
  'name',
  'phone',
  'email',
  'contact',
  'mind',
  'date',
  'guests',
  'where',
  'budget',
] as const;
export type FormField = (typeof FIELDS)[number];
export type Refusals = Partial<Record<FormField, string>>;

/** What Save checks before it sends, each field's own words; the date only when it is not the one saved. */
export function refusalsOf(
  typed: EnquiryTyped,
  today: string,
  savedDate: string | null = null,
): Refusals {
  const found: Refusals = {};
  const name = typed.name.trim();
  if (name === '') found.name = E.nameBlank;
  else if (letters(name) > NAME_MOST) found.name = E.nameLong;
  const phone = phoneCheck(typed.number, typed.country);
  if (phone != null && typeof phone !== 'string')
    found.phone = E.phone[phone.problem](countryName(typed.country));
  const email = typed.email.trim();
  if (email !== '' && emailProblem(email) != null) found.email = E.email;
  if (phone == null && email === '') found.contact = E.contact;
  if (letters(typed.mind) > NOTE_MOST) found.mind = E.noteLong;
  if (datePassed(typed.date, today, savedDate)) found.date = E.datePassed;
  if (guestsCheck(typed.guests) === 'refused') found.guests = E.guests;
  if (letters(typed.where.trim()) > WHERE_MOST) found.where = E.whereLong;
  const budget = budgetCheck(typed.amount, typed.currency);
  if (budget != null && 'problem' in budget) found.budget = budget.problem;

  return found;
}

export function firstRefused(refusals: Refusals): FormField | null {
  const first = FIELDS.find((field) => refusals[field] != null) ?? null;

  return first === 'contact' ? 'phone' : first;
}

export type SameClient =
  { by: 'phone' | 'email'; seen: true; enquiry: Enquiry } | { by: 'phone' | 'email'; seen: false };

function emailKey(email: string): string {
  return email.trim().toLocaleLowerCase('en');
}

/** An Open enquiry with the same phone, by its E.164 form, or the same email, case and outer spaces ignored. */
export function sameClient(
  enquiries: readonly Enquiry[],
  by: 'phone' | 'email',
  typed: { number: string; country: string; email: string },
  viewer: Person,
  except: string | null = null,
): SameClient | null {
  const phone = by === 'phone' ? phoneCheck(typed.number, typed.country) : null;
  const email = by === 'email' ? emailKey(typed.email) : '';
  if (by === 'phone' ? typeof phone !== 'string' : emailProblem(email) != null) return null;
  const match = enquiries.find(
    (enquiry) =>
      enquiry.tab === 'open' &&
      enquiry.id !== except &&
      (by === 'phone'
        ? enquiry.phone === phone
        : enquiry.email != null && emailKey(enquiry.email) === email),
  );
  if (match == null) return null;

  return viewer.role !== 'member' || match.assignedTo === viewer.id
    ? { by, seen: true, enquiry: match }
    : { by, seen: false };
}

export function noteProblem(text: string): string | null {
  if (text.trim() === '') return E.noteBlank;

  return letters(text) > NOTE_MOST ? E.noteLong : null;
}

export function lostProblems(
  reason: string | null,
  line: string,
): { reason?: string; line?: string } {
  return {
    ...(reason == null ? { reason: E.reason } : {}),
    ...(letters(line.trim()) > LINE_MOST ? { line: E.lineLong } : {}),
  };
}

export function savedLine(line: string): string | null {
  return line.trim() === '' ? null : line.trim();
}

/** Money in its own currency, its minor unit shown only when the amount has one. */
export function moneyWords(budget: { amount: string; currency: string }, locale: string): string {
  const fraction = budget.amount.includes('.');
  const digits = minorUnits(budget.currency);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: budget.currency,
    minimumFractionDigits: fraction ? digits : 0,
    maximumFractionDigits: digits,
  }).format(Number(budget.amount));
}

export function counterWords(count: number, most: number): string {
  return `${count.toLocaleString('en')} of ${most.toLocaleString('en')}`;
}
