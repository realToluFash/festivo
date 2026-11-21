import { phoneFields } from '@soirely/domain';

import { type Enquiry, NOW, PEOPLE, type Person } from './EnquiriesModel.ts';
import {
  type EnquiryTyped,
  type FormField,
  NAME_MOST,
  NOTE_MOST,
  WHERE_MOST,
  budgetCheck,
  guestsCheck,
  phoneCheck,
} from './EnquiryRules.ts';

export const NEW_STATES = [
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
  'keyboardSe',
] as const;
export type NewState = (typeof NEW_STATES)[number];

export function newStateOf(value: string | undefined | null): NewState {
  return NEW_STATES.find((state) => state === value) ?? 'blank';
}

export const TODAY = NOW.slice(0, 10);
export const ORG_COUNTRY = 'GB';
export const ORG_CURRENCY = 'GBP';

export function blankFor(person: Person): EnquiryTyped {
  return {
    name: '',
    country: ORG_COUNTRY,
    number: '',
    email: '',
    mind: '',
    bestWay: null,
    type: null,
    date: '',
    guests: '',
    where: '',
    amount: '',
    currency: ORG_CURRENCY,
    foundVia: null,
    assignedTo: person.id,
  };
}

const AMA = { name: 'Ama Mensah', number: '07700 900456' };

export interface NewStart {
  viewer: Person;
  typed: EnquiryTyped;
  tried: boolean;
  /** The field each invalid state is about: refused, with focus on it. */
  refused: FormField | null;
  left: { phone: boolean; email: boolean };
  offline: boolean;
  saving: boolean;
  /** iPhone SE with the keys up: the first field takes focus as the form opens. */
  keys: boolean;
}

export function newStartOf(state: NewState): NewStart {
  const member = state === 'member' || state === 'duplicateMember';
  const viewer = member ? PEOPLE.tunde : PEOPLE.folake;
  const blank = blankFor(viewer);
  const ama = { ...blank, ...AMA };
  const start: NewStart = {
    viewer,
    typed: blank,
    tried: false,
    refused: null,
    left: { phone: false, email: false },
    offline: false,
    saving: false,
    keys: state === 'keyboardSe',
  };
  const refused = (typed: Partial<EnquiryTyped>, field: FormField): NewStart => ({
    ...start,
    typed: { ...ama, ...typed },
    tried: true,
    refused: field,
  });

  switch (state) {
    case 'nameAndPhone':
      return { ...start, typed: ama };
    case 'invalidContact':
      return refused({ number: '' }, 'contact');
    case 'invalidPhone':
      return refused({ number: '04000 000000' }, 'phone');
    case 'fixedLine':
      return { ...start, typed: { ...ama, number: '020 7946 0018' } };
    case 'phoneTooShort':
      return refused({ number: '0770 090' }, 'phone');
    case 'phoneTooLong':
      return refused({ number: '07700 900456 789' }, 'phone');
    case 'invalidDate':
      return refused({ date: '2026-11-10' }, 'date');
    case 'invalidName':
      return refused({ name: 'A'.repeat(NAME_MOST + 1) }, 'name');
    case 'invalidEmail':
      return refused({ email: 'ama@' }, 'email');
    case 'invalidGuests':
      return refused({ guests: '0' }, 'guests');
    case 'invalidWhere':
      return refused({ where: 'W'.repeat(WHERE_MOST + 1) }, 'where');
    case 'invalidBudget':
      return refused({ amount: '120.555', currency: 'GBP' }, 'budget');
    case 'invalidNote':
      return refused({ mind: 'M'.repeat(NOTE_MOST + 1) }, 'mind');
    case 'duplicateAdmin':
    case 'duplicateMember':
      return {
        ...start,
        typed: { ...blank, name: 'Ada Okafor', number: '07400 123456' },
        left: { phone: true, email: false },
      };
    case 'noConnection':
      return { ...start, typed: ama, offline: true };
    case 'saving':
      return { ...start, typed: ama, saving: true };
    default:
      return start;
  }
}

/** The enquiry's own values as Edit opens them; its notes stay in Notes. */
export function typedOf(enquiry: Enquiry): EnquiryTyped {
  const phone = enquiry.phone == null ? null : phoneFields(enquiry.phone);

  return {
    name: enquiry.client,
    country: phone?.country ?? ORG_COUNTRY,
    number: phone?.number ?? '',
    email: enquiry.email ?? '',
    mind: '',
    bestWay: enquiry.bestWay,
    type: enquiry.type,
    date: enquiry.date ?? '',
    guests: enquiry.guests == null ? '' : String(enquiry.guests),
    where: enquiry.where ?? '',
    amount: enquiry.budget?.amount ?? '',
    currency: enquiry.budget?.currency ?? ORG_CURRENCY,
    foundVia: enquiry.foundVia,
    assignedTo: enquiry.assignedTo,
  };
}

/** What Save makes of a form that passed its checks: a blank What they have in mind saves no note. */
export function savedEnquiry(
  typed: EnquiryTyped,
  viewer: Person,
  base: Enquiry | null,
  id: string,
): Enquiry {
  const phone = phoneCheck(typed.number, typed.country);
  const guests = guestsCheck(typed.guests);
  const budget = budgetCheck(typed.amount, typed.currency);
  const mind = typed.mind.trim();

  return {
    id: base?.id ?? id,
    client: typed.name.trim(),
    tab: base?.tab ?? 'open',
    type: typed.type,
    date: typed.date === '' ? null : typed.date,
    assignedTo: viewer.role === 'member' ? (base?.assignedTo ?? viewer.id) : typed.assignedTo,
    changedAt: NOW,
    phone: typeof phone === 'string' ? phone : null,
    email: typed.email.trim() === '' ? null : typed.email.trim(),
    notes: base?.notes ?? mind,
    bestWay: typed.bestWay,
    guests: typeof guests === 'number' ? guests : null,
    where: typed.where.trim() === '' ? null : typed.where.trim(),
    budget:
      budget != null && 'amount' in budget
        ? { amount: budget.amount, currency: typed.currency }
        : null,
    foundVia: typed.foundVia,
    lost: base?.lost ?? null,
    notesList:
      base?.notesList ??
      (mind === '' ? [] : [{ id: 'n1', author: viewer.id, at: NOW, text: mind, edited: false }]),
  };
}
