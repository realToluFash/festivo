import { type EventType, searching } from '@soirely/domain';

import { folded } from './events.ts';
import type { DemoLink } from './settings.ts';

export const ENQUIRY_TABS = ['open', 'won', 'lost'] as const;
export type EnquiryTab = (typeof ENQUIRY_TABS)[number];

export type Role = 'owner' | 'admin' | 'member';

export interface Person {
  id: string;
  name: string;
  role: Role;
}

export const PEOPLE = {
  folake: { id: 'folake', name: 'Folake Adeyemi', role: 'owner' },
  kemi: { id: 'kemi', name: 'Kemi Ojo', role: 'admin' },
  tunde: { id: 'tunde', name: 'Tunde Bakare', role: 'member' },
} as const satisfies Record<string, Person>;

export const BEST_WAYS = ['phone', 'whatsapp', 'text', 'email'] as const;
export type BestWay = (typeof BEST_WAYS)[number];

export const FOUND_VIA = [
  'phone',
  'whatsapp',
  'instagram',
  'referral',
  'website',
  'fair',
  'other',
] as const;
export type FoundVia = (typeof FOUND_VIA)[number];

export const LOST_REASONS = [
  'elsewhere',
  'budget',
  'date',
  'silent',
  'notGoingAhead',
  'other',
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export interface Note {
  id: string;
  author: string;
  at: string;
  text: string;
  edited: boolean;
}

export interface Enquiry {
  id: string;
  client: string;
  tab: EnquiryTab;
  type: EventType | null;
  date: string | null;
  assignedTo: string | null;
  changedAt: string;
  phone: string | null;
  email: string | null;
  bestWay: BestWay | null;
  guests: number | null;
  where: string | null;
  budget: { amount: string; currency: string } | null;
  foundVia: FoundVia | null;
  lost: { reason: LostReason; line: string | null } | null;
  /** Newest first. Never searched (sc-42749, Decided 12 Nov). */
  notesList: Note[];
  /** Set once the 12-month clock erased the client's details (sc-31235): only what is kept stays. */
  erased?: Erased;
}

export interface Erased {
  on: string;
  createdAt: string;
  closedAt: string;
  /** The event's month, YYYY-MM: the day is erased with the rest. */
  month: string | null;
  reason: LostReason | null;
}

/** The sample's clock: Wednesday 18 Nov 2026, 10:00 in London. */
export const NOW = '2026-11-18T10:00:00Z';

export const ORG_DIAL = '44';

export const ORG_COUNTRY = 'GB';

export const ORG_CURRENCY = 'GBP';

/** The time zone on the viewer's own account, which decides whether a date has passed: never the organisation's, and UTC while their account has none. */
export const VIEWER_ZONE = 'Europe/London';

export const LONG_CLIENT = 'Anne-Sophie de La Rochefoucauld-Montmorency';

function note(id: string, author: string, at: string, text: string): Note {
  return { id, author, at, text, edited: false };
}

export const ENQUIRIES: readonly Enquiry[] = [
  {
    id: 'enq-ada',
    client: 'Ada Okafor',
    tab: 'open',
    type: 'wedding',
    date: '2027-06-12',
    assignedTo: 'folake',
    changedAt: '2026-11-18T08:15:00Z',
    phone: '+447400123456',
    email: 'ada@example.com',
    bestWay: 'whatsapp',
    guests: 120,
    where: 'Hampton Manor, Solihull',
    budget: { amount: '30000', currency: 'GBP' },
    foundVia: 'instagram',
    lost: null,
    notesList: [
      {
        id: 'n2',
        author: 'kemi',
        at: '2026-11-18T09:40:00Z',
        text: 'Called back: she would like a Saturday in June. Sending the garden photos.',
        edited: true,
      },
      {
        id: 'n1',
        author: 'folake',
        at: '2026-11-18T08:15:00Z',
        text: 'Garden ceremony, about 120 guests, budget around £30,000.',
        edited: false,
      },
    ],
  },
  {
    id: 'enq-femi',
    client: 'Femi Okanlawon',
    tab: 'open',
    type: 'birthday',
    date: null,
    assignedTo: 'tunde',
    changedAt: '2026-11-17T16:40:00Z',
    phone: '+447700900123',
    email: null,
    bestWay: 'phone',
    guests: 40,
    where: null,
    budget: null,
    foundVia: 'referral',
    lost: null,
    notesList: [note('n1', 'tunde', '2026-11-17T16:40:00Z', 'Fiftieth, a surprise for his wife.')],
  },
  {
    id: 'enq-lucia',
    client: 'Lucía Fernández',
    tab: 'open',
    type: 'corporate',
    date: '2027-03-05',
    assignedTo: 'kemi',
    changedAt: '2026-11-16T11:05:00Z',
    phone: null,
    email: 'lucia.fernandez@example.es',
    bestWay: 'email',
    guests: 60,
    where: 'Madrid',
    budget: { amount: '12000', currency: 'EUR' },
    foundVia: 'website',
    lost: null,
    notesList: [
      note('n1', 'kemi', '2026-11-16T11:05:00Z', 'Company dinner after the Madrid conference.'),
    ],
  },
  {
    id: 'enq-long',
    client: LONG_CLIENT,
    tab: 'open',
    type: 'engagement',
    date: '2027-05-22',
    assignedTo: 'kemi',
    changedAt: '2026-11-15T09:30:00Z',
    phone: '+33612345678',
    email: null,
    bestWay: 'phone',
    guests: 80,
    where: 'Château de Chantilly',
    budget: { amount: '45000', currency: 'EUR' },
    foundVia: 'referral',
    lost: null,
    notesList: [note('n1', 'kemi', '2026-11-15T09:30:00Z', 'Wants the château in Chantilly.')],
  },
  {
    id: 'enq-chinedu',
    client: 'Chinedu Eze',
    tab: 'open',
    type: null,
    date: null,
    assignedTo: null,
    changedAt: '2026-11-14T17:20:00Z',
    phone: null,
    email: 'chinedu.eze@example.com',
    bestWay: null,
    guests: null,
    where: null,
    budget: null,
    foundVia: null,
    lost: null,
    notesList: [],
  },
  {
    id: 'enq-bisi',
    client: 'Bisi Adebayo',
    tab: 'open',
    type: 'anniversary',
    date: '2027-02-14',
    assignedTo: 'tunde',
    changedAt: '2026-11-10T13:00:00Z',
    phone: '+2348035550199',
    email: null,
    bestWay: 'text',
    guests: 30,
    where: 'Lagos',
    budget: { amount: '2500000', currency: 'NGN' },
    foundVia: 'fair',
    lost: null,
    notesList: [note('n1', 'tunde', '2026-11-10T13:00:00Z', 'Twenty-fifth, in Lagos.')],
  },
  {
    id: 'enq-ada-lost',
    client: 'Ada Okafor',
    tab: 'lost',
    type: 'engagement',
    date: '2026-12-19',
    assignedTo: 'tunde',
    changedAt: '2026-10-02T15:45:00Z',
    phone: null,
    email: 'ada.okafor@example.com',
    bestWay: null,
    guests: null,
    where: null,
    budget: null,
    foundVia: null,
    lost: { reason: 'budget', line: 'Might come back for the wedding.' },
    notesList: [
      note('n1', 'tunde', '2026-10-02T15:45:00Z', 'Engagement party for about 50, in December.'),
    ],
  },
  {
    id: 'enq-ngozi',
    client: 'Ngozi Umeh',
    tab: 'lost',
    type: 'wedding',
    date: '2026-09-20',
    assignedTo: 'kemi',
    changedAt: '2026-09-01T10:10:00Z',
    phone: '+2348035550142',
    email: null,
    bestWay: null,
    guests: null,
    where: null,
    budget: null,
    foundVia: null,
    lost: { reason: 'elsewhere', line: null },
    notesList: [
      note('n1', 'kemi', '2026-09-01T10:10:00Z', 'Wedding in September, garden or hall.'),
    ],
  },
];

export function enquiryOf(id: string | undefined): Enquiry | null {
  return ENQUIRIES.find((enquiry) => enquiry.id === id) ?? null;
}

/** Stands in for the server's parser: a national number is read with the organisation's country. */
export function phoneOf(typed: string, dial: string = ORG_DIAL): string | null {
  const trimmed = typed.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  const international = trimmed.startsWith('+')
    ? digits
    : digits.startsWith('00')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? `${dial}${digits.slice(1)}`
        : digits.startsWith(dial) && digits.length >= 11
          ? digits
          : `${dial}${digits}`;

  return international.length >= 8 && international.length <= 15 ? `+${international}` : null;
}

function emailOf(typed: string): string | null {
  const trimmed = typed.trim();

  return /^[^\s@]+@[^\s@]+$/.test(trimmed) ? folded(trimmed) : null;
}

/** Any part of the client's name with case and accents ignored, a whole phone number in any format, or a whole email address. Notes never. */
export function matches(enquiry: Enquiry, typed: string): boolean {
  if (!searching(typed)) return true;
  const phone = phoneOf(typed);
  const email = emailOf(typed);

  return (
    folded(enquiry.client).includes(folded(typed.trim())) ||
    (phone != null && enquiry.phone === phone) ||
    (email != null && enquiry.email != null && folded(enquiry.email) === email)
  );
}

export interface Viewer {
  person: Person;
  mine: boolean;
}

export function visibleTo(enquiries: readonly Enquiry[], viewer: Viewer): Enquiry[] {
  const own = viewer.person.role === 'member' || viewer.mine;

  return enquiries.filter((enquiry) => !own || enquiry.assignedTo === viewer.person.id);
}

export function byTab(enquiries: readonly Enquiry[]): Record<EnquiryTab, Enquiry[]> {
  const newest = [...enquiries].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return {
    open: newest.filter((enquiry) => enquiry.tab === 'open'),
    won: newest.filter((enquiry) => enquiry.tab === 'won'),
    lost: newest.filter((enquiry) => enquiry.tab === 'lost'),
  };
}

export interface Results {
  count: number;
  groups: { tab: EnquiryTab; enquiries: Enquiry[] }[];
}

export function resultsOf(enquiries: readonly Enquiry[], viewer: Viewer, typed: string): Results {
  const tabs = byTab(visibleTo(enquiries, viewer).filter((enquiry) => matches(enquiry, typed)));
  const groups = ENQUIRY_TABS.map((tab) => ({ tab, enquiries: tabs[tab] })).filter(
    (group) => group.enquiries.length > 0,
  );

  return { count: groups.reduce((sum, group) => sum + group.enquiries.length, 0), groups };
}

export const ENQUIRY_STATES = [
  'idle',
  'won',
  'lost',
  'emptyOpen',
  'listFailed',
  'short',
  'searching',
  'results',
  'onePhone',
  'noMatch',
  'assignedToMe',
  'member',
  'memberNoMatch',
  'offline',
  'failed',
  'longNames',
  'lostEmpty',
  'loading',
  'refreshing',
  'mine',
  'memberList',
  'lost-with-erased',
  'erased-row-no-type',
  'erased-row-no-date',
  'erased-row-bare',
  'warning-row',
  'open-consultation-ahead',
  'deleted',
  'deleted-assigned-to-me',
  'deleted-from-link',
] as const;
export type EnquiryState = (typeof ENQUIRY_STATES)[number];

export function enquiryStateOf(value: string | undefined | null): EnquiryState {
  return ENQUIRY_STATES.find((state) => state === value) ?? 'idle';
}

export interface Start {
  tab: EnquiryTab;
  typed: string;
  pausing: boolean;
  viewer: Viewer;
  offline: boolean;
  listFailed: boolean;
  searchFailed: boolean;
  loading: boolean;
  refreshing: boolean;
  enquiries: readonly Enquiry[];
  told: string | null;
}

export function startOf(state: EnquiryState): Start {
  const start: Start = {
    tab: 'open',
    typed: '',
    pausing: false,
    viewer: { person: PEOPLE.folake, mine: false },
    offline: false,
    listFailed: false,
    searchFailed: false,
    loading: false,
    refreshing: false,
    enquiries: ENQUIRIES,
    told: null,
  };

  switch (state) {
    case 'won':
      return { ...start, tab: 'won' };
    case 'lost':
      return { ...start, tab: 'lost' };
    case 'emptyOpen':
      return { ...start, enquiries: ENQUIRIES.filter((enquiry) => enquiry.tab !== 'open') };
    case 'listFailed':
      return { ...start, listFailed: true };
    case 'short':
      return { ...start, typed: 'o' };
    case 'searching':
      return { ...start, typed: 'oka', pausing: true };
    case 'results':
      return { ...start, typed: 'oka' };
    case 'onePhone':
      return { ...start, typed: '07400 123456' };
    case 'noMatch':
      return { ...start, typed: '0803 555 0142' };
    case 'assignedToMe':
      return { ...start, typed: 'oka', viewer: { person: PEOPLE.folake, mine: true } };
    case 'member':
      return { ...start, typed: 'oka', viewer: { person: PEOPLE.tunde, mine: false } };
    case 'memberNoMatch':
      return { ...start, typed: '07400 123456', viewer: { person: PEOPLE.tunde, mine: false } };
    case 'offline':
      return { ...start, offline: true };
    case 'failed':
      return { ...start, typed: 'oka', searchFailed: true };
    case 'longNames':
      return { ...start, typed: 'rochefoucauld' };
    case 'lostEmpty':
      return {
        ...start,
        tab: 'lost',
        enquiries: ENQUIRIES.filter((enquiry) => enquiry.tab !== 'lost'),
      };
    case 'loading':
      return { ...start, loading: true };
    case 'refreshing':
      return { ...start, refreshing: true };
    case 'mine':
      return { ...start, viewer: { person: PEOPLE.folake, mine: true } };
    case 'memberList':
      return { ...start, viewer: { person: PEOPLE.tunde, mine: false } };
    default:
      return start;
  }
}

const DAY = 86_400_000;

export function changedWords(changedAt: string, now: string, locale: string): string {
  const ago = Date.parse(now) - Date.parse(changedAt);
  const words = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const said =
    ago < 3_600_000
      ? words.format(-Math.max(1, Math.round(ago / 60_000)), 'minute')
      : ago < DAY
        ? words.format(-Math.round(ago / 3_600_000), 'hour')
        : ago < 7 * DAY
          ? words.format(-Math.max(1, Math.round(ago / DAY)), 'day')
          : ago < 30 * DAY
            ? words.format(-Math.round(ago / (7 * DAY)), 'week')
            : words.format(-Math.round(ago / (30 * DAY)), 'month');

  return said.charAt(0).toLocaleUpperCase(locale) + said.slice(1);
}

export function whatLine(
  enquiry: Enquiry,
  typeWord: (type: EventType) => string,
  noDate: string,
  now: string,
  locale: string,
): string {
  const type = enquiry.type == null ? null : typeWord(enquiry.type);
  if (enquiry.date == null) return type == null ? noDate : `${type} · ${noDate}`;
  const day = new Date(`${enquiry.date}T12:00:00Z`);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(day.getUTCFullYear() === new Date(now).getUTCFullYear() ? {} : { year: 'numeric' }),
  }).format(day);

  return type == null ? date : `${type} · ${date}`;
}

export function personOf(id: string | null): Person | null {
  return Object.values(PEOPLE).find((one) => one.id === id) ?? null;
}

export function assignedWords(enquiry: Enquiry, notAssigned: string): string {
  return personOf(enquiry.assignedTo)?.name ?? notAssigned;
}

/** A Member sees only the enquiries assigned to them, by id too. */
export function canSee(enquiry: Enquiry, person: Person): boolean {
  return person.role !== 'member' || enquiry.assignedTo === person.id;
}

export const ENQUIRY_WORDS = {
  enquiries: 'Enquiries',
  newEnquiry: 'New enquiry',
  search: 'Search enquiries',
  assignedToMe: 'Assigned to me',
  notAssigned: 'Not assigned',
  noDate: 'No date yet',
  tabs: { open: 'Open', won: 'Won', lost: 'Lost' } satisfies Record<EnquiryTab, string>,
  empty: {
    open: {
      title: 'No open enquiries',
      line: 'A call you record stays on Open until it is won or closed as lost.',
    },
    won: {
      title: 'Nothing won yet',
      line: 'An enquiry moves here once it becomes an event.',
    },
    lost: {
      title: 'Nothing lost',
      line: 'An enquiry closed as lost stays here, with its reason.',
    },
  } satisfies Record<EnquiryTab, { title: string; line: string }>,
  count: (count: number) => (count === 1 ? '1 enquiry' : `${count} enquiries`),
  noMatch: 'No enquiries match',
  searched: (q: string) => `You searched for “${q}”.`,
  listFailed: 'The enquiries did not load. Try again in a moment.',
  ownDesign: (what: string) => `${what} works on the enquiry’s own page, not in this state.`,
  searchFailed: 'The search did not load. Try again in a moment.',
} as const;

function at(state: EnquiryState, name: string): DemoLink {
  return { to: state === 'idle' ? '/demo/enquiries' : `/demo/enquiries?state=${state}`, name };
}

const form = (state: string, name: string): DemoLink => ({
  to: `/demo/enquiries/new?state=${state}`,
  name,
});

const page = (id: string, state: string, name: string): DemoLink => ({
  to: `/demo/enquiries/${id}?state=${state}`,
  name,
});

export const ENQUIRIES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The list (sc-31226)',
    states: [
      at('idle', 'Open, Assigned to me off'),
      at('won', 'Won, nothing won yet'),
      at('lost', 'Lost'),
      at('emptyOpen', 'Nothing open, with New enquiry'),
      at('listFailed', 'The enquiries did not load'),
      at('lostEmpty', 'Lost, nothing lost'),
      at('loading', 'Loading, Events’ skeleton rows'),
      at('refreshing', 'Refreshing, the rows stay'),
      at('mine', 'Assigned to me on, no search'),
      at('memberList', 'A Member’s list: no Assigned to me'),
    ],
  },
  {
    name: 'New enquiry (sc-31226)',
    states: [
      form('blank', 'Blank, as an Owner'),
      form('nameAndPhone', 'Ama Mensah and a phone: Save works'),
      form('fixedLine', 'A fixed line, 020 7946 0018: accepted'),
      form('invalidContact', 'Neither a phone nor an email'),
      form('invalidPhone', 'A phone that is not a number'),
      form('phoneTooShort', 'A phone too short, 0770 090'),
      form('phoneTooLong', 'A phone too long, 07700 900456 789'),
      form('invalidEmail', 'An email without its domain, ama@'),
      form('invalidName', 'A name of 101 characters'),
      form('invalidNote', 'What they have in mind, 5,001 characters'),
      form('invalidDate', 'A date that has passed, 10 Nov 2026'),
      form('invalidGuests', 'Guests: 0'),
      form('invalidWhere', 'Where, 201 characters'),
      form('invalidBudget', 'Budget 120.555 GBP: GBP takes 2 decimal places'),
      form('duplicateAdmin', 'The same client: an Owner sees who has it'),
      form('duplicateMember', 'The same client: a Member sees no name'),
      form('noConnection', 'No connection: nothing saved, all kept'),
      form('member', 'A Member: no Assigned to'),
      form('saving', 'Saving, the fields read only'),
    ],
  },
  {
    name: 'An enquiry’s page (sc-31226)',
    states: [
      page('enq-ada', 'open', 'Open, as an Owner'),
      page('enq-femi', 'openMember', 'Open, as its Member'),
      page('enq-ada', 'withNotes', 'Two notes, one Edited'),
      page('enq-ada', 'editNote', 'Editing your own note'),
      page('enq-ada', 'whatsapp', 'Best way WhatsApp: the WhatsApp button'),
      page('enq-chinedu', 'notAssigned', 'Not assigned, nothing more given'),
      page('enq-ada', 'closeAsLost', 'Close as lost, docked'),
      page('enq-ada', 'closeAsLostTooLong', 'Close as lost, a line of 201 characters'),
      page('enq-ada-lost', 'lost', 'Lost · Budget, with Reopen'),
      page('enq-ngozi', 'lostNoLine', 'Lost · Chose someone else, no line'),
      page('enq-bisi', 'datePassed', 'A date that has gone by, shown plainly'),
      page('enq-ada', 'notFound', 'A Member opening another’s: not here'),
      page('enq-ada', 'loadFailed', 'The enquiry did not load'),
    ],
  },
  {
    name: 'Enquiries in the navigation (sc-31226)',
    states: [
      { to: '/demo/today', name: 'Enterprise: Enquiries right after Events, on Today' },
      { to: '/demo/calendar', name: 'Enterprise: on the Calendar' },
      { to: '/demo/today?plan=free', name: 'Free: no Enquiries, on Today' },
      { to: '/demo/events?plan=free', name: 'Free: no Enquiries, on Events' },
    ],
  },
  {
    name: 'Search enquiries (sc-42749)',
    states: [
      at('short', 'One character, ignored: the tabs stay'),
      at('searching', 'The pause after typing, focus kept'),
      at('results', '“oka”: Open 2 and Lost 1, 3 enquiries'),
      at('onePhone', '“07400 123456”: 1 enquiry'),
      at('noMatch', '“0803 555 0142”: No enquiries match'),
      at('assignedToMe', 'An Owner with Assigned to me on'),
      at('member', 'A Member: only their own'),
      at('memberNoMatch', 'A Member searching another’s client'),
      at('offline', 'Offline: Search needs a connection'),
      at('failed', 'The search did not load'),
      at('longNames', 'A long client’s name'),
    ],
  },
];
