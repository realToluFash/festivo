import { type EventType, searching } from '@soirely/domain';

import { folded } from '../events/EventsModel.ts';

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
  /** Never searched (sc-42749, Decided 12 Nov). */
  notes: string;
}

/** The sample's clock: Wednesday 18 Nov 2026, 10:00 in London. */
export const NOW = '2026-11-18T10:00:00Z';

export const ORG_DIAL = '44';

export const LONG_CLIENT = 'Anne-Sophie de La Rochefoucauld-Montmorency';

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
    notes: 'Garden ceremony, about 120 guests, budget around £30,000.',
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
    notes: 'Fiftieth, a surprise for his wife.',
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
    notes: 'Company dinner after the Madrid conference.',
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
    notes: 'Wants the château in Chantilly.',
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
    notes: 'Called about the hall, nothing more yet.',
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
    notes: 'Twenty-fifth, in Lagos.',
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
    notes: 'Budget. Might come back for the wedding.',
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
    notes: 'Chose someone else.',
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
  enquiries: readonly Enquiry[];
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
    enquiries: ENQUIRIES,
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

export function assignedWords(enquiry: Enquiry, notAssigned: string): string {
  const person = Object.values(PEOPLE).find((one) => one.id === enquiry.assignedTo);

  return person?.name ?? notAssigned;
}
