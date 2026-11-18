import {
  CURRENCY_CODES,
  type EventType,
  callingCode,
  countryChoices,
  emailProblem,
  phoneE164,
  phoneFields,
  phoneLengthProblem,
} from '@soirely/domain';

import {
  type BestWay,
  type Enquiry,
  type FoundVia,
  NOW,
  ORG_COUNTRY,
  ORG_CURRENCY,
  ORG_ZONE,
  PEOPLE,
  type Person,
  canSee,
  personOf,
} from './enquiries.ts';
import { FORM_WORDS as F, GUESTS_MOST, MIND_MOST, NAME_MOST, WHERE_MOST } from './enquiryWords.ts';

export interface EnquiryTyped {
  client: string;
  country: string;
  phone: string;
  email: string;
  mind: string;
  bestWay: BestWay | null;
  type: EventType | '';
  date: string;
  guests: string;
  where: string;
  amount: string;
  currency: string;
  foundVia: FoundVia | null;
  assignedTo: string | null;
}

export const FIELDS = [
  'client',
  'phone',
  'email',
  'contact',
  'mind',
  'date',
  'guests',
  'where',
  'amount',
  'currency',
] as const;
export type Field = (typeof FIELDS)[number];
export type Problems = Partial<Record<Field, string>>;

export function blankTyped(viewer: Person): EnquiryTyped {
  return {
    client: '',
    country: ORG_COUNTRY,
    phone: '',
    email: '',
    mind: '',
    bestWay: null,
    type: '',
    date: '',
    guests: '',
    where: '',
    amount: '',
    currency: ORG_CURRENCY,
    foundVia: null,
    assignedTo: viewer.id,
  };
}

/** What the server counts: code points of the text that will be saved. */
export function lengthOf(typed: string): number {
  return Array.from(typed.trim().normalize('NFC')).length;
}

const WITH_THE = new Set([
  'AE',
  'BS',
  'CD',
  'CF',
  'DO',
  'GB',
  'GM',
  'KM',
  'MH',
  'MV',
  'NL',
  'PH',
  'SB',
  'US',
]);

export function countryName(code: string): string {
  const name = countryChoices('en').find((one) => one.code === code)?.name ?? code;

  return WITH_THE.has(code) ? `the ${name}` : name;
}

export function nameProblem(typed: string): string | null {
  if (typed.trim() === '') return F.nameBlank;

  return lengthOf(typed) > NAME_MOST ? F.nameLong : null;
}

const NOT_DIALLED = /[^\d\s().+-]/u;

/** The demo's stand-in for the API's full check, which the account's length check passes "0770 090" through. */
const NATIONAL_DIGITS: Readonly<Record<string, number>> = { GB: 10, NG: 10, US: 10, FR: 9 };

function lengthWrong(typed: string, country: string): 'tooShort' | 'tooLong' | null {
  const problem = phoneLengthProblem(typed, country);
  if (problem === 'tooShort' || problem === 'tooLong') return problem;
  const most = NATIONAL_DIGITS[country];
  const code = callingCode(country)?.slice(1) ?? '';
  if (most == null) return null;
  let digits = typed.replaceAll(/\D/gu, '');
  if (typed.trim().startsWith('+')) digits = digits.slice(code.length);
  else if (digits.startsWith(`00${code}`)) digits = digits.slice(code.length + 2);
  digits = digits.replace(/^0+/u, '');
  if (digits.length < most) return 'tooShort';

  return digits.length > most ? 'tooLong' : null;
}

/** A fixed line is accepted as a mobile is (pm, #67118). */
export function phoneOfTyped(typed: string, country: string): string | null {
  if (typed.trim() === '' || NOT_DIALLED.test(typed)) return null;

  return lengthWrong(typed, country) == null ? phoneE164(typed, country) : null;
}

export function phoneProblem(typed: string, country: string): string | null {
  if (typed.trim() === '') return null;
  const named = countryName(country);
  if (NOT_DIALLED.test(typed)) return F.phoneWrong(named);
  const problem = lengthWrong(typed, country);
  if (problem === 'tooShort') return F.phoneShort(named);
  if (problem === 'tooLong') return F.phoneLong(named);

  return phoneE164(typed, country) == null ? F.phoneWrong(named) : null;
}

export function emailWrong(typed: string): string | null {
  return emailProblem(typed) === 'shape' ? F.emailWrong : null;
}

export function contactProblem(phone: string, email: string): string | null {
  return phone.trim() === '' && email.trim() === '' ? F.contactMissing : null;
}

export function mindProblem(typed: string): string | null {
  return lengthOf(typed) > MIND_MOST ? F.mindLong : null;
}

export function todayIn(zone: string, now: string = NOW): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(now));
}

/** Only a date set or changed is checked, so an enquiry whose date has gone by still takes other edits. */
export function dateProblem(typed: string, saved: string | null, today: string): string | null {
  if (typed === '' || typed === saved) return null;

  return typed < today ? F.datePassed : null;
}

export function guestsOf(typed: string): number | null {
  const plain = typed.trim().replace(/,(?=\d{3}(?:,|$))/gu, '');
  if (!/^\d+$/u.test(plain)) return null;
  const count = Number(plain);

  return count >= 1 && count <= GUESTS_MOST ? count : null;
}

export function guestsProblem(typed: string): string | null {
  return typed.trim() === '' || guestsOf(typed) != null ? null : F.guestsWrong;
}

export function whereProblem(typed: string): string | null {
  return lengthOf(typed) > WHERE_MOST ? F.whereLong : null;
}

const NO_DECIMALS = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'UYI',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
const THREE_DECIMALS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
const FOUR_DECIMALS = new Set(['CLF', 'UYW']);

/** ISO 4217's minor unit, which CLDR's display digits do not always follow (IQD, for one). */
export function minorUnits(currency: string): number {
  if (NO_DECIMALS.has(currency)) return 0;
  if (THREE_DECIMALS.has(currency)) return 3;

  return FOUR_DECIMALS.has(currency) ? 4 : 2;
}

export function isCurrency(code: string): boolean {
  return CURRENCY_CODES.includes(code);
}

export function amountOf(typed: string, currency: string): string | null {
  const plain = typed.trim().replace(/,(?=\d{3}(?:[,.]|$))/gu, '');
  const found = /^(\d+)(?:\.(\d+))?$/u.exec(plain);
  if (found == null || !isCurrency(currency)) return null;
  const [, whole = '0', fraction = ''] = found;
  if (fraction.length > minorUnits(currency)) return null;
  if (!/[1-9]/u.test(whole + fraction)) return null;

  return fraction === '' ? String(Number(whole)) : `${Number(whole)}.${fraction}`;
}

export function amountProblem(typed: string, currency: string): Problems {
  if (typed.trim() === '') return {};
  if (!isCurrency(currency)) return { currency: F.notCode };
  const plain = typed.trim().replace(/,(?=\d{3}(?:[,.]|$))/gu, '');
  const found = /^-?(\d+)(?:\.(\d+))?$/u.exec(plain);
  if (found == null || plain.startsWith('-') || !/[1-9]/u.test(plain))
    return { amount: F.amountLow };
  const places = minorUnits(currency);

  return (found[2] ?? '').length > places ? { amount: F.decimals(currency, places) } : {};
}

export function problemsOf(typed: EnquiryTyped, savedDate: string | null = null): Problems {
  const found: Problems = {
    ...amountProblem(typed.amount, typed.currency),
  };
  const add = (field: Field, problem: string | null) => {
    if (problem != null) found[field] = problem;
  };

  add('client', nameProblem(typed.client));
  add('phone', phoneProblem(typed.phone, typed.country));
  add('email', emailWrong(typed.email));
  add('contact', contactProblem(typed.phone, typed.email));
  add('mind', mindProblem(typed.mind));
  add('date', dateProblem(typed.date, savedDate, todayIn(ORG_ZONE)));
  add('guests', guestsProblem(typed.guests));
  add('where', whereProblem(typed.where));

  return found;
}

export function firstFailing(problems: Problems): Field | null {
  return FIELDS.find((field) => problems[field] != null) ?? null;
}

export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('en') === b.trim().toLocaleLowerCase('en');
}

/** Open enquiries only: Won and Lost are never matched. */
export function duplicateOf(
  enquiries: readonly Enquiry[],
  by: 'phone' | 'email',
  typed: EnquiryTyped,
  except: string | null = null,
): Enquiry | null {
  const phone = by === 'phone' ? phoneOfTyped(typed.phone, typed.country) : null;
  const email = by === 'email' && emailProblem(typed.email) == null ? typed.email : null;
  if (phone == null && email == null) return null;

  return (
    enquiries.find(
      (one) =>
        one.tab === 'open' &&
        one.id !== except &&
        (phone != null
          ? one.phone === phone
          : one.email != null && email != null && sameEmail(one.email, email)),
    ) ?? null
  );
}

export interface DuplicateSaid {
  line: string;
  to: string | null;
}

export function duplicateSaid(
  match: Enquiry,
  by: 'phone' | 'email',
  viewer: Person,
): DuplicateSaid {
  if (!canSee(match, viewer)) return { line: F.duplicateHidden(by), to: null };

  return {
    line: F.duplicate(by, match.client, personOf(match.assignedTo)?.name ?? null),
    to: `/demo/enquiries/${match.id}`,
  };
}

export function typedOf(enquiry: Enquiry): EnquiryTyped {
  const phone = enquiry.phone == null ? null : phoneFields(enquiry.phone);

  return {
    client: enquiry.client,
    country: phone?.country ?? ORG_COUNTRY,
    phone: phone?.number ?? '',
    email: enquiry.email ?? '',
    mind: '',
    bestWay: enquiry.bestWay,
    type: enquiry.type ?? '',
    date: enquiry.date ?? '',
    guests: enquiry.guests == null ? '' : String(enquiry.guests),
    where: enquiry.where ?? '',
    amount: enquiry.budget?.amount ?? '',
    currency: enquiry.budget?.currency ?? ORG_CURRENCY,
    foundVia: enquiry.foundVia,
    assignedTo: enquiry.assignedTo,
  };
}

/** The enquiry a valid form saves; What they have in mind becomes its first note, by its creator, unless blank. */
export function savedEnquiry(
  typed: EnquiryTyped,
  viewer: Person,
  was: Enquiry | null,
  id: string,
): Enquiry {
  const mind = typed.mind.trim();
  const amount = amountOf(typed.amount, typed.currency);
  const assignedTo = viewer.role === 'member' ? (was?.assignedTo ?? viewer.id) : typed.assignedTo;

  return {
    id,
    tab: was?.tab ?? 'open',
    lost: was?.lost ?? null,
    client: typed.client.trim(),
    type: typed.type === '' ? null : typed.type,
    date: typed.date === '' ? null : typed.date,
    assignedTo,
    changedAt: NOW,
    phone: phoneOfTyped(typed.phone, typed.country),
    email: typed.email.trim() === '' ? null : typed.email.trim(),
    bestWay: typed.bestWay,
    guests: guestsOf(typed.guests),
    where: typed.where.trim() === '' ? null : typed.where.trim(),
    budget: amount == null ? null : { amount, currency: typed.currency },
    foundVia: typed.foundVia,
    notesList:
      was?.notesList ??
      (mind === '' ? [] : [{ id: 'n1', author: viewer.id, at: NOW, text: mind, edited: false }]),
  };
}

export const FORM_STATES = [
  'blank',
  'nameAndPhone',
  'invalidContact',
  'invalidPhone',
  'fixedLine',
  'phoneTooShort',
  'phoneTooLong',
  'invalidDate',
  'invalidName',
  'invalidEmail',
  'invalidGuests',
  'invalidWhere',
  'invalidBudget',
  'invalidNote',
  'duplicateAdmin',
  'duplicateMember',
  'noConnection',
  'member',
  'saving',
] as const;
export type FormState = (typeof FORM_STATES)[number];

export function formStateOf(value: string | null): FormState {
  return FORM_STATES.find((one) => one === value) ?? 'blank';
}

export interface FormStart {
  viewer: Person;
  typed: EnquiryTyped;
  pressed: boolean;
  duplicate: 'phone' | null;
  offline: boolean;
  saving: boolean;
}

const AMA = { client: 'Ama Mensah', phone: '07700 900456' };

export function formStart(state: FormState): FormStart {
  const member = state === 'member' || state === 'duplicateMember';
  const viewer: Person = member ? PEOPLE.tunde : PEOPLE.folake;
  const blank = blankTyped(viewer);
  const start: FormStart = {
    viewer,
    typed: blank,
    pressed: state.startsWith('invalid') || state === 'phoneTooShort' || state === 'phoneTooLong',
    duplicate: null,
    offline: state === 'noConnection',
    saving: state === 'saving',
  };
  const filled = { ...blank, ...AMA };

  switch (state) {
    case 'nameAndPhone':
    case 'noConnection':
    case 'saving':
      return { ...start, typed: filled };
    case 'invalidContact':
      return {
        ...start,
        typed: { ...blank, client: AMA.client, mind: 'A naming ceremony in March, at home.' },
      };
    case 'invalidPhone':
      return { ...start, typed: { ...filled, phone: '07400 12345O' } };
    case 'fixedLine':
      return { ...start, typed: { ...filled, phone: '020 7946 0018' } };
    case 'phoneTooShort':
      return { ...start, typed: { ...filled, phone: '0770 090' } };
    case 'phoneTooLong':
      return { ...start, typed: { ...filled, phone: '07700 900456 789' } };
    case 'invalidDate':
      return { ...start, typed: { ...filled, date: '2026-11-10' } };
    case 'invalidName':
      return { ...start, typed: { ...filled, client: 'A'.repeat(NAME_MOST + 1) } };
    case 'invalidEmail':
      return { ...start, typed: { ...blank, client: AMA.client, email: 'ama@' } };
    case 'invalidGuests':
      return { ...start, typed: { ...filled, guests: '0' } };
    case 'invalidWhere':
      return { ...start, typed: { ...filled, where: 'W'.repeat(WHERE_MOST + 1) } };
    case 'invalidBudget':
      return { ...start, typed: { ...filled, amount: '120.555', currency: 'GBP' } };
    case 'invalidNote':
      return { ...start, typed: { ...filled, mind: 'M'.repeat(MIND_MOST + 1) } };
    case 'duplicateAdmin':
    case 'duplicateMember':
      return {
        ...start,
        typed: { ...blank, client: 'Ada Okafor', phone: '07400 123456' },
        duplicate: 'phone',
      };
    default:
      return start;
  }
}
