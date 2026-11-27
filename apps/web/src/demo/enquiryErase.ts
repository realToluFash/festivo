import type { EventType } from '@soirely/domain';

import { type Consultation, SAMPLE } from './consultations.ts';
import {
  ENQUIRIES,
  type Enquiry,
  type EnquiryState,
  LONG_CLIENT,
  NOW,
  PEOPLE,
  type Person,
  type Start,
} from './enquiries.ts';
import { MADE_FROM } from './enquiryToEvent.ts';
import type { DemoLink } from './settings.ts';

export const ERASE_AFTER_MONTHS = 12;
export const WARN_DAYS = 30;

const DAY = 86_400_000;

function gone(
  base: Omit<Enquiry, 'client' | 'phone' | 'email' | 'bestWay' | 'where' | 'notesList' | 'date'>,
): Enquiry {
  return {
    ...base,
    client: '',
    phone: null,
    email: null,
    bestWay: null,
    where: null,
    date: null,
    notesList: [],
  };
}

export const ERASED_WEDDING: Enquiry = gone({
  id: 'enq-erased',
  tab: 'lost',
  type: 'wedding',
  assignedTo: 'folake',
  changedAt: '2026-11-12T02:00:00Z',
  guests: 150,
  budget: { amount: '25000', currency: 'GBP' },
  foundVia: 'instagram',
  lost: { reason: 'silent', line: null },
  erased: {
    on: '2026-11-12',
    createdAt: '2025-09-30T10:20:00Z',
    closedAt: '2025-11-12T16:05:00Z',
    month: '2027-06',
    reason: 'silent',
  },
});

export const ERASED_BIRTHDAY: Enquiry = gone({
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
export const QUIET: Enquiry = {
  id: 'enq-quiet',
  client: 'Tobi Alade',
  tab: 'open',
  type: 'birthday',
  date: '2027-04-17',
  assignedTo: 'kemi',
  changedAt: '2025-12-04T15:20:00Z',
  phone: '+447700900456',
  email: null,
  bestWay: 'phone',
  guests: 60,
  where: null,
  budget: null,
  foundVia: 'referral',
  lost: null,
  notesList: [],
};

export const KEPT: Enquiry = { ...QUIET, id: 'enq-kept', client: 'Yemi Coker', type: 'engagement' };

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

const EXTRA: readonly Enquiry[] = [ERASED_WEDDING, ERASED_BIRTHDAY, QUIET, KEPT];

export function extraOf(id: string): Enquiry | null {
  return EXTRA.find((one) => one.id === id) ?? null;
}

export function isErased(enquiry: Enquiry): boolean {
  return enquiry.erased != null;
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
  enquiry: Enquiry,
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
  enquiry: Enquiry,
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

export const WON_EVENT = {
  name: 'Bisi Adebayo · Anniversary',
  to: `/demo/events/${MADE_FROM}?state=from-enquiry`,
};

export const ERASE_WORDS = {
  erasedEnquiry: 'Erased enquiry',
  erased: 'Erased',
  erasedLine: (date: string) =>
    `The client’s details were erased on ${date}, ${ERASE_AFTER_MONTHS} months after this enquiry last changed.`,
  warning: (date: string) => `This enquiry’s details will be erased on ${date} unless it changes.`,
  dates: 'Dates',
  created: 'Created',
  closedAsLost: 'Closed as lost',
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

export function erasePageStateOf(value: string | null): ErasePageState | null {
  return ERASE_PAGE_STATES.find((one) => one === value) ?? null;
}

export interface ErasePageStart {
  viewer: Person;
  asking: Asking;
  patch: Partial<Enquiry>;
  consultations: readonly Consultation[];
  failsOnce: boolean;
}

export function erasePageStart(state: ErasePageState): ErasePageStart {
  const start: ErasePageStart = {
    viewer: PEOPLE.folake,
    asking: 'none',
    patch: {},
    consultations: [],
    failsOnce: false,
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
      return { ...start, viewer: PEOPLE.tunde, patch: { tab: 'won' } };
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

  switch (state) {
    case 'lost-with-erased':
      return { ...start, tab: 'lost', enquiries: [...ENQUIRIES, ERASED_WEDDING, ERASED_BIRTHDAY] };
    case 'erased-row-no-type':
      return {
        ...start,
        tab: 'lost',
        enquiries: [...ENQUIRIES, { ...ERASED_WEDDING, type: null }],
      };
    case 'erased-row-no-date':
      return {
        ...start,
        tab: 'lost',
        enquiries: [
          ...ENQUIRIES,
          { ...ERASED_WEDDING, erased: { ...ERASED_WEDDING.erased!, month: null } },
        ],
      };
    case 'erased-row-bare':
      return {
        ...start,
        tab: 'lost',
        enquiries: [
          ...ENQUIRIES,
          { ...ERASED_WEDDING, type: null, erased: { ...ERASED_WEDDING.erased!, month: null } },
        ],
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

export const LONG_ENQUIRY_ID =
  ENQUIRIES.find((one) => one.client === LONG_CLIENT)?.id ?? 'enq-long';

const list = (state: EnquiryState, name: string): DemoLink => ({
  to: `/demo/enquiries?state=${state}`,
  name,
});

const page = (id: string, state: ErasePageState, name: string): DemoLink => ({
  to: `/demo/enquiries/${id}?state=${state}`,
  name,
});

export const ERASE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Erased after 12 months (sc-31235)',
    states: [
      list('lost-with-erased', 'Lost with two erased rows, the newest erasure first'),
      list('erased-row-no-type', 'An erased row with no event type'),
      list('erased-row-no-date', 'An erased row with no date: never No date yet'),
      list('erased-row-bare', 'An erased row with neither: Erased enquiry alone'),
      page('enq-erased', 'erased-page', 'An erased enquiry’s page, as an Owner'),
      page('enq-erased', 'erased-page-member', 'An erased enquiry’s page, as its Member'),
      page('enq-erased', 'erased-with-consultations', 'Erased, with two held consultations'),
    ],
  },
  {
    name: 'The 30-day warning (sc-31235)',
    states: [
      list('warning-row', 'Open: Tobi Alade’s row says when it will be erased'),
      list('open-consultation-ahead', 'Open with a consultation to come: no warning'),
      page('enq-quiet', 'warning-page', 'The warning on the page, as an Owner'),
      page('enq-quiet', 'warning-member', 'The warning on the page, as its Member'),
    ],
  },
  {
    name: 'Delete enquiry (sc-31235)',
    states: [
      page('enq-ada', 'delete-button', 'Delete enquiry… at the foot of the page'),
      page('enq-ada', 'delete-confirm', 'Delete this enquiry?'),
      page('enq-erased', 'delete-confirm-erased', 'Delete an erased enquiry: no client named'),
      page('enq-ada', 'deleting', 'Deleting…, both buttons off'),
      page('enq-ada', 'delete-failed', 'Not deleted: Try again'),
      page('enq-ada', 'delete-offline', 'Offline: refused at once, nothing queued'),
      page('enq-femi', 'member-no-delete', 'A Member: no Delete enquiry'),
      page(LONG_ENQUIRY_ID, 'delete-long-names', 'The confirm with a long client’s name'),
      list('deleted', 'Afterwards on Open: Enquiry deleted.'),
      list('deleted-assigned-to-me', 'Afterwards on Lost, Assigned to me still on'),
      {
        to: '/demo/consultations?state=deleted-from-calendar',
        name: 'Afterwards on the Calendar, its consultations gone',
      },
      list('deleted-from-link', 'Opened from a link: Enquiries, Open'),
    ],
  },
  {
    name: 'A Won enquiry (sc-31235)',
    states: [
      page('enq-bisi', 'won-owner', 'An Owner: delete its event first, with the link'),
      page('enq-bisi', 'won-member', 'A Member: neither'),
      page('enq-bisi', 'won-race-409', 'Won while the confirm was open: Close only'),
    ],
  },
];
