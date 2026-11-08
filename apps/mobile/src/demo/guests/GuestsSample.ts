import { LOCALES } from '@soirely/domain';

import type { ReplyKind } from './GuestsWords.ts';

/** The boards' sample (guests-a-spec.md §17), not spec: the wedding counted as Messaging B counts it. */
export const READER = 'Folake Adeyemi';
export const COLLEAGUE = 'Ana Souza';
export const REPLY_BY = '2026-11-04';
export const TODAY = '2026-11-03';
export const OFFLINE_AS_OF = '09:32';
export const WEDDING = 'evt-wed-4';

export const COUNTS = {
  list: 156,
  notyet: 14,
  invited: 142,
  coming: 96,
  maybe: 10,
  noreply: 21,
  held: 6,
  notcoming: 9,
  /** Held behind a guest with no reply: with the 21, everyone without an answer of their own. */
  heldBehindNoReply: 4,
} as const;

export interface Companion {
  name: string;
  kind: ReplyKind;
  /** Their seat and meal pick (epics 31, 32): removing them says what goes first (sc-3773). */
  table?: string;
  meal?: boolean;
}

/** sc-3790: a guest's language; null is Not set. The host's and the guest's own are the AC, not yet built. */
export type GuestLanguage = 'en' | 'es' | 'fr' | 'pt';
export const GUEST_LANGUAGES: readonly { code: GuestLanguage; name: string }[] = LOCALES.map(
  (one) => ({ code: one.code as GuestLanguage, name: one.nativeName }),
);
/** The organisation's language, for the Not set line: Ire Events' in the sample. */
export const ORGANISATION_LANGUAGE: GuestLanguage = 'en';

export function languageName(code: GuestLanguage | null | undefined): string | null {
  return GUEST_LANGUAGES.find((one) => one.code === code)?.name ?? null;
}

export interface Invited {
  by: string;
  how: string | null;
  day: string;
}

export interface SampleGuest {
  key: string;
  name: string;
  kind: ReplyKind | 'walkin';
  when: string | null;
  email: string | null;
  phone: string | null;
  companions: readonly Companion[];
  invited: Invited | null;
  /** A reply a host recorded for them (sc-3787): how they told, and the day. */
  recorded?: { how: string; day: string } | null;
  arrived?: string;
  language?: GuestLanguage | null;
  chose?: GuestLanguage | null;
  /** sc-3960: how messages greet them; none is their full name. */
  greetAs?: string | null;
}

const SOIRELY: Invited = { by: 'Soirely’s message', how: null, day: '2026-10-12' };

function guest(
  key: string,
  name: string,
  kind: SampleGuest['kind'],
  rest: Partial<Omit<SampleGuest, 'key' | 'name' | 'kind'>> = {},
): SampleGuest {
  return {
    key,
    name,
    kind,
    when: null,
    email: null,
    phone: null,
    companions: [],
    invited: kind === 'notyet' ? null : SOIRELY,
    ...rest,
  };
}

export const GUESTS: readonly SampleGuest[] = [
  guest('musa', 'Alhaji Musa Bello', 'coming', {
    when: '2026-10-14',
    email: 'musa.bello@gmail.com',
    phone: '+234 803 412 7730',
    companions: [{ name: 'Guest of Alhaji Musa Bello', kind: 'coming' }],
  }),
  guest('amaka', 'Amaka Eze', 'coming', { when: '2026-10-13', phone: '+234 803 555 0142' }),
  guest('bisi', 'Bisi Adewale', 'notyet', {
    email: 'bisi.adewale@yahoo.com',
    greetAs: 'Auntie Bisi',
  }),
  guest('camille', 'Camille Dubois', 'notcoming', {
    when: '2026-10-20',
    email: 'camille.dubois@free.fr',
  }),
  guest('folasade', 'Chief Mrs Folasade Okonkwo-Williams', 'maybe', {
    when: '2026-10-16',
    phone: '+234 802 300 1188',
    companions: [{ name: 'Guest of Chief Mrs Folasade Okonkwo-Williams', kind: 'held' }],
  }),
  guest('emeka', 'Dr Emeka Nwosu', 'noreply', {
    email: 'emeka.nwosu@nhs.net',
    phone: '+44 7700 900231',
    companions: [{ name: 'Adanna Nwosu', kind: 'held' }],
    invited: { by: READER, how: 'WhatsApp', day: '2026-10-09' },
  }),
  guest('ines', 'Inês Duarte', 'coming', {
    when: '2026-10-13',
    email: 'ines.duarte@sapo.pt',
    companions: [{ name: 'Rui Duarte', kind: 'coming', table: 'Table 4', meal: true }],
    language: 'es',
    chose: 'pt',
  }),
  guest('joaquin', 'Joaquín Ruiz', 'noreply', {
    invited: { by: READER, how: 'in person', day: '2026-10-09' },
  }),
  guest('kwame', 'Kwame Mensah', 'coming', {
    when: '2026-10-02',
    email: 'kwame.mensah@outlook.com',
    phone: '+44 7700 900412',
  }),
  guest('lucia', 'Lucía Ortega', 'maybe', { when: '2026-10-18', phone: '+34 612 345 678' }),
  guest('marta', 'Marta Silva', 'coming', {
    when: '2026-10-11',
    email: 'marta.silva@gmail.com',
  }),
  guest('nadia', 'Nadia Haddad', 'noreply', { email: 'nadia.haddad@gmail.com' }),
  guest('ngozi', 'Ngozi Eze', 'coming', { when: '2026-10-02', email: 'ngozi.eze@gmail.com' }),
  guest('seun', 'Oluwaseun Ajayi', 'noreply', {
    phone: '+234 805 667 1209',
    invited: { by: COLLEAGUE, how: 'Text message', day: '2026-10-10' },
  }),
  guest('sophie', 'Sophie Laurent', 'coming', {
    when: '2026-10-12',
    email: 'sophie.laurent@orange.fr',
    companions: [{ name: 'Marc Laurent', kind: 'coming' }],
    language: 'fr',
  }),
  guest('tomas', 'Tomás Ferreira', 'noreply', { email: 'tomas.ferreira@gmial.com' }),
  guest('yusuf', 'Yusuf Ibrahim', 'notyet', { phone: '+234 809 221 4410' }),
];

export const FIRST_ROWS: Readonly<
  Record<'coming' | 'maybe' | 'noreply' | 'notcoming' | 'notyet', readonly string[]>
> = {
  coming: ['musa', 'amaka', 'ines'],
  maybe: ['folasade', 'lucia'],
  noreply: ['emeka', 'joaquin', 'nadia'],
  notcoming: ['camille'],
  notyet: ['bisi', 'yusuf'],
};

export const DRAFT_GUESTS: readonly SampleGuest[] = [
  guest('funke', 'Funke Bello', 'notyet', {
    phone: '+44 7700 900655',
    companions: [{ name: 'Guest of Funke Bello', kind: 'notyet' }],
  }),
  guest('leila', 'Leila Mansour', 'notyet', { email: 'leila.mansour@gmail.com' }),
  guest('tobi', 'Tobi Ojo', 'notyet', { email: 'tobi.ojo@gmail.com' }),
];

export const PAUSED_GUESTS: readonly SampleGuest[] = [
  guest('daniel', 'Daniel Okafor', 'coming', {
    when: '2026-10-21',
    email: 'daniel.okafor@ireevents.com',
  }),
  guest('hana', 'Hana Sato', 'coming', { when: '2026-10-22', email: 'hana.sato@ireevents.com' }),
  guest('yemi', 'Yemi Coker', 'maybe', { when: '2026-10-25', email: 'yemi.coker@ireevents.com' }),
  guest('zoe', 'Zoë Clarke', 'maybe', { when: '2026-10-27', email: 'zoe.clarke@ireevents.com' }),
];

/** Only the wedding has a Reply by date; the Paused party and the Draft have none (as the web demo). */
export function replyByOf(event: string): string | null {
  return event === WEDDING ? REPLY_BY : null;
}

export const DRAFT_COUNTS = { list: 12, notyet: 12 } as const;
export const PAUSED_COUNTS = { list: 48, invited: 45, coming: 20 } as const;

export const FROM_CONTACTS_ADDED: readonly SampleGuest[] = [
  guest('bimpe', 'Bimpe Adeyemi', 'notyet', { phone: '+44 7700 900877' }),
  guest('kofia', 'Dr Kofi Asante', 'notyet', { phone: '+233 24 412 8890' }),
];

export const KOFI_WALKIN = 'Kofi Asante';

export const WALK_IN: SampleGuest = guest('kofi', KOFI_WALKIN, 'walkin', {
  invited: null,
  arrived: '18:20',
});

/** The days and times of each state, as instants (London is on GMT in November). */
export const CLOCKS = {
  reader: '2026-11-03T09:41:00Z',
  staffEarly: '2026-11-05T14:30:00Z',
  beforeOpen: '2026-11-05T15:20:00Z',
  staffOpen: '2026-11-05T16:05:00Z',
  onTheDay: '2026-11-05T18:41:00Z',
  secondDay: '2026-11-06T10:30:00Z',
  ended: '2026-11-07T15:20:00Z',
} as const;

/** The door's count at each moment the boards draw: attended of expected (sc-1454, 5 Nov). */
export const ARRIVALS = {
  onTheDay: { arrived: 41, expected: 98 },
  staffOpen: { arrived: 3, expected: 98 },
  secondDay: { arrived: 87, expected: 99 },
  ended: { arrived: 93, expected: 99 },
} as const;

/** The plan states are drawn on Ireti at 40 as if Ire Events were on Free (spec §9). */
export const PLAN = { limit: 100, listed: 80, ireti: 'evt-ireti-2' } as const;

/** Each plan state's sample: how many are listed, picked, and the places for companions among rows not drawn. */
export const PLAN_SAMPLES = {
  roomLeft: { listed: 80, picked: 14, places: 0 },
  overLimit: { listed: 80, picked: 23, places: 3 },
  limitRefused: { listed: 80, picked: 23, places: 3 },
} as const;

export interface Picked {
  key: string;
  name: string;
  country: string;
  number: string;
  e164: string | null;
  numbers: readonly { label: string; number: string }[];
  unreadable: boolean;
  listed: boolean;
  email: string | null;
}

export const PICKED: readonly Picked[] = [
  {
    key: 'bimpe',
    name: 'Bimpe Adeyemi',
    country: 'GB',
    number: '7700 900877',
    e164: '+44 7700 900877',
    numbers: [],
    unreadable: false,
    listed: false,
    email: null,
  },
  {
    key: 'kofi',
    name: 'Dr Kofi Asante',
    country: 'GH',
    number: '24 412 8890',
    e164: '+233 24 412 8890',
    numbers: [
      { label: 'Mobile', number: '+233 24 412 8890' },
      { label: 'Work', number: '+233 30 221 0045' },
      { label: 'Home', number: '+233 30 277 1180' },
    ],
    unreadable: false,
    listed: false,
    email: null,
  },
  {
    key: 'hannah',
    name: 'Hannah Weber',
    country: 'GB',
    number: '0151 23',
    e164: null,
    numbers: [],
    unreadable: true,
    listed: false,
    email: null,
  },
  {
    key: 'kwame',
    name: 'Kwame Mensah',
    country: 'GB',
    number: '7700 900412',
    e164: '+44 7700 900412',
    numbers: [],
    unreadable: false,
    listed: true,
    email: null,
  },
];

export const CONTACTS = [
  { name: 'Bimpe Adeyemi', number: '+44 7700 900877', ticked: true },
  { name: 'Dr Kofi Asante', number: '+233 24 412 8890', ticked: true },
  { name: 'Hannah Weber', number: '0151 23', ticked: true },
  { name: 'Lola Martins', number: '+44 7700 900120', ticked: false },
  { name: 'Mariam Diallo', number: '+33 6 12 34 56 78', ticked: false },
] as const;

export const PICKED_COUNT = 23;

export const THEIRS = { email: 'kwame.mensha@outlook.com', phone: '7700 900518' } as const;
