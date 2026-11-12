import { BAR, DOOR_EVENT } from './doorCode.ts';
import type { Reply } from './guests.ts';
import { HUGO } from './redeem.ts';
import type { DemoLink } from './settings.ts';

export type DoorReply = Extract<
  Reply,
  'coming' | 'notSure' | 'notComing' | 'held' | 'noReply' | 'walkIn'
>;

export interface DoorPerson {
  id: string;
  name: string | null;
  reply: DoorReply;
  host: string | null;
  arrivedAt: string | null;
  by: string | null;
}

export type Holder = 'shift' | 'code';
export type Phase = 'open' | 'before' | 'ended';
export type Gone = 'link_gone' | 'outside_window' | 'outside_window_ended' | 'level_view';

export const CHECK_IN_STATES = [
  'list',
  'searching',
  'companions',
  'arrived',
  'undone',
  'no_match',
  'walk_in',
  'walk_in_blank',
  'invalid_name',
  'walk_in_duplicate',
  'not_recorded',
  'live',
  'before_open',
  'ended',
  'loading',
  'empty',
  'empty_closed',
  'offline',
  'offline_back',
  'link_gone',
  'outside_window',
  'outside_window_ended',
  'level_view',
  'not_signed_in',
] as const;

export type CheckInState = (typeof CHECK_IN_STATES)[number];

export function checkInStateOf(value: string | null): CheckInState {
  return CHECK_IN_STATES.find((one) => one === value) ?? 'list';
}

export function holderOf(value: string | null): Holder {
  return value === 'code' ? 'code' : 'shift';
}

export const NAME_MOST = 200;
export const NOW = '19:42';
/** Today at 19:45, so the shared band reads "Offline · as of 19:45". */
export const OFFLINE_SINCE = (() => {
  const at = new Date();
  at.setHours(19, 45, 0, 0);

  return at;
})();
export const OPENS_AT = '16:00';
export const SHIFT_NAME = 'Bisi Adeyemi';
export const OTHER = 'Samuel Okafor';
export const JOB = 'Door';
export const LONG_NAME =
  'Kunle Adeyemi with his driver and the two security men from the Lagos office, who were not on the list, but the host said on the phone at six to let all of them in at the side gate by the car park on Ozumba Mbadiwe Avenue';

/** The job beside the event's name: the shift's, or the label of the code a join-code holder came in on, as "You're in for…" shows it. */
export function jobOf(holder: Holder): string {
  return holder === 'code' ? (BAR.label ?? JOB) : JOB;
}

export function meOf(holder: Holder): string {
  return holder === 'code' ? HUGO.name : SHIFT_NAME;
}

/** sc-1454's words, as the app's check-in has them, and the browser's own from sc-28230's Design section. */
export const CW = {
  title: 'Check-in',
  count: (arrived: number, expected: number) => `${arrived} of ${expected} arrived`,
  search: 'Search by name',
  clear: 'Clear search',
  reply: {
    coming: 'Coming',
    notSure: 'Not sure yet',
    notComing: 'Not coming',
    held: 'Held',
    noReply: 'No reply',
    walkIn: 'Walk-in',
  } satisfies Record<DoorReply, string>,
  guestOf: (host: string) => `Guest of ${host}`,
  arrived: 'Arrived',
  arrivedAt: (time: string, who: string) => `Arrived at ${time} · ${who}`,
  arriveName: (name: string) => `Arrived: ${name}`,
  undo: 'Undo arrival',
  undoName: (name: string) => `Undo arrival: ${name}`,
  undone: 'Arrival undone',
  announced: (name: string, time: string) => `${name} arrived at ${time}.`,
  notRecorded: 'Not recorded. Try again.',
  matches: (count: number) => (count === 1 ? '1 match' : `${count} match`),
  noMatch: (typed: string) => `Nobody on the list matches “${typed}”.`,
  addWalkIn: 'Add walk-in',
  fullName: 'Full name',
  addMark: 'Add and mark arrived',
  walkHint: 'They are added to the list as a walk-in and marked arrived now.',
  blank: 'Enter their full name.',
  tooLong: `Shorten the name to ${NAME_MOST} characters or fewer.`,
  same: (name: string) => `${name} is already on the list`,
  markThem: 'Mark them arrived',
  addNew: 'Add as someone new',
  cancel: 'Cancel',
  added: (name: string, time: string) => `${name} added as a walk-in. Arrived at ${time}.`,
  opensAt: (time: string) => `Check-in opens at ${time}`,
  opensBody: (time: string) =>
    `Search works now. Arrivals and walk-ins can be recorded from ${time}.`,
  ended: 'This event has ended.',
  endedBody: 'The list stays readable. Arrivals can no longer be marked or undone.',
  emptyTitle: 'Nobody is on the list yet',
  emptyLine: 'Anyone who arrives can be added as a walk-in.',
  loading: 'Loading the list',
  backShift: 'Your shift',
  gone: {
    title: 'This link does not work.',
    body: 'It may have been replaced, or it is no longer in use.',
    next: 'Open the newest link you were sent, or ask the person who sent it.',
    foot: 'Nothing stays on this device.',
  },
  notYet: {
    title: 'This link works from 05:00 on Saturday, Oct 24.',
    body: 'It opens 12 hours before your first shift.',
    next: 'Open this link again then. It stays the same.',
    foot: 'This link is yours alone. Nothing stays on this device.',
  },
  linkEnded: {
    title: 'This link has ended.',
    body: 'It stopped working 2 hours after your last shift.',
    next: 'If you are working another event, you will get a new link for it.',
    foot: 'Nothing stays on this device.',
  },
  notSignedIn: {
    title: 'Sign in from your link or code',
    body: 'To check guests in, open the link we sent you, or enter your door code again.',
    cta: 'Enter a door code',
  },
  shift: {
    only: 'Tonight only · ends 02:00',
    hello: 'Hi Bisi, you’re on tonight',
    yourShift: 'Your shift',
    times: '16:00 to 23:00',
    clocked: 'Clocked in at 17:52',
    signedInAs: (name: string) => `Signed in as ${name}`,
    signedOutAt: 'You’ll be signed out at 02:00',
    signOut: 'Sign out',
    signOutLater: 'Signing out has its own design (sc-4235).',
  },
  connectionBack: 'Demo: the connection is back',
} as const;

const ARRIVED_BEFORE: Readonly<Record<string, [string, string]>> = {
  bisi: ['19:31', OTHER],
  kemi: ['19:31', OTHER],
  tunde: ['19:36', '@me'],
};

const person = (
  id: string,
  name: string | null,
  reply: DoorReply,
  host: string | null = null,
): DoorPerson => ({ id, name, reply, host, arrivedAt: null, by: null });

/** sc-1454's fixture (CheckIn.dc.html): full names as the host typed them; two unnamed companions. */
export const PEOPLE: readonly DoorPerson[] = [
  person('adaeze', 'Chief Mrs Adaeze Okonkwo-Williams', 'notSure'),
  person('a1', null, 'held', 'adaeze'),
  person('a2', null, 'held', 'adaeze'),
  person('bisi', 'Bisi Adewale', 'coming'),
  person('kemi', 'Kemi Adewale', 'coming', 'bisi'),
  person('emeka', 'Dr Emeka Nwosu', 'noReply'),
  person('folasade', 'Folasade Bello', 'coming'),
  person('ifeoma', 'Ifeoma Chukwu', 'notComing'),
  person('marie', 'Marie-Claire Dubois', 'coming'),
  person('ngozi', 'Ngozi Eze', 'notSure'),
  person('tunde', 'Tunde Bakare', 'coming'),
  person('yetunde', 'Yetúndé Adébáyọ̀', 'noReply'),
  person('zainab', 'Zainab Sani-Bello', 'coming'),
];

/** An unnamed companion is named by their host's full name, numbered when the host brings more than one. */
export function shownName(one: DoorPerson, people: readonly DoorPerson[]): string {
  if (one.name != null) return one.name;

  const host = people.find((other) => other.id === one.host);
  const unnamed = people.filter((other) => other.host === one.host && other.name == null);
  const words = CW.guestOf(host?.name ?? '');

  return unnamed.length > 1 ? `${words} · ${unnamed.indexOf(one) + 1}` : words;
}

function folded(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

function wordsOf(text: string): string[] {
  return folded(text)
    .split(/[\s\-‐-―]+/u)
    .filter(Boolean);
}

/** Every typed word starts a word of the name, accents and case ignored: "okon ada" finds Okonkwo-Williams, "kwo" does not. */
export function nameMatches(name: string, typed: string): boolean {
  const asked = wordsOf(typed);
  const has = wordsOf(name);

  return asked.length > 0 && asked.every((word) => has.some((one) => one.startsWith(word)));
}

export function sameName(a: string, b: string): boolean {
  return wordsOf(a).join(' ') === wordsOf(b).join(' ');
}

export function shownPeople(people: readonly DoorPerson[], typed: string): DoorPerson[] {
  if (typed.trim() === '') return [...people];

  const partyOf = (one: DoorPerson) => one.host ?? one.id;
  const hit = new Set(
    people.filter((one) => nameMatches(shownName(one, people), typed)).map(partyOf),
  );

  return people.filter((one) => hit.has(partyOf(one)));
}

export function nameProblem(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed === '') return CW.blank;

  return [...trimmed].length > NAME_MOST ? CW.tooLong : null;
}

export function countOf(people: readonly DoorPerson[]): { arrived: number; expected: number } {
  const arrived = people.filter((one) => one.arrivedAt != null).length;
  const expected = people.filter((one) => one.reply === 'coming' || one.arrivedAt != null).length;

  return { arrived, expected };
}

export function arrive(
  people: readonly DoorPerson[],
  id: string,
  at: string,
  by: string,
): DoorPerson[] {
  return people.map((one) => (one.id === id ? { ...one, arrivedAt: at, by } : one));
}

/** Undoing a walk-in's arrival takes them off the list, as sc-1454 says. */
export function undo(people: readonly DoorPerson[], id: string): DoorPerson[] {
  return people
    .filter((one) => !(one.id === id && one.reply === 'walkIn'))
    .map((one) => (one.id === id ? { ...one, arrivedAt: null, by: null } : one));
}

export function addWalkIn(
  people: readonly DoorPerson[],
  name: string,
  at: string,
  by: string,
): DoorPerson[] {
  const id = `walkin-${people.filter((one) => one.reply === 'walkIn').length + 1}`;
  const walkIn: DoorPerson = { id, name, reply: 'walkIn', host: null, arrivedAt: at, by };
  const collator = new Intl.Collator('en');
  const before = people.findIndex(
    (one) => one.host == null && collator.compare(one.name ?? '', name) > 0,
  );

  return before < 0
    ? [...people, walkIn]
    : [...people.slice(0, before), walkIn, ...people.slice(before)];
}

export interface WalkInStart {
  name: string;
  checked: boolean;
  same: string | null;
}

export interface CheckInStart {
  people: DoorPerson[];
  phase: Phase;
  typed: string;
  walkIn: WalkInStart | null;
  failed: string | null;
  offline: boolean;
  fresh: readonly string[];
  said: string | null;
  toast: string | null;
  loading: boolean;
  live: boolean;
  gone: Gone | null;
  signedOut: boolean;
}

function seeded(arrivals: Readonly<Record<string, [string, string]>>, me: string): DoorPerson[] {
  return PEOPLE.map((one) => {
    const at = arrivals[one.id];

    return at == null ? one : { ...one, arrivedAt: at[0], by: at[1] === '@me' ? me : at[1] };
  });
}

export function checkInStart(state: CheckInState, holder: Holder): CheckInStart {
  const me = meOf(holder);
  const start: CheckInStart = {
    people: seeded(ARRIVED_BEFORE, me),
    phase: 'open',
    typed: '',
    walkIn: null,
    failed: null,
    offline: false,
    fresh: [],
    said: null,
    toast: null,
    loading: false,
    live: false,
    gone: null,
    signedOut: false,
  };
  const adaeze = PEOPLE[0]?.name ?? '';

  switch (state) {
    case 'searching':
      return { ...start, typed: 'okon ada' };
    case 'companions':
      return { ...start, typed: 'adewale' };
    case 'arrived':
      return {
        ...start,
        typed: 'okon ada',
        people: arrive(start.people, 'adaeze', NOW, me),
        said: CW.announced(adaeze, NOW),
      };
    case 'undone':
      return {
        ...start,
        typed: 'tunde',
        toast: CW.undone,
        said: CW.undone,
        people: undo(start.people, 'tunde'),
      };
    case 'no_match':
      return { ...start, typed: 'Kunle Adeyemi' };
    case 'walk_in':
      return {
        ...start,
        typed: 'Kunle Adeyemi',
        walkIn: { name: 'Kunle Adeyemi', checked: false, same: null },
      };
    case 'walk_in_blank':
      return { ...start, typed: 'Kunle Adeyemi', walkIn: { name: '', checked: true, same: null } };
    case 'invalid_name':
      return {
        ...start,
        typed: 'Kunle Adeyemi',
        walkIn: { name: LONG_NAME, checked: true, same: null },
      };
    case 'walk_in_duplicate':
      return {
        ...start,
        typed: 'sade bello',
        walkIn: { name: 'Folasade Bello', checked: true, same: 'Folasade Bello' },
      };
    case 'not_recorded':
      return { ...start, failed: 'adaeze', said: CW.notRecorded };
    case 'live':
      return { ...start, live: true };
    case 'before_open':
      return { ...start, phase: 'before', people: [...PEOPLE] };
    case 'ended':
      return {
        ...start,
        phase: 'ended',
        people: seeded(
          {
            ...ARRIVED_BEFORE,
            adaeze: ['19:42', '@me'],
            a1: ['19:42', '@me'],
            a2: ['19:43', '@me'],
            emeka: ['20:05', OTHER],
            folasade: ['19:50', '@me'],
            ngozi: ['19:44', OTHER],
            zainab: ['20:12', OTHER],
            marie: ['19:58', '@me'],
          },
          me,
        ),
      };
    case 'loading':
      return { ...start, loading: true };
    case 'empty':
      return { ...start, people: [] };
    case 'empty_closed':
      return { ...start, people: [], phase: 'before' };
    case 'offline':
      return { ...start, offline: true, failed: 'adaeze', said: CW.notRecorded };
    case 'offline_back':
      return {
        ...start,
        people: seeded({ ...ARRIVED_BEFORE, ngozi: ['19:46', OTHER], emeka: ['19:47', OTHER] }, me),
        fresh: ['ngozi', 'emeka'],
      };
    case 'link_gone':
    case 'outside_window':
    case 'outside_window_ended':
    case 'level_view':
      return { ...start, gone: state };
    case 'not_signed_in':
      return { ...start, signedOut: true };
    default:
      return start;
  }
}

/** Where the top bar's back link goes: an address, never the browser's history, so a reload lands there too. */
export function backOf(holder: Holder): { to: string; words: string } {
  return holder === 'code'
    ? { to: '/demo/redeem?state=from-check-in', words: DOOR_EVENT }
    : { to: '/demo/check-in/shift', words: CW.backShift };
}

const at = (state: CheckInState, name: string, holder: Holder = 'shift'): DemoLink => ({
  to: `/demo/check-in?state=${state}${holder === 'code' ? '&holder=code' : ''}`,
  name,
});

export const CHECK_IN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Reaching it',
    states: [
      { to: '/demo/check-in/shift', name: 'The shift page, Check-in under the clock card' },
      { to: '/demo/check-in/shift?level=view', name: 'The shift page at Can view: no Check-in' },
      { to: '/demo/redeem?state=browser-in', name: 'You’re in, from a door code: Check-in first' },
      { to: '/demo/redeem?state=browser-in-view', name: 'You’re in at Can view: no Check-in' },
      { to: '/demo/redeem?state=from-check-in', name: 'You’re in, back from check-in' },
      at('not_signed_in', 'Not signed in: names nothing, Enter a door code'),
    ],
  },
  {
    name: 'The list',
    states: [
      at('list', 'The list, A to Z, back to Your shift'),
      at('list', 'The list from a door code: back to the event', 'code'),
      at('loading', 'Loading'),
      at('searching', 'Searching “okon ada”'),
      at('companions', 'A guest and a named companion'),
      at('arrived', 'Arrived, announced'),
      at('undone', 'Arrival undone'),
      at('not_recorded', 'Not recorded'),
      at('live', 'Another device’s arrival, not announced'),
      at('empty', 'Nobody on the list yet'),
    ],
  },
  {
    name: 'Walk-ins',
    states: [
      at('no_match', 'No match, Add walk-in'),
      at('walk_in', 'Add walk-in: a sheet at the phone, a dialog at a desk'),
      at('walk_in_blank', 'Add walk-in, left blank'),
      at('invalid_name', 'Add walk-in, over 200 characters'),
      at('walk_in_duplicate', 'Add walk-in, already on the list'),
    ],
  },
  {
    name: 'Before, after and the connection',
    states: [
      at('before_open', 'Before check-in opens: search works'),
      at('empty_closed', 'Before check-in opens, nobody on the list'),
      at('ended', 'The event has ended: read only'),
      at('offline', 'Offline: nothing queued'),
      at('offline_back', 'Back online: what landed meanwhile'),
    ],
  },
  {
    name: 'When access ends',
    states: [
      at('link_gone', 'The link was replaced or removed'),
      at('outside_window', 'Outside the link’s window, before'),
      at('outside_window_ended', 'Outside the link’s window, after'),
      at('level_view', 'The job changed to Can view: back on the shift page'),
    ],
  },
];
