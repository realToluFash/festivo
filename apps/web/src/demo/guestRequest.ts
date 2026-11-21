import { CLOCK, ORG, plusDays, when } from './dataControl.ts';
import type { ReaderZone } from './dataSettings.ts';
import type { Guest } from './guests.ts';

export const EMEKA = {
  id: 'emeka',
  name: 'Dr Emeka Nwosu',
  email: 'emeka.nwosu@nhs.net',
  mobile: '+447700900231',
} as const;

export interface Covered {
  id: string;
  name: string;
  event: string;
  eventId: string;
  date: string;
  match: 'email' | 'mobile' | null;
  companionOf: string | null;
  deletedEvent: boolean;
}

const record = (
  id: string,
  name: string,
  event: string,
  eventId: string,
  date: string,
  more: Partial<Covered> = {},
): Covered => ({
  id,
  name,
  event,
  eventId,
  date,
  match: null,
  companionOf: null,
  deletedEvent: false,
  ...more,
});

/** Every record of Dr Emeka Nwosu's in Ire Events: 4 records, on 3 events, one on a deleted event. */
export const COVERED: readonly Covered[] = [
  record('wed', EMEKA.name, 'Adaeze & Tunde’s wedding', 'evt-wed-4', '2026-11-05'),
  record('wed-c1', 'Adanna Nwosu', 'Adaeze & Tunde’s wedding', 'evt-wed-4', '2026-11-05', {
    companionOf: EMEKA.name,
  }),
  record('ireti', EMEKA.name, 'Ireti at 40', 'evt-ireti-2', '2026-11-13', { match: 'email' }),
  record('bola', 'Emeka Nwosu', 'Bola’s 60th', 'evt-bola-60', '2026-08-08', {
    match: 'mobile',
    deletedEvent: true,
  }),
];

/** The set after somebody else's change: a fifth record, on Kemi's baby shower. */
export const CHANGED: readonly Covered[] = [
  ...COVERED,
  record('shower', 'Emeka Nwosu', 'Kemi’s baby shower', 'evt-shower-2', '2026-10-24', {
    match: 'email',
  }),
];

export const THEIR_READY_AT = '2026-10-19T10:20:00+01:00';

export const THEIR_WORDS = {
  heading: 'Their data',
  sameEmail: 'Same email address',
  sameMobile: 'Same mobile number',
  deletedEvent: 'Deleted event',
  notTheirs:
    'A record that is not theirs? Correct its email address or mobile number with Edit, and it leaves this list.',
  export: 'Export their data',
  erase: 'Erase from every event…',
  eraseVerb: 'Erase from every event',
  keep: 'Keep their data',
  preparing: 'Preparing their export…',
  download: 'Download',
  failed: 'Their export did not finish.',
  tryAgain: 'Try again',
  linkUsed: 'This download has been used or has expired.',
  changed: 'The records this covers have changed. Check them, then ask again.',
  goes: 'What goes: their name, email address and mobile number, their companions’ names, the addresses their messages were sent to, the text of the assistant’s record for these events, and every need of theirs and their companions’: allergies, diet and access needs, the words of each Other, and the Private note.',
  notBuilt: 'AC, not yet built',
  stays: 'What stays: their reply, seat, meal picks and place in the counts.',
  undone: 'This can’t be undone.',
  erasing: 'Erasing…',
  erasedName: 'Erased guest',
} as const;

export function companionOf(name: string): string {
  return `Companion of ${name}`;
}

export function coversLine(records: readonly Covered[]): string {
  const events = new Set(records.map((one) => one.eventId)).size;

  return `A request covers every record of theirs in ${ORG}: ${records.length} records, on ${events} events.`;
}

export function readyLine(locale: string, zone: ReaderZone): string {
  return `Their export is ready. It downloads once, until ${when(plusDays(THEIR_READY_AT, 1), locale, zone)}, and only for you.`;
}

export function erasedLine(locale: string, zone: ReaderZone): string {
  return `Erased on ${when(CLOCK.now, locale, zone)}. Their reply, seat and place in the counts stay.`;
}

export function eraseTitle(name: string): string {
  return `Erase ${name} from every event?`;
}

/** A covered record's line: its event and day, then what ties it to them. */
export function coveredLine(one: Covered, locale: string): string {
  if (one.companionOf != null) return companionOf(one.companionOf);

  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${one.date}T00:00Z`));
  const match =
    one.match === 'email'
      ? THEIR_WORDS.sameEmail
      : one.match === 'mobile'
        ? THEIR_WORDS.sameMobile
        : null;

  return [one.event, day, match].filter((part) => part != null).join(' · ');
}

export type Phase =
  'actions' | 'preparing' | 'ready' | 'failed' | 'linkUsed' | 'erasing' | 'erased';

export interface TheirStart {
  phase: Phase;
  changed: boolean;
  asking: boolean;
}

export const THEIR_STATES = [
  'covered',
  'member',
  'preparing',
  'ready',
  'other_admin',
  'failed',
  'link_used',
  'set_changed_export',
  'erase_question',
  'set_changed_erase',
  'erasing',
  'erased',
] as const;

export type TheirState = (typeof THEIR_STATES)[number];

export function theirStateOf(raw: string | null): TheirState {
  return THEIR_STATES.find((one) => one === raw) ?? 'covered';
}

export function theirStart(state: TheirState): TheirStart {
  const start: TheirStart = { phase: 'actions', changed: false, asking: false };

  switch (state) {
    case 'preparing':
      return { ...start, phase: 'preparing' };
    case 'ready':
      return { ...start, phase: 'ready' };
    case 'failed':
      return { ...start, phase: 'failed' };
    case 'link_used':
      return { ...start, phase: 'linkUsed' };
    case 'set_changed_export':
      return { ...start, changed: true };
    case 'erase_question':
      return { ...start, asking: true };
    case 'set_changed_erase':
      return { ...start, changed: true, asking: true };
    case 'erasing':
      return { ...start, phase: 'erasing' };
    case 'erased':
      return { ...start, phase: 'erased' };
    default:
      return start;
  }
}

/** Who a state is drawn for on the guest's details: `member` is Ana, `other_admin` Julien. */
export function theirViewerKey(state: TheirState, as: string | null): string | null {
  if (state === 'member') return 'ana';
  if (state === 'other_admin') return 'julien';

  return as;
}

export const REQUEST_WORDS = {
  title: 'A guest’s request',
  line: 'A guest who asks what you hold on them, or to be erased, usually writes from an email address or a mobile number. Start from it, or from their details in Guests.',
  field: 'Their email address or mobile number',
  find: 'Find their records',
  blank: 'Enter their email address or mobile number.',
  invalid: 'Enter an email address, or a mobile number with its country code.',
  none: `No guest in ${ORG} has that email address or mobile number.`,
  loading: 'Loading A guest’s request…',
  failed: 'We could not load A guest’s request.',
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MOBILE = /^\+\d[\d\s]{6,}\d$/u;

/** Before anything is sent: something typed, and an email address or a mobile number with its country code. */
export function findFault(typed: string): string | null {
  const text = typed.trim();

  if (text === '') return REQUEST_WORDS.blank;

  return EMAIL.test(text) || MOBILE.test(text) ? null : REQUEST_WORDS.invalid;
}

/** The server's answer: Dr Emeka Nwosu by his email address or his mobile number, nobody else. */
export function finds(typed: string): boolean {
  const text = typed.trim().toLowerCase();

  return text === EMEKA.email || text.replace(/\s/gu, '') === EMEKA.mobile;
}

export const REQUEST_STATES = [
  'find',
  'find_blank',
  'find_invalid',
  'find_none',
  'found',
  'loading',
  'failed',
] as const;

export interface RequestStart {
  load: 'loaded' | 'loading' | 'failed';
  typed: string;
  answer: 'blank' | 'invalid' | 'none' | 'found' | null;
}

export function requestStart(state: string): RequestStart {
  const start: RequestStart = { load: 'loaded', typed: '', answer: null };

  switch (state) {
    case 'find_blank':
      return { ...start, answer: 'blank' };
    case 'find_invalid':
      return { ...start, typed: 'emeka nwosu', answer: 'invalid' };
    case 'find_none':
      return { ...start, typed: 'nobody@example.com', answer: 'none' };
    case 'found':
      return { ...start, typed: EMEKA.email, answer: 'found' };
    case 'loading':
    case 'failed':
      return { ...start, load: state };
    default:
      return start;
  }
}

export function answerOf(typed: string): RequestStart['answer'] {
  const fault = findFault(typed);

  if (fault === REQUEST_WORDS.blank) return 'blank';
  if (fault != null) return 'invalid';

  return finds(typed) ? 'found' : 'none';
}

export function answerWords(answer: RequestStart['answer']): string | null {
  switch (answer) {
    case 'blank':
      return REQUEST_WORDS.blank;
    case 'invalid':
      return REQUEST_WORDS.invalid;
    case 'none':
      return REQUEST_WORDS.none;
    default:
      return null;
  }
}

/** What erasing leaves of a guest: their reply, seat and place in the counts, and nothing that names or reaches them. */
export function erasedIn(list: readonly Guest[], id: string): Guest[] {
  return list.map((one) =>
    one.id !== id
      ? one
      : {
          ...one,
          name: THEIR_WORDS.erasedName,
          email: null,
          phone: null,
          greetAs: null,
          companions: one.companions.map((companion) => ({ ...companion, name: null })),
        },
  );
}
