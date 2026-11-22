import {
  type Enquiry,
  type LostReason,
  PEOPLE,
  type Person,
  enquiryOf,
  personOf,
} from './EnquiriesModel.ts';
import { LINE_MOST } from './EnquiryRules.ts';

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

export function pageStateOf(value: string | undefined | null): PageState {
  return PAGE_STATES.find((state) => state === value) ?? 'open';
}

/** Each state's own enquiry, for its link in the demo's list. */
export const PAGE_IDS: Record<PageState, string> = {
  open: 'enq-ada',
  openMember: 'enq-femi',
  notFound: 'enq-ada',
  withNotes: 'enq-ada',
  editNote: 'enq-ada',
  closeAsLost: 'enq-ada',
  closeAsLostTooLong: 'enq-ada',
  lost: 'enq-ada-lost',
  lostNoLine: 'enq-ngozi',
  notAssigned: 'enq-chinedu',
  whatsapp: 'enq-ada',
  loadFailed: 'enq-ada',
  datePassed: 'enq-bisi',
};

export const PASSED_DATE = '2026-11-07';

export interface PageStart {
  viewer: Person;
  enquiry: Enquiry | null;
  editing: string | null;
  closing: { reason: LostReason | null; line: string; tried: boolean } | null;
  failed: boolean;
}

/** A Member sees only what is assigned to them; any other id answers as one that is not there. */
export function visibleEnquiry(enquiry: Enquiry | null, viewer: Person): Enquiry | null {
  if (enquiry == null) return null;

  return viewer.role !== 'member' || enquiry.assignedTo === viewer.id ? enquiry : null;
}

export function pageStartOf(
  state: PageState,
  id: string | undefined,
  as: string | undefined,
  made: (id: string | undefined) => Enquiry | null = () => null,
): PageStart {
  const viewer =
    state === 'openMember' || state === 'notFound' ? PEOPLE.tunde : (personOf(as) ?? PEOPLE.folake);
  const found = enquiryOf(id) ?? made(id);
  const enquiry = state === 'datePassed' && found != null ? { ...found, date: PASSED_DATE } : found;

  return {
    viewer,
    enquiry: visibleEnquiry(enquiry, viewer),
    editing: state === 'editNote' ? 'n1' : null,
    closing:
      state === 'closeAsLost'
        ? { reason: null, line: '', tried: false }
        : state === 'closeAsLostTooLong'
          ? { reason: 'elsewhere', line: 'L'.repeat(LINE_MOST + 1), tried: true }
          : null,
    failed: state === 'loadFailed',
  };
}

export function noteWhen(at: string, now: string, locale: string): string {
  const ago = Math.max(0, Date.parse(now) - Date.parse(at));
  const words = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (ago < 3_600_000) return words.format(-Math.max(1, Math.round(ago / 60_000)), 'minute');
  if (ago < 86_400_000) return words.format(-Math.round(ago / 3_600_000), 'hour');

  return words.format(-Math.round(ago / 86_400_000), 'day');
}

/** The newest first. */
export function notesNewestFirst<T extends { at: string }>(notes: readonly T[]): T[] {
  return [...notes].sort((a, b) => b.at.localeCompare(a.at));
}
