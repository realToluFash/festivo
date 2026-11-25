import { formatPhone } from '@soirely/domain';

import { ENQUIRY_STATES, type Enquiry, type LostReason, PEOPLE, type Person } from './enquiries.ts';
import { LOST_LINE_MOST, MIND_MOST, PAGE_WORDS as P } from './enquiryWords.ts';

export const LIST = '/demo/enquiries';
export const NEW = `${LIST}/new`;

export const PAGE_STATES = [
  'open',
  'openMember',
  'notFound',
  'withNotes',
  'editNote',
  'closeAsLost',
  'closeAsLostTooLong',
  'lost',
  'lostNoLine',
  'notAssigned',
  'whatsapp',
  'loadFailed',
  'datePassed',
] as const;
export type PageState = (typeof PAGE_STATES)[number];

export function pageStateOf(value: string | null): PageState | null {
  return PAGE_STATES.find((one) => one === value) ?? null;
}

export interface PageStart {
  viewer: Person | null;
  failed: boolean;
  closing: boolean;
  lostTyped: { reason: LostReason; line: string; pressed: boolean } | null;
  editingOwnNote: boolean;
  toNotes: boolean;
  date: string | null;
}

export const PASSED_DATE = '2026-11-07';

export function pageStart(state: PageState | null): PageStart {
  const start: PageStart = {
    viewer: state == null ? null : PEOPLE.folake,
    failed: state === 'loadFailed',
    closing: state === 'closeAsLost' || state === 'closeAsLostTooLong',
    lostTyped:
      state === 'closeAsLostTooLong'
        ? { reason: 'elsewhere', line: 'L'.repeat(LOST_LINE_MOST + 1), pressed: true }
        : null,
    editingOwnNote: state === 'editNote',
    toNotes: state === 'withNotes' || state === 'editNote',
    date: state === 'datePassed' ? PASSED_DATE : null,
  };

  return state === 'openMember' || state === 'notFound'
    ? { ...start, viewer: PEOPLE.tunde }
    : start;
}

export function whatsAppLink(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/gu, '')}`;
}

export function shownPhone(e164: string): string {
  return formatPhone(e164);
}

export function moneyWords(budget: NonNullable<Enquiry['budget']>, locale: string): string {
  const amount = Number(budget.amount);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: budget.currency,
    ...(Number.isInteger(amount) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(amount);
}

export function dayWords(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** The list's own ?state= is kept on the way back, so a result opened from a state returns to it. */
export function listPath(search: string): string {
  const state = new URLSearchParams(search).get('state');

  return ENQUIRY_STATES.some((one) => one === state) ? `${LIST}${search}` : LIST;
}

export function lostLineProblem(line: string): boolean {
  return Array.from(line.trim().normalize('NFC')).length > LOST_LINE_MOST;
}

/** A line of only spaces saves no line. */
export function lostOf(reason: LostReason, line: string): NonNullable<Enquiry['lost']> {
  const kept = line.trim();

  return { reason, line: kept === '' ? null : kept };
}

export function noteProblem(text: string): string | null {
  if (text.trim() === '') return P.noteEmpty;

  return Array.from(text.trim().normalize('NFC')).length > MIND_MOST ? P.noteLong : null;
}
