import type { EventType } from '@soirely/domain';

import { type Consultation, SAMPLE } from './ConsultationsModel.ts';
import {
  ENQUIRIES,
  type Enquiry,
  type EnquiryState,
  type EnquiryTab,
  type LostReason,
  NOW,
  PEOPLE,
  type Person,
  type Start,
} from './EnquiriesModel.ts';

export const ERASE_AFTER_MONTHS = 12;
export const WARN_DAYS = 30;

const DAY = 86_400_000;

export interface Erased {
  on: string;
  createdAt: string;
  closedAt: string;
  /** The event's month, YYYY-MM: the day is erased with the rest. */
  month: string | null;
  reason: LostReason | null;
}

export type ErasedEnquiry = Enquiry & { erased?: Erased };

type Kept = Omit<
  ErasedEnquiry,
  'client' | 'phone' | 'email' | 'bestWay' | 'where' | 'notesList' | 'notes' | 'date'
>;

function gone(kept: Kept): ErasedEnquiry {
  return {
    ...kept,
    client: '',
    phone: null,
    email: null,
    bestWay: null,
    where: null,
    date: null,
    notes: '',
    notesList: [],
  };
}

export const ERASED_WEDDING: ErasedEnquiry = gone({
  id: 'enq-erased',
  tab: 'lost',
  type: 'wedding',
  assignedTo: 'folake',
  changedAt: '2026-11-12T02:00:00Z',
  guests: 150,
  budget: { amount: '25000', currency: 'GBP' },
  foundVia: 'instagram',
  lost: { reason: 'stopped', line: null },
  erased: {
    on: '2026-11-12',
    createdAt: '2025-09-30T10:20:00Z',
    closedAt: '2025-11-12T16:05:00Z',
    month: '2027-06',
    reason: 'stopped',
  },
});

export const ERASED_BIRTHDAY: ErasedEnquiry = gone({
  id: 'enq-erased-birthday',
  tab: 'lost',
  type: 'birthday',
  assignedTo: 'folake',
  changedAt: '2026-08-21T02:00:00Z',
  guests: null,
  budget: null,
  foundVia: 'referral',
  lost: null,
  erased: {
    on: '2026-08-21',
    createdAt: '2025-08-02T09:00:00Z',
    closedAt: '2026-08-21T02:00:00Z',
    month: null,
    reason: null,
  },
});

/** Open, untouched since 4 Dec 2025: the clock erases it on 4 Dec 2026, inside the 30 days. */
export const QUIET: ErasedEnquiry = {
  id: 'enq-quiet',
  client: 'Tobi Alade',
  tab: 'open',
  type: 'birthday',
  date: '2027-04-17',
  assignedTo: 'kemi',
  changedAt: '2025-12-04T15:20:00Z',
  phone: '+447700900456',
  email: null,
  notes: '',
  bestWay: 'phone',
  guests: 60,
  where: null,
  budget: null,
  foundVia: 'referral',
  lost: null,
  notesList: [],
};

export const KEPT: ErasedEnquiry = {
  ...QUIET,
  id: 'enq-kept',
  client: 'Yemi Coker',
  type: 'engagement',
};

/** Held before the clock ran: the day, time, how, length and leader stay; the place and link are erased. */
export const ERASED_CONSULTATIONS: readonly Consultation[] = [
  {
    ...SAMPLE.later,
    id: 'con-erased-1',
    startsAt: '2025-10-08T13:00:00Z',
    where: null,
    link: null,
    ledBy: 'folake',
  },
  {
    ...SAMPLE.next,
    id: 'con-erased-2',
    startsAt: '2025-10-22T17:30:00Z',
    minutes: 30,
    where: null,
    link: null,
    ledBy: 'kemi',
  },
];

const EXTRA: readonly ErasedEnquiry[] = [ERASED_WEDDING, ERASED_BIRTHDAY, QUIET, KEPT];

export function extraOf(id: string | undefined): ErasedEnquiry | null {
  return EXTRA.find((one) => one.id === id) ?? null;
}

export function monthWords(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`));
}

export function shortDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day.slice(0, 10)}T12:00:00Z`));
}

/** A part it never had is left out with its separator, and an erased row never says No date yet. */
export function erasedTitle(
  enquiry: ErasedEnquiry,
  typeWord: (type: EventType) => string,
  locale: string,
): string {
  const month = enquiry.erased?.month ?? null;

  return [
    ERASE_WORDS.erasedEnquiry,
    enquiry.type == null ? null : typeWord(enquiry.type),
    month == null ? null : monthWords(month, locale),
  ]
    .filter((part) => part != null)
    .join(' · ');
}

export function eraseDay(changedAt: string): string {
  const day = new Date(changedAt);

  day.setUTCFullYear(day.getUTCFullYear() + 1);

  return day.toISOString().slice(0, 10);
}

/** Only an Open enquiry with nothing still to come is warned: Lost gets none, and one with a consultation ahead is never erased. */
export function warnsOn(
  enquiry: ErasedEnquiry,
  ahead: Consultation | null,
  now: string = NOW,
): string | null {
  if (enquiry.tab !== 'open' || enquiry.erased != null || ahead != null) return null;
  const day = eraseDay(enquiry.changedAt);
  const left = Date.parse(`${day}T00:00:00Z`) - Date.parse(now);

  return left > 0 && left <= WARN_DAYS * DAY ? day : null;
}

export function mayDelete(enquiry: Enquiry, viewer: Person): boolean {
  return viewer.role !== 'member' && enquiry.tab !== 'won';
}

export const WON_EVENT = 'Bisi Adebayo · Anniversary';

export const ERASE_WORDS = {
  erasedEnquiry: 'Erased enquiry',
  erased: 'Erased',
  erasedLine: (date: string) =>
    `The client’s details were erased on ${date}, ${ERASE_AFTER_MONTHS} months after this enquiry last changed.`,
  warning: (date: string) => `This enquiry’s details will be erased on ${date} unless it changes.`,
  dates: 'Dates',
  created: 'Created',
  closedAsLost: 'Closed as lost',
  consultations: 'Consultations',
  ledBy: (name: string) => `Led by ${name}`,
  deleteOpen: 'Delete enquiry…',
  deleteLine: 'It goes for good, with its notes and consultations. You can’t undo this.',
  deleteLineErased: 'It goes for good, with its consultations. You can’t undo this.',
  deleteTitle: 'Delete this enquiry?',
  deleteBody: (client: string) =>
    `${client}’s details, notes and consultations will be deleted for good.`,
  deleteBodyErased: 'This erased enquiry and its consultations will be deleted for good.',
  keepIt: 'Keep it',
  delete: 'Delete',
  deleting: 'Deleting…',
  tryAgain: 'Try again',
  close: 'Close',
  notDeleted: 'Not deleted. Nothing was changed. Try again.',
  offline: 'Not deleted: you’re offline. Nothing is kept to send later. Connect, then try again.',
  deleteEventFirst: 'To delete this enquiry, delete its event first.',
  deleted: 'Enquiry deleted.',
  won: 'Won',
  nothingOnDay: 'Nothing on this day.',
} as const;

export type Asking = 'none' | 'confirm' | 'deleting' | 'failed' | 'offline' | 'race';

export const ERASE_PAGE_STATES = [
  'erased-page',
  'erased-page-member',
  'erased-with-consultations',
  'warning-page',
  'warning-member',
  'delete-button',
  'delete-confirm',
  'delete-confirm-erased',
  'deleting',
  'delete-failed',
  'delete-offline',
  'member-no-delete',
  'delete-long-names',
  'won-owner',
  'won-member',
  'won-race-409',
] as const;
export type ErasePageState = (typeof ERASE_PAGE_STATES)[number];

export function erasePageStateOf(value: string | undefined | null): ErasePageState | null {
  return ERASE_PAGE_STATES.find((one) => one === value) ?? null;
}

export const ERASE_PAGE_IDS: Record<ErasePageState, string> = {
  'erased-page': 'enq-erased',
  'erased-page-member': 'enq-erased',
  'erased-with-consultations': 'enq-erased',
  'warning-page': 'enq-quiet',
  'warning-member': 'enq-quiet',
  'delete-button': 'enq-ada',
  'delete-confirm': 'enq-ada',
  'delete-confirm-erased': 'enq-erased',
  deleting: 'enq-ada',
  'delete-failed': 'enq-ada',
  'delete-offline': 'enq-ada',
  'member-no-delete': 'enq-femi',
  'delete-long-names': 'enq-long',
  'won-owner': 'enq-bisi',
  'won-member': 'enq-bisi',
  'won-race-409': 'enq-bisi',
};

export interface ErasePageStart {
  viewer: Person;
  asking: Asking;
  patch: Partial<ErasedEnquiry>;
  consultations: readonly Consultation[];
}

export function erasePageStart(state: ErasePageState): ErasePageStart {
  const start: ErasePageStart = {
    viewer: PEOPLE.folake,
    asking: 'none',
    patch: {},
    consultations: [],
  };

  switch (state) {
    case 'erased-page-member':
    case 'warning-member':
      return { ...start, viewer: PEOPLE.tunde, patch: { assignedTo: 'tunde' } };
    case 'erased-with-consultations':
      return { ...start, consultations: ERASED_CONSULTATIONS };
    case 'delete-confirm':
    case 'delete-confirm-erased':
    case 'delete-long-names':
      return { ...start, asking: 'confirm' };
    case 'deleting':
      return { ...start, asking: 'deleting' };
    case 'delete-failed':
      return { ...start, asking: 'failed' };
    case 'delete-offline':
      return { ...start, asking: 'offline' };
    case 'member-no-delete':
      return { ...start, viewer: PEOPLE.tunde };
    case 'won-owner':
      return { ...start, patch: { tab: 'won' } };
    case 'won-member':
      return { ...start, viewer: PEOPLE.tunde, patch: { tab: 'won', assignedTo: 'tunde' } };
    case 'won-race-409':
      return { ...start, asking: 'race' };
    default:
      return start;
  }
}

/** The list's states for sc-31235: the erased rows, the warning, and where Delete lands. */
export function eraseListStart(state: EnquiryState, start: Start): Start {
  const told = ERASE_WORDS.deleted;
  const without = (id: string) => ENQUIRIES.filter((one) => one.id !== id);
  const wedding = (patch: Partial<ErasedEnquiry>): ErasedEnquiry => ({
    ...ERASED_WEDDING,
    ...patch,
  });
  const noMonth = { ...ERASED_WEDDING.erased!, month: null };

  switch (state) {
    case 'lost-with-erased':
      return { ...start, tab: 'lost', enquiries: [...ENQUIRIES, ERASED_WEDDING, ERASED_BIRTHDAY] };
    case 'erased-row-no-type':
      return { ...start, tab: 'lost', enquiries: [...ENQUIRIES, wedding({ type: null })] };
    case 'erased-row-no-date':
      return {
        ...start,
        tab: 'lost',
        enquiries: [...ENQUIRIES, wedding({ erased: noMonth })],
      };
    case 'erased-row-bare':
      return {
        ...start,
        tab: 'lost',
        enquiries: [...ENQUIRIES, wedding({ type: null, erased: noMonth })],
      };
    case 'warning-row':
      return { ...start, enquiries: [...ENQUIRIES, QUIET] };
    case 'open-consultation-ahead':
      return { ...start, enquiries: [...ENQUIRIES, KEPT] };
    case 'deleted':
      return { ...start, enquiries: without('enq-chinedu'), told };
    case 'deleted-assigned-to-me':
      return {
        ...start,
        tab: 'lost',
        viewer: { person: PEOPLE.folake, mine: true },
        enquiries: [...ENQUIRIES, ERASED_BIRTHDAY],
        told,
      };
    case 'deleted-from-link':
      return { ...start, enquiries: without('enq-long'), told };
    default:
      return start;
  }
}

export interface Landing {
  tab: EnquiryTab | null;
  mine: boolean | null;
  deleted: string | null;
}

/** Where Delete lands: the list as it was opened from, or Enquiries' Open tab for a link with nothing behind it. */
export function landingHref(
  id: string,
  from: string | undefined,
  back: string | undefined,
): string {
  const kept = new URLSearchParams(from === 'list' ? (back ?? '') : '');

  kept.set('deleted', id);

  return `/demo/enquiries?${kept.toString()}`;
}

export function backQuery(state: EnquiryState, tab: EnquiryTab, mine: boolean): string {
  const query = new URLSearchParams();

  if (state !== 'idle') query.set('state', state);
  query.set('tab', tab);
  if (mine) query.set('mine', '1');

  return query.toString();
}

export function landingOf(params: { tab?: string; mine?: string; deleted?: string }): Landing {
  const tab =
    params.tab === 'open' || params.tab === 'won' || params.tab === 'lost' ? params.tab : null;

  return {
    tab,
    mine: params.mine == null ? null : params.mine === '1',
    deleted: params.deleted ?? null,
  };
}

export function landedStart(start: Start, landing: Landing): Start {
  if (landing.deleted == null) return start;

  return {
    ...start,
    tab: landing.tab ?? start.tab,
    viewer: { ...start.viewer, mine: landing.mine ?? start.viewer.mine },
    enquiries: start.enquiries.filter((one) => one.id !== landing.deleted),
    told: ERASE_WORDS.deleted,
  };
}

export const ERASE_BOARDS: readonly { title: string; what: string; href: string }[] = [
  ...(
    [
      [
        'lost-with-erased',
        'Lost · two erased',
        'The newest erasure first, each with the Erased chip',
      ],
      ['erased-row-no-type', 'Lost · erased, no type', 'Erased enquiry · June 2027'],
      [
        'erased-row-no-date',
        'Lost · erased, no date',
        'Erased enquiry · Wedding, never No date yet',
      ],
      ['erased-row-bare', 'Lost · erased, bare', 'Erased enquiry alone'],
      [
        'warning-row',
        'Open · the warning',
        'Tobi Alade’s row: erased on Dec 4, 2026 unless it changes',
      ],
      [
        'open-consultation-ahead',
        'Open · a consultation ahead',
        'Yemi Coker: the consultation line, no warning',
      ],
      ['deleted', 'After Delete · Open', 'Enquiry deleted., Chinedu gone'],
      [
        'deleted-assigned-to-me',
        'After Delete · Lost, Assigned to me',
        'The tab and the filter kept',
      ],
      ['deleted-from-link', 'After Delete · from a link', 'Enquiries, Open'],
    ] as const
  ).map(([state, title, what]) => ({ title, what, href: `/demo/enquiries?state=${state}` })),
  {
    title: 'After Delete · the Calendar',
    what: 'Its consultations gone: Nothing on this day.',
    href: '/demo/consultations?state=deleted-from-calendar',
  },
  ...(
    [
      ['erased-page', 'Erased · the page', 'Only what is kept, read only, the Dates card'],
      ['erased-page-member', 'Erased · its Member', 'The same, no Delete enquiry'],
      [
        'erased-with-consultations',
        'Erased · consultations',
        'Day, time, how and Led by; no place or link',
      ],
      ['warning-page', 'Warning · the page', 'The note at the top; Open stays the status'],
      ['warning-member', 'Warning · its Member', 'Members see it too'],
      ['delete-button', 'Delete enquiry…', 'At the foot, its consequence under it'],
      ['delete-confirm', 'Delete · the confirm', 'A sheet on the phone, centred on the iPad'],
      ['delete-confirm-erased', 'Delete · erased', 'No client named'],
      ['deleting', 'Delete · Deleting…', 'Both buttons off, busy'],
      ['delete-failed', 'Delete · not deleted', 'The alert inside; Delete becomes Try again'],
      ['delete-offline', 'Delete · offline', 'Refused at once, nothing queued'],
      ['member-no-delete', 'Delete · a Member', 'No Delete enquiry'],
      ['delete-long-names', 'Delete · a long name', 'The confirm with a long client’s name'],
      ['won-owner', 'Won · an Owner', 'Delete its event first, with the link'],
      ['won-member', 'Won · a Member', 'Neither'],
      ['won-race-409', 'Won · while the confirm was open', 'The note and link, Close only'],
    ] as const
  ).map(([state, title, what]) => ({
    title,
    what,
    href: `/demo/enquiries/${ERASE_PAGE_IDS[state]}?state=${state}`,
  })),
];
