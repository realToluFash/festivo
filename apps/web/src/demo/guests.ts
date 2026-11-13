import {
  LOCALES,
  callingCode,
  compareGuestNames,
  emailProblem,
  eventAllows,
  eventPhase,
} from '@soirely/domain';

import { CLOCKS, type SampleEvent, cardOf, localDay, sampleEvent } from './events.ts';
import {
  NO_NEEDS,
  type Needs,
  type NeedsLines,
  dietary,
  hasAllergy,
  needsLines,
  needsOf,
  savedNeeds,
} from './guestNeeds.ts';
import { repliesOpen } from './replyClose.ts';
import {
  CHOICE_WORDS,
  GW,
  REPLY_WORDS,
  type HowInvited,
  type HowTold,
  midSentence,
} from './guestsWords.ts';
import { numberLine } from './rules.ts';
import { type HowAgreed, NO_CONSENT, type WhatsAppConsent, hostAgreed } from './whatsAppConsent.ts';
import type { DemoLink } from './settings.ts';
import { type ExportStart, XW, exportDay, fileName } from './guestExport.ts';
import { type Change, changeLabel, changeWhen } from './changedSince.ts';

/** Guests in A · Summary first (page e30, board/guests-a-spec.md): the sample, its counts and the states; the words are in guestsWords.ts. */
export { GW };

export type Reply = 'coming' | 'notSure' | 'noReply' | 'notComing' | 'held' | 'notYet' | 'walkIn';
export type Choice = 'all' | 'invited' | Reply;
/** sc-4331: Changed since you looked sits apart from the reply choices and outside their add-up-to-All rule. */
export type Filter = Choice | 'changed';
export type Answer = 'coming' | 'notComing' | 'notSure';

export const ANSWERS: readonly Answer[] = ['coming', 'notComing', 'notSure'];

const GROUP_ORDER: readonly Reply[] = ['coming', 'notSure', 'noReply', 'notComing', 'notYet'];

export const CHOICES: readonly Choice[] = [
  'all',
  'invited',
  'coming',
  'walkIn',
  'notSure',
  'noReply',
  'held',
  'notComing',
  'notYet',
];

export const WEDDING = 'evt-wed-4';
export const PARTY = 'evt-party-2';
export const DRAFT = 'evt-draft-4';
export const READER = 'Folake Adeyemi';
const COLLEAGUE = 'Ana Souza';
export const MOST_COMPANIONS = 10;
export const NAME_MOST = 200;
export const FIRST_ROWS = 2;
export const LINK = 'https://soirely.app/i/Qm7xK2pVw9LrT4nZc8YbHd3sFa6Ue1Gj';

export interface Said {
  by: string | null;
  how: string | null;
  on: string;
}

export interface Phone {
  country: string;
  number: string;
}

export interface Companion {
  id: string;
  name: string | null;
  reply: Reply;
  /** Their seat and meal pick (epics 31, 32): removing them says what goes first (sc-3773). */
  table?: string;
  meal?: boolean;
  /** sc-3779: the guest gave this name on their page; the host editing it clears it. */
  namedBy?: 'guest';
  /** sc-3777: their own needs, as the guest's are. */
  needs?: Needs;
}

/** sc-3790: a guest's language, en, es, fr or pt; null is Not set. The host's and the guest's own are the AC, not yet built. */
export type GuestLanguage = 'en' | 'es' | 'fr' | 'pt';
export const GUEST_LANGUAGES: readonly { code: GuestLanguage; name: string }[] = LOCALES.map(
  (one) => ({ code: one.code as GuestLanguage, name: one.nativeName }),
);
/** The organisation's language, for the Not set line; Ire Events' in the sample. */
export const ORGANISATION_LANGUAGE: GuestLanguage = 'en';

export function languageName(code: GuestLanguage | null): string | null {
  return GUEST_LANGUAGES.find((one) => one.code === code)?.name ?? null;
}

export interface Guest {
  id: string;
  name: string;
  reply: Reply;
  replied: string | null;
  recorded: Said | null;
  invited: Said | null;
  reopened: Said | null;
  email: string | null;
  phone: Phone | null;
  companions: readonly Companion[];
  added: Said;
  replaced: string | null;
  /** sc-1526: someone who opened their link pressed Tell them; a replace clears it. */
  flagged: boolean;
  arrived: string | null;
  language: GuestLanguage | null;
  chose: GuestLanguage | null;
  greetAs: string | null;
  whatsApp: WhatsAppConsent;
  askAgain: AskAgain | null;
  needs: Needs;
}

/** sc-1363: when a guest who answered Not sure yet will be, or was, asked again; Not sent: too late reads as nothing chosen. */
export type AskAgain = { kind: 'will' | 'asked'; on: string } | { kind: 'wont' };

const ADDED: Said = { by: COLLEAGUE, how: null, on: '2026-09-14' };
const BY_MESSAGE: Said = { by: null, how: null, on: '2026-10-12' };

function guest(id: string, name: string, reply: Reply, extra: Partial<Guest> = {}): Guest {
  return {
    id,
    name,
    reply,
    replied: null,
    recorded: null,
    invited: reply === 'notYet' ? null : BY_MESSAGE,
    reopened: null,
    email: null,
    phone: null,
    companions: [],
    added: ADDED,
    replaced: null,
    flagged: false,
    arrived: null,
    language: null,
    chose: null,
    greetAs: null,
    whatsApp: NO_CONSENT,
    askAgain: null,
    needs: NO_NEEDS,
    ...extra,
  };
}

function companions(
  host: string,
  places: number | readonly (string | null)[],
  reply: Reply,
): Companion[] {
  const names = typeof places === 'number' ? Array<null>(places).fill(null) : places;

  return names.map((name, index) => ({ id: `${host}-c${index + 1}`, name, reply }));
}

function slug(name: string): string {
  return folded(name).replaceAll(/[^a-z]+/gu, '-');
}

const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];

function emailOf(name: string, index: number, domain?: string): string {
  return `${folded(name)
    .replaceAll(/[^a-z ]/gu, '')
    .trim()
    .replaceAll(' ', '.')}@${domain ?? DOMAINS[index % DOMAINS.length] ?? 'gmail.com'}`;
}

/** sc-3779's unnamed places with a seat or a meal, for Fewer places to ask about. */
const SEATED_SAMPLE: Readonly<Record<string, readonly Partial<Companion>[]>> = {
  'carlos-mendoza': [{}, { table: 'Table 7' }],
  'daniel-asamoah': [{ table: 'Table 2' }, { meal: true }],
};

function seatedSample(one: Guest): Guest {
  const seats = SEATED_SAMPLE[one.id];

  return seats == null
    ? one
    : { ...one, companions: one.companions.map((place, at) => ({ ...place, ...seats[at] })) };
}

type More = readonly [name: string, day: string, places: number | readonly (string | null)[]];

function more(
  rows: readonly More[],
  reply: Reply,
  placeReply: Reply,
  extra: (index: number) => Partial<Guest> = () => ({}),
  domain?: string,
): Guest[] {
  return rows.map(([name, day, places], index) => {
    const id = slug(name);

    return guest(id, name, reply, {
      replied: day === '' ? null : `2026-${day}`,
      email: emailOf(name, index, domain),
      companions: companions(id, places, placeReply),
      ...extra(index),
    });
  });
}

const MORE_COMING: readonly More[] = [
  ['Beatriz Almeida', '10-03', ['Tiago Almeida']],
  ['Benedict Osei', '10-05', 1],
  ['Bolanle Adisa', '10-06', 1],
  ['Carlos Mendoza', '10-04', 2],
  ['Chiamaka Obi', '10-08', 1],
  ['Chloé Martin', '10-09', 1],
  ['Daniel Asamoah', '10-07', 2],
  ['David Cohen', '10-10', 1],
  ['Ebere Nnaji', '10-11', 2],
  ['Elena García', '10-12', 1],
  ['Emmanuel Tetteh', '10-14', 2],
  ['Fatima Bello', '10-15', 1],
  ['Felipe Andrade', '10-16', 1],
  ['Florence Agyeman', '10-17', 1],
  ['Gabriel Moreau', '10-18', 1],
  ['Hadiza Musa', '10-19', 2],
  ['Helena Costa', '10-20', ['Miguel Costa']],
  ['Ibrahim Sani', '10-21', 2],
  ['Ifeanyi Okeke', '10-22', 1],
  ['Isabel Navarro', '10-23', 1],
  ['James Whitfield', '10-24', 0],
  ['Jean-Paul Fournier', '10-25', 1],
  ['Kemi Adeleke', '10-26', ['Tunji Adeleke']],
  ['Laura Fernández', '10-27', 2],
  ['Léon Garnier', '10-28', 1],
  ['Lola Carvalho', '10-29', 1],
  ['Manuel Vidal', '10-30', 2],
  ['Mariam Sow', '10-31', 1],
  ['Nkechi Uba', '11-01', 1],
  ['Obinna Ibe', '11-02', 1],
  ['Paula Ramos', '10-02', 1],
  ['Pedro Santos', '10-06', 2],
  ['Priya Shah', '10-08', 0],
  ['Rahel Tesfaye', '10-10', 0],
  ['Ricardo Pires', '10-12', 1],
  ['Samuel Boateng', '10-14', 1],
  ['Seyi Akande', '10-16', 1],
  ['Simone Lefèvre', '10-18', 0],
  ['Tariq Hassan', '10-20', 2],
  ['Temitope Oyelaran', '10-22', 1],
];

const MORE_NOT_SURE: readonly More[] = [
  ['Mariana Lopes', '10-19', 1],
  ['Mathieu Girard', '10-21', 0],
  ['Nnamdi Uzor', '10-22', 0],
  ['Olivia Bennett', '10-24', 0],
  ['Paulo Ribeiro', '10-25', 0],
  ['Rachel Adler', '10-27', 0],
  ['Sade Ogun', '10-28', 0],
  ['Thiago Mendes', '10-30', 0],
];

const MORE_NO_REPLY: readonly More[] = [
  ['Ugo Chukwu', '', 0],
  ['Ulla Svensson', '', 0],
  ['Valentina Russo', '', 1],
  ['Valérie Morel', '', 0],
  ['Vanessa Pinto', '', 0],
  ['Vicente Ortiz', '', 0],
  ['Victoria Adjei', '', 0],
  ['Vikram Nair', '', 0],
  ['Wale Ogunleye', '', 0],
  ['Wanjiru Kamau', '', 0],
  ['William Hughes', '', ['Eleanor Hughes']],
  ['Xavier Lemoine', '', 0],
  ['Yaa Owusu', '', 0],
  ['Yasmin Benali', '', 0],
  ['Yetunde Afolabi', '', 0],
  ['Zainab Sule', '', 1],
];

const MORE_NOT_COMING: readonly More[] = [
  ['Daniela Romero', '10-08', 0],
  ['Erik Lindqvist', '10-11', 0],
  ['Fatou Diop', '10-13', 0],
  ['Grace Appiah', '10-15', 0],
  ['Henri Marchand', '10-17', 0],
  ['Ifeoma Nwachukwu', '10-21', 0],
  ['Luis Herrera', '10-23', 0],
  ['Rosa Delgado', '10-26', 0],
];

const MORE_NOT_YET: readonly More[] = [
  ['Catarina Reis', '', 0],
  ['Chuka Nwankwo', '', 0],
  ['Dami Oladipo', '', 0],
  ['Elif Kaya', '', 0],
  ['Femi Ogundipe', '', 0],
  ['Inés Castillo', '', 0],
  ['Kenji Watanabe', '', 0],
  ['Lina Saleh', '', 0],
  ['Moses Kariuki', '', 0],
  ['Noor Rahman', '', 0],
  ['Patrice Leroy', '', 0],
  ['Sipho Dlamini', '', 0],
];

const INVITED_BY: readonly Said[] = [
  BY_MESSAGE,
  { by: READER, how: 'WhatsApp', on: '2026-10-09' },
  BY_MESSAGE,
  { by: COLLEAGUE, how: 'Email', on: '2026-10-10' },
];

/** Adaeze & Tunde's wedding as Messaging B counts it (pm, 7 Nov): 156 on the list, 142 invited, 96 coming; the board's guests first. */
function wedding(): Guest[] {
  return [
    guest('musa', 'Alhaji Musa Bello', 'coming', {
      replied: '2026-10-14',
      email: 'musa.bello@gmail.com',
      phone: { country: 'NG', number: '803 412 7730' },
      companions: companions('musa', 1, 'coming'),
      needs: needsOf({ diet: ['halal'] }),
    }),
    guest('amaka', 'Amaka Eze', 'coming', {
      replied: '2026-10-13',
      phone: { country: 'NG', number: '803 555 0142' },
    }),
    guest('bisi', 'Bisi Adewale', 'notYet', {
      email: 'bisi.adewale@yahoo.com',
      greetAs: 'Auntie Bisi',
    }),
    guest('camille', 'Camille Dubois', 'notComing', {
      replied: '2026-10-20',
      email: 'camille.dubois@free.fr',
    }),
    guest('folasade', 'Chief Mrs Folasade Okonkwo-Williams', 'notSure', {
      replied: '2026-10-16',
      phone: { country: 'NG', number: '802 300 1188' },
      companions: companions('folasade', 1, 'held'),
      needs: needsOf({ access: ['step_free', 'near_exit'] }),
    }),
    guest('emeka', 'Dr Emeka Nwosu', 'noReply', {
      invited: { by: READER, how: 'WhatsApp', on: '2026-10-09' },
      email: 'emeka.nwosu@nhs.net',
      phone: { country: 'GB', number: '7700 900231' },
      companions: companions('emeka', ['Adanna Nwosu'], 'held'),
      needs: needsOf({
        allergies: ['peanuts', 'tree_nuts'],
        diet: ['no_alcohol'],
        note: 'Carries an adrenaline pen. His sister Adanna knows where it is.',
      }),
    }),
    guest('ines', 'Inês Duarte', 'coming', {
      replied: '2026-10-13',
      email: 'ines.duarte@sapo.pt',
      companions: companions('ines', ['Rui Duarte'], 'coming').map((one) => ({
        ...one,
        table: 'Table 4',
        meal: true,
        needs: needsOf({ allergies: ['sesame'] }),
      })),
      needs: needsOf({ diet: ['vegetarian'] }),
      language: 'es',
      chose: 'pt',
    }),
    guest('joaquin', 'Joaquín Ruiz', 'noReply', {
      invited: { by: READER, how: 'In person', on: '2026-10-09' },
    }),
    guest('kwame', 'Kwame Mensah', 'coming', {
      replied: '2026-10-02',
      email: 'kwame.mensah@outlook.com',
      phone: { country: 'GB', number: '7700 900412' },
    }),
    guest('lucia', 'Lucía Ortega', 'notSure', {
      replied: '2026-10-18',
      phone: { country: 'ES', number: '612 345 678' },
      whatsApp: { kind: 'guest', on: '2026-11-02' },
    }),
    guest('marta', 'Marta Silva', 'coming', {
      replied: '2026-10-11',
      email: 'marta.silva@gmail.com',
    }),
    guest('ngozi', 'Ngozi Eze', 'coming', {
      replied: '2026-10-02',
      invited: null,
      email: 'ngozi.eze@gmail.com',
    }),
    guest('sophie', 'Sophie Laurent', 'coming', {
      replied: '2026-10-12',
      email: 'sophie.laurent@orange.fr',
      phone: { country: 'FR', number: '6 41 27 88 05' },
      companions: companions('sophie', ['Marc Laurent'], 'coming').map((one) => ({
        ...one,
        namedBy: 'guest' as const,
      })),
      language: 'fr',
      whatsApp: { kind: 'optedOut', on: '2026-11-01' },
    }),
    guest('tomas', 'Tomás Ferreira', 'noReply', { email: 'tomas.ferreira@gmial.com' }),
    guest('yusuf', 'Yusuf Ibrahim', 'notYet', { phone: { country: 'NG', number: '809 221 4410' } }),
    guest('nadia', 'Nadia Haddad', 'noReply', { email: 'nadia.haddad@gmail.com' }),
    guest('seun', 'Oluwaseun Ajayi', 'noReply', {
      invited: { by: COLLEAGUE, how: 'Text message', on: '2026-10-10' },
      phone: { country: 'NG', number: '805 667 1209' },
    }),
    ...more(MORE_COMING, 'coming', 'coming').map(seatedSample),
    ...more(MORE_NOT_SURE, 'notSure', 'held'),
    ...more(MORE_NO_REPLY, 'noReply', 'held', (index) => ({
      invited: INVITED_BY[index % INVITED_BY.length] ?? BY_MESSAGE,
    })),
    ...more(MORE_NOT_COMING, 'notComing', 'notComing'),
    ...more(MORE_NOT_YET, 'notYet', 'notYet'),
  ];
}

function party(): Guest[] {
  return [
    guest('daniel', 'Daniel Okafor', 'coming', {
      replied: '2026-10-21',
      email: 'daniel.okafor@ireevents.com',
    }),
    guest('hana', 'Hana Sato', 'coming', {
      replied: '2026-10-22',
      email: 'hana.sato@ireevents.com',
    }),
    ...more(
      [
        ['Ivy Chen', '10-20', 0],
        ['Jonas Weber', '10-21', 0],
        ['Kayode Alabi', '10-22', 1],
        ['Laila Ahmadi', '10-23', 0],
        ['Marco Bianchi', '10-23', 1],
        ['Nia Johnson', '10-24', 0],
        ['Omar Farouk', '10-24', 1],
        ['Pilar Soto', '10-25', 0],
        ['Quentin Roux', '10-26', 0],
        ['Rita Ferraz', '10-27', 0],
        ['Sanjay Patel', '10-28', 1],
        ['Tolu Akin', '10-29', 0],
        ['Uma Reddy', '10-30', 0],
        ['Wiktor Nowak', '10-31', 0],
      ],
      'coming',
      'coming',
      () => ({}),
      'ireevents.com',
    ),
    ...more(
      [
        ['Yemi Coker', '10-25', 0],
        ['Zoë Clarke', '10-27', 0],
      ],
      'notSure',
      'held',
    ),
    ...more(
      [
        ['Abel Tadesse', '10-20', 0],
        ['Bianca Rossi', '10-21', 0],
        ['Claire Dupont', '10-22', 0],
        ['Diego Morales', '10-23', 0],
      ],
      'notComing',
      'notComing',
    ),
    ...more(
      [
        ['Adwoa Boakye', '', 0],
        ['Bruno Teixeira', '', 1],
        ['Cecilia Moretti', '', 0],
        ['Dara O’Neill', '', 0],
        ['Efua Quaye', '', 0],
        ['Farah Siddiqui', '', 0],
        ['Gideon Ampofo', '', 0],
        ['Hiroshi Tanaka', '', 0],
        ['Ilse de Vries', '', 0],
        ['Joseph Kamara', '', 1],
        ['Kalinda Rao', '', 0],
        ['Lars Eriksen', '', 0],
        ['Mei Lin', '', 0],
        ['Nadine Brun', '', 0],
        ['Oscar Lindgren', '', 0],
        ['Pooja Iyer', '', 0],
        ['Renata Matos', '', 0],
      ],
      'noReply',
      'held',
    ),
    ...more(
      [
        ['Sam Adeyinka', '', 0],
        ['Tess Murray', '', 0],
        ['Vera Novak', '', 0],
      ],
      'notYet',
      'notYet',
    ),
  ];
}

function draft(): Guest[] {
  return [
    guest('funke', 'Funke Bello', 'notYet', {
      phone: { country: 'GB', number: '7700 900655' },
      companions: companions('funke', 1, 'notYet'),
    }),
    guest('leila', 'Leila Mansour', 'notYet', { email: 'leila.mansour@gmail.com' }),
    guest('tobi', 'Tobi Ojo', 'notYet', { email: 'tobi.ojo@gmail.com' }),
    ...more(
      [
        ['Tolani Ademola', '', 0],
        ['Toyin Fashola', '', 0],
        ['Uche Nwafor', '', 0],
        ['Vivian Eze', '', 0],
        ['Wumi Lawal', '', 0],
        ['Yemisi Ilori', '', 0],
        ['Yinka Balogun', '', 0],
        ['Zara Ilesanmi', '', 0],
      ],
      'notYet',
      'notYet',
    ),
  ];
}

export const WALK_IN: Guest = guest('kofi', 'Kofi Asante', 'walkIn', {
  invited: null,
  arrived: '18:20',
});

interface Sample {
  replyBy: string | null;
  list: () => Guest[];
}

const SAMPLES: Readonly<Record<string, Sample>> = {
  [WEDDING]: { replyBy: '2026-11-04', list: wedding },
  [PARTY]: { replyBy: null, list: party },
  [DRAFT]: { replyBy: null, list: draft },
};

export function hasGuests(id: string): boolean {
  const from = sampleEvent(id)?.guestsFrom;

  return Object.hasOwn(SAMPLES, id) || (from != null && hasGuests(from));
}

export function sampleGuests(id: string): Guest[] {
  const from = sampleEvent(id)?.guestsFrom;

  return from != null ? copiedGuests(from) : (SAMPLES[id]?.list() ?? []);
}

/** A ticked Duplicate's draft: the original's guests with their names, contact details and companions only (sc-3656). */
function copiedGuests(from: string): Guest[] {
  return sampleGuests(from).map((one) =>
    guest(one.id, one.name, 'notYet', {
      email: one.email,
      phone: one.phone,
      companions: one.companions.map((place) => ({
        id: place.id,
        name: place.name,
        reply: 'notYet',
      })),
    }),
  );
}

/** The Guests header's N, guests and companions together, which Delete event's question counts (sc-1468). */
export function peopleOn(id: string): number {
  return peopleOf(sampleGuests(id)).length;
}

export function replyByOf(id: string): string | null {
  return SAMPLES[id]?.replyBy ?? null;
}

/** The card's count sentence, which Reply by's asks say too (l10n, #33419 on sc-3780). */
export function haventLine(counts: Counts): string {
  return counts.haventCompanions === 0
    ? `${GW.havent(counts.havent)}.`
    : `${GW.havent(counts.havent)} (${GW.whoHavent(counts.haventGuests, counts.haventCompanions)}).`;
}

/** sc-3780's one rule: closed after 23:59:59 on the Reply by day, in the event's zone. */
export function repliesClosed(id: string, clock: Date): boolean {
  const replyBy = replyByOf(id);
  const zone = sampleEvent(id)?.timeZone ?? 'Europe/London';

  return replyBy != null && !repliesOpen(clock, replyBy, zone);
}

export function guestsAt(id: string, extra: Readonly<Record<string, string>> = {}): string {
  const params = new URLSearchParams(id === WEDDING ? extra : { event: id, ...extra });
  const search = params.toString();

  return search === '' ? '/demo/guests' : `/demo/guests?${search}`;
}

function folded(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function dayOf(iso: string): string {
  return DAY.format(new Date(`${iso}T12:00:00Z`));
}

export function weekdayOf(iso: string): string {
  return WEEKDAY.format(new Date(`${iso}T12:00:00Z`));
}

export function todayOf(clock: Date): string {
  return localDay(clock, 'Europe/London');
}

export function phoneShown(phone: Phone): string {
  return `${callingCode(phone.country) ?? ''} ${phone.number}`.trim();
}

export interface Person {
  id: string;
  name: string;
  reply: Reply;
  guest: Guest;
  companion: Companion | null;
}

export function companionName(host: Guest, companion: Companion): string {
  const at = host.companions.indexOf(companion);

  if (companion.name != null && companion.name.trim() !== '') return companion.name;

  return at <= 0 ? GW.guestOf(host.name) : GW.guestOfNth(host.name, at + 1);
}

export function sorted(list: readonly Guest[]): Guest[] {
  return [...list].sort(compareGuestNames);
}

export function peopleOf(list: readonly Guest[]): Person[] {
  return sorted(list).flatMap((one) => [
    { id: one.id, name: one.name, reply: one.reply, guest: one, companion: null },
    ...one.companions.map((companion) => ({
      id: companion.id,
      name: companionName(one, companion),
      reply: companion.reply,
      guest: one,
      companion,
    })),
  ]);
}

export function inChoice(reply: Reply, choice: Choice): boolean {
  if (choice === 'all') return true;
  if (choice === 'invited') return reply !== 'notYet' && reply !== 'walkIn';

  return reply === choice;
}

export type Counts = Record<Choice, number> & {
  havent: number;
  haventGuests: number;
  haventCompanions: number;
};

/** sc-99's counts, exclusive; "haven't replied" is everyone without an answer of their own: the guests who owe one and the companions held behind them (pm, 7 Nov night). */
export function countsOf(list: readonly Guest[]): Counts {
  const people = peopleOf(list);
  const count = (choice: Choice) => people.filter((one) => inChoice(one.reply, choice)).length;
  const haventCompanions = people.filter(
    (one) => one.companion != null && one.reply === 'held' && one.guest.reply === 'noReply',
  ).length;
  const haventGuests = count('noReply');

  return {
    all: people.length,
    invited: count('invited'),
    coming: count('coming'),
    notSure: count('notSure'),
    noReply: haventGuests,
    held: count('held'),
    notComing: count('notComing'),
    notYet: count('notYet'),
    walkIn: count('walkIn'),
    havent: haventGuests + haventCompanions,
    haventGuests,
    haventCompanions,
  };
}

function invitedLine(said: Said): string {
  return said.by == null
    ? GW.invitedByMessage(dayOf(said.on))
    : GW.invitedBy(said.by, midSentence(said.how ?? 'Other'), dayOf(said.on));
}

/** The Invitation's one line (sc-3788): by hand, by Soirely's message, or from their reply when nothing earlier was recorded. */
export function invitationLine(one: Guest): string | null {
  if (one.invited != null) return invitedLine(one.invited);
  if (one.replied != null) return GW.invitedWhenReplied(dayOf(one.replied));

  return null;
}

/** Mark as not invited undoes only a mark made by hand, and only before they reply (sc-3788). */
export function handMarked(one: Guest): boolean {
  return one.invited?.by != null && one.reply === 'noReply';
}

/** sc-3788: Mark as invited is offered only while the phase allows `invite`: Live and Happening now. */
export function invitesOn(event: SampleEvent, now: Date): boolean {
  return eventAllows(eventPhase(event, now), 'invite');
}

export function replyLine(one: Guest, replyBy: string | null): string {
  const word = REPLY_WORDS[one.reply];

  switch (one.reply) {
    case 'noReply':
      return `${word} · ${lowerFirst(invitedLine(one.invited ?? BY_MESSAGE))}`;
    case 'notYet':
      return word;
    case 'walkIn':
      return GW.walkIn(one.arrived ?? '');
    default:
      return GW.withWord(word, replyTail(one, replyBy));
  }
}

export function replyTail(one: Guest, replyBy: string | null): string {
  if (one.recorded != null)
    return GW.recordedOn(
      one.recorded.by ?? READER,
      midSentence(one.recorded.how ?? 'Other'),
      dayOf(one.recorded.on),
    );
  if (one.reply === 'notSure' && one.askAgain != null) return askTail(one.askAgain);
  if (one.reply === 'notSure' && replyBy != null) return GW.askedOn(dayOf(replyBy));

  return GW.repliedOn(dayOf(one.replied ?? ADDED.on));
}

function askTail(ask: AskAgain): string {
  switch (ask.kind) {
    case 'will':
      return GW.willBeAskedAgain(dayOf(ask.on));
    case 'asked':
      return GW.askedAgain(dayOf(ask.on));
    case 'wont':
      return GW.wontBeAskedAgain;
  }
}

/** On 30 Oct, with Reply by 4 Nov: asked again a week after 16 Oct, three days before answers close, and never. */
export const ASK_AGAIN_CLOCK = new Date('2026-10-30T09:41:00Z');
const ASKS: Record<string, AskAgain> = {
  folasade: { kind: 'asked', on: '2026-10-23' },
  lucia: { kind: 'will', on: '2026-11-01' },
  'mariana-lopes': { kind: 'wont' },
};

function withAsks(list: readonly Guest[]): Guest[] {
  return list.map((one) => ({ ...one, askAgain: ASKS[one.id] ?? one.askAgain }));
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function cardLine(one: Guest, replyBy: string | null): string {
  if (one.reply === 'noReply') return invitedLine(one.invited ?? BY_MESSAGE);
  if (one.reply === 'notYet') return GW.copyFirst;

  return replyLine(one, replyBy);
}

export interface ListRow {
  person: Person;
  indent: boolean;
  line: string;
  label: string;
  /** sc-3777's grey Dietary notes tag and its allergy mark; never for someone who cannot manage guests. */
  dietary: boolean;
  allergy: boolean;
}

export function needsOfPerson(person: Person): Needs | undefined {
  return person.companion == null ? person.guest.needs : person.companion.needs;
}

function rowOf(
  person: Person,
  indent: boolean,
  mode: 'all' | Choice,
  replyBy: string | null,
  contacts: boolean,
): ListRow {
  const word = REPLY_WORDS[person.reply];
  let line: string;

  if (person.companion != null)
    line =
      person.reply === 'held'
        ? GW.heldLine
        : !indent && person.companion.name != null
          ? GW.guestOf(person.guest.name)
          : word;
  else if (mode === 'noReply') line = invitedLine(person.guest.invited ?? BY_MESSAGE);
  else {
    const short =
      person.reply === 'noReply' || person.reply === 'notYet'
        ? word
        : replyLine(person.guest, replyBy);
    const many = person.guest.companions.length;

    line =
      many === 0
        ? short
        : `${short} · ${GW.companionCount(many)} · ${GW.namedOf(namedOf(person.guest), many)}`;
  }

  const needs = contacts ? needsOfPerson(person) : undefined;
  const allergy = hasAllergy(needs);
  const tagged = dietary(needs);
  const label = [
    person.name,
    line.startsWith(word) ? line : `${word}, ${line}`,
    ...(allergy ? [GW.allergy] : []),
    ...(tagged ? [GW.dietaryNotes] : []),
  ].join(', ');

  return { person, indent, line, label, dietary: tagged, allergy };
}

export interface ListGroup {
  reply: Reply;
  count: number;
  rows: ListRow[];
  collapsed: boolean;
  next: string | null;
}

export type ListView = { kind: 'groups'; groups: ListGroup[] } | { kind: 'rows'; rows: ListRow[] };

/** A number search counts from 3 digits with no letters, typed with or without spaces, its country code or the national 0 (0803 123 4567 finds +234 803 123 4567). */
export function numberMatches(phone: Phone, q: string): boolean {
  const digits = q.replaceAll(/\D/gu, '');

  if (/\p{L}/u.test(q) || digits.length < 3) return false;
  const international = phoneShown(phone).replaceAll(/\D/gu, '');
  const national = phone.number.replaceAll(/\D/gu, '');

  return (
    international.includes(digits) ||
    (digits.startsWith('0') && national.startsWith(digits.slice(1)))
  );
}

function matches(person: Person, q: string, contacts: boolean): boolean {
  const typed = folded(q.trim());

  if (typed === '') return true;
  if (folded(person.name).includes(typed)) return true;
  if (person.companion != null || !contacts) return false;
  if (person.guest.email != null && folded(person.guest.email).includes(typed)) return true;

  return person.guest.phone != null && numberMatches(person.guest.phone, q);
}

function flatRows(
  people: readonly Person[],
  mode: Choice,
  replyBy: string | null,
  contacts: boolean,
): ListRow[] {
  const hosts = new Set(people.filter((one) => one.companion == null).map((one) => one.guest.id));

  return people.map((one) =>
    rowOf(one, one.companion != null && hosts.has(one.guest.id), mode, replyBy, contacts),
  );
}

/** A companion stays under their guest while they share the guest's reply or wait on it; otherwise they sit in their own reply's group (sc-3773, 8 Nov). */
function withHost(person: Person): boolean {
  return person.reply === person.guest.reply || person.reply === 'held';
}

export function viewOf(
  list: readonly Guest[],
  choice: Choice,
  q: string,
  expanded: ReadonlySet<Reply>,
  replyBy: string | null,
  contacts = true,
  dietaryOnly = false,
): { view: ListView; shown: number } {
  const people = peopleOf(list);
  const searched = q.trim() !== '';
  const needed = dietaryOnly && contacts;

  if (searched || needed || (choice !== 'all' && choice !== 'invited')) {
    const found = people.filter(
      (one) =>
        inChoice(one.reply, choice) &&
        matches(one, q, contacts) &&
        (!needed || dietary(needsOfPerson(one))),
    );

    return {
      view: { kind: 'rows', rows: flatRows(found, choice, replyBy, contacts) },
      shown: found.length,
    };
  }

  const walkIns = list.some((one) => one.reply === 'walkIn');
  const order: readonly Reply[] = walkIns
    ? ['coming', 'walkIn', ...GROUP_ORDER.slice(1)]
    : GROUP_ORDER;
  const groups = order
    .filter((reply) => inChoice(reply, choice))
    .map((reply) => {
      const heads = people
        .filter((one) => one.reply === reply && (one.companion == null || !withHost(one)))
        .sort((a, b) => compareGuestNames(a, b));
      const open = expanded.has(reply) || heads.length <= FIRST_ROWS;
      const rows = (open ? heads : heads.slice(0, FIRST_ROWS)).flatMap((head) => [
        rowOf(head, false, 'all', replyBy, contacts),
        ...(head.companion != null
          ? []
          : people
              .filter((one) => one.companion != null && one.guest.id === head.id && withHost(one))
              .map((one) => rowOf(one, true, 'all', replyBy, contacts))),
      ]);

      return {
        reply,
        count: people.filter((one) => one.reply === reply).length,
        rows,
        collapsed: !open,
        next: open ? null : (heads[FIRST_ROWS]?.id ?? null),
      };
    })
    .filter((group) => group.rows.length > 0);

  return {
    view: { kind: 'groups', groups },
    shown: people.filter((one) => inChoice(one.reply, choice)).length,
  };
}

export function choiceWord(choice: Filter): string {
  return choice === 'changed' ? GW.changedSince : CHOICE_WORDS[choice];
}

/** sc-4331: one row per guest the bell's item counts, newest first: the answer, or the bell's label for a change that is not a reply, and when. */
export function changedView(
  list: readonly Guest[],
  changes: readonly Change[],
  q: string,
  clock: Date,
  contacts = true,
): { view: ListView; shown: number } {
  const people = peopleOf(list);
  const rows = changes.flatMap((change): ListRow[] => {
    const person = people.find((one) => one.companion == null && one.guest.id === change.id);

    if (person == null || !matches(person, q, contacts)) return [];
    const answer = changeLabel(change.kind) ?? REPLY_WORDS[person.reply];
    const line = `${answer} · ${changeWhen(change, clock)}`;

    return [
      {
        person,
        indent: false,
        line,
        label: `${person.name}, ${line}`,
        dietary: false,
        allergy: false,
      },
    ];
  });

  return { view: { kind: 'rows', rows }, shown: rows.length };
}

export interface Values {
  name: string;
  email: string;
  country: string;
  number: string;
  language: GuestLanguage | null;
  greetAs: string;
  needs: Needs;
  companions: readonly { id: string | null; name: string; needs?: Needs }[];
}

export function valuesOf(one: Guest | null): Values {
  return {
    name: one?.name ?? '',
    email: one?.email ?? '',
    country: one?.phone?.country ?? 'GB',
    number: one?.phone?.number ?? '',
    language: one?.language ?? null,
    greetAs: one?.greetAs ?? '',
    needs: one?.needs ?? NO_NEEDS,
    companions:
      one?.companions.map((companion) => ({
        id: companion.id,
        name: companion.name ?? '',
        needs: companion.needs ?? NO_NEEDS,
      })) ?? [],
  };
}

export interface Lines {
  name?: string;
  greetAs?: string;
  email?: string;
  number?: string;
  /** sc-3777: each person's Needs refusals, `guest` or `c{n}` for a companion. */
  needs?: Record<string, NeedsLines>;
}

/** sc-3960: Greet as is counted in code points after trimming, as the API counts it. */
export const GREET_AS_MOST = 60;

export function greetAsLength(value: string): number {
  return [...value.trim()].length;
}

/** Saved trimmed; blank or only spaces is saved as empty. */
function greetAsOf(values: Values): string | null {
  return values.greetAs.trim() === '' ? null : values.greetAs.trim();
}

export function linesOf(values: Values): Lines {
  const lines: Lines = {};
  const name = values.name.trim();

  if (name === '') lines.name = GW.blankName;
  else if (name.length > NAME_MOST) lines.name = GW.nameTooLong(NAME_MOST);
  if (greetAsLength(values.greetAs) > GREET_AS_MOST)
    lines.greetAs = GW.greetAsTooLong(GREET_AS_MOST);
  if (values.email.trim() !== '' && emailProblem(values.email) === 'shape')
    lines.email = GW.emailShape;
  const number = numberLine(values.number, values.country, true);
  if (number != null) lines.number = number;
  const needs = Object.fromEntries(
    [
      ['guest', needsLines(values.needs)] as const,
      ...values.companions.map((one, at) => [`c${at}`, needsLines(one.needs ?? NO_NEEDS)] as const),
    ].filter(([, found]) => Object.keys(found).length > 0),
  );
  if (Object.keys(needs).length > 0) lines.needs = needs;

  return lines;
}

export function namedOf(one: Guest): number {
  return one.companions.filter((companion) => (companion.name ?? '').trim() !== '').length;
}

export type PlacesStep = { companions: Values['companions'] } | { refused: number };

/** sc-3779: places are companion rows; fewer takes unnamed places only, from the end, and refuses once every place left is named. */
export function placesTo(companions: Values['companions'], places: number): PlacesStep {
  const wanted = Math.max(0, Math.min(MOST_COMPANIONS, Math.trunc(places)));
  const named = companions.filter((one) => one.name.trim() !== '').length;

  if (wanted >= companions.length)
    return {
      companions: [
        ...companions,
        ...Array.from({ length: wanted - companions.length }, () => ({ id: null, name: '' })),
      ],
    };
  if (wanted < named) return { refused: named };
  let drop = companions.length - wanted;
  const kept = [...companions]
    .reverse()
    .filter((one) => {
      if (drop > 0 && one.name.trim() === '') {
        drop -= 1;
        return false;
      }
      return true;
    })
    .reverse();

  return { companions: kept };
}

export function sameName(
  list: readonly Guest[],
  name: string,
  except: string | null,
): Guest | null {
  const wanted = folded(name.trim());

  return list.find((one) => one.id !== except && folded(one.name) === wanted) ?? null;
}

function placeReply(host: Reply): Reply {
  if (host === 'noReply' || host === 'notSure') return 'held';

  return host;
}

export interface Seated {
  table: string | null;
  meal: boolean;
}

/** The seat and meal a companion would lose, or null when removing them takes nothing (sc-3773). */
export function seatedOf(guest: Guest, companionId: string | null): Seated | null {
  const one = guest.companions.find((each) => each.id === companionId);

  if (one == null || (one.table == null && one.meal !== true)) return null;

  return { table: one.table ?? null, meal: one.meal === true };
}

function hostNamed(one: Companion): Companion {
  const copy = { ...one };

  delete copy.namedBy;

  return copy;
}

export function saveGuest(list: readonly Guest[], id: string, values: Values): Guest[] {
  return list.map((one) => {
    if (one.id !== id) return one;
    const kept = values.companions.map((companion, index) => {
      const found = one.companions.find((each) => each.id === companion.id);
      const renamed = found != null && (found.name ?? '') !== companion.name.trim();
      const was = renamed ? hostNamed(found) : found;

      return {
        ...was,
        id: was?.id ?? `${id}-n${index + 1}`,
        name: companion.name.trim() === '' ? null : companion.name.trim(),
        reply: was?.reply ?? placeReply(one.reply),
        needs: savedNeeds(companion.needs ?? was?.needs ?? NO_NEEDS),
      };
    });

    return {
      ...one,
      name: values.name.trim(),
      email: values.email.trim() === '' ? null : values.email.trim(),
      phone:
        values.number.trim() === ''
          ? null
          : { country: values.country, number: values.number.trim() },
      language: values.language,
      greetAs: greetAsOf(values),
      needs: savedNeeds(values.needs),
      companions: kept,
    };
  });
}

let addedCount = 0;

export function addGuest(list: readonly Guest[], values: Values, on: string): Guest[] {
  addedCount += 1;
  const id = `new-${addedCount}`;
  const fresh = guest(id, values.name.trim(), 'notYet', {
    email: values.email.trim() === '' ? null : values.email.trim(),
    phone:
      values.number.trim() === ''
        ? null
        : { country: values.country, number: values.number.trim() },
    language: values.language,
    greetAs: greetAsOf(values),
    needs: savedNeeds(values.needs),
    added: { by: READER, how: null, on },
  });

  return [
    ...list,
    {
      ...fresh,
      companions: values.companions.map((companion, index) => ({
        id: `${id}-c${index + 1}`,
        name: companion.name.trim() === '' ? null : companion.name.trim(),
        reply: 'notYet' as const,
        needs: savedNeeds(companion.needs ?? NO_NEEDS),
      })),
    },
  ];
}

export function recordReply(
  list: readonly Guest[],
  id: string,
  answer: Answer,
  how: HowTold,
  ticked: ReadonlySet<string>,
  on: string,
): Guest[] {
  return list.map((one) =>
    one.id !== id
      ? one
      : {
          ...one,
          reply: answer,
          recorded: { by: READER, how, on },
          reopened: null,
          companions: one.companions.map((companion) => ({
            ...companion,
            reply:
              answer === 'coming'
                ? ticked.has(companion.id)
                  ? 'coming'
                  : 'notComing'
                : answer === 'notSure'
                  ? 'held'
                  : 'notComing',
          })),
        },
  );
}

export function markInvited(
  list: readonly Guest[],
  id: string,
  how: HowInvited,
  on: string,
): Guest[] {
  return list.map((one) =>
    one.id !== id
      ? one
      : {
          ...one,
          reply: 'noReply',
          invited: { by: READER, how, on },
          companions: one.companions.map((companion) => ({ ...companion, reply: 'held' as const })),
        },
  );
}

export function markNotInvited(list: readonly Guest[], id: string): Guest[] {
  return list.map((one) =>
    one.id !== id
      ? one
      : {
          ...one,
          reply: 'notYet',
          invited: null,
          companions: one.companions.map((companion) => ({
            ...companion,
            reply: 'notYet' as const,
          })),
        },
  );
}

/** sc-3950: the host's record that the guest agreed to WhatsApp, by the demo's member, today. */
export function agreeToWhatsApp(
  list: readonly Guest[],
  id: string,
  how: HowAgreed,
  on: string,
): Guest[] {
  return list.map((one) =>
    one.id === id ? { ...one, whatsApp: hostAgreed(READER, how, on) } : one,
  );
}

export function replaceLink(list: readonly Guest[], id: string, on: string): Guest[] {
  return list.map((one) => (one.id === id ? { ...one, replaced: on, flagged: false } : one));
}

/** sc-1526: Tell them, pressed on the guest's own page; pressed again it is still one flag. */
export function flagLink(list: readonly Guest[], id: string): Guest[] {
  return list.map((one) => (one.id === id ? { ...one, flagged: true } : one));
}

export function reopen(list: readonly Guest[], id: string, on: string): Guest[] {
  return list.map((one) =>
    one.id === id ? { ...one, reopened: { by: READER, how: null, on } } : one,
  );
}

export type CardKind = 'live' | 'beforeDoor' | 'day1' | 'day2';
export type CardStepDoes = 'add' | 'write' | 'makeLive';

export interface GuestsCard {
  tags: readonly { kind: 'draft' | 'live' | 'now' | 'paused' | null; word: string }[];
  says: string;
  arrived: string | null;
  line: string | null;
  step: CardStepDoes | null;
}

/** How the room stands, and the one next step (spec §4). The web has no Check-in (sc-1454), so the day's card counts with no step. */
export function guestsCardOf(
  event: SampleEvent,
  list: readonly Guest[],
  kind: CardKind,
  now: Date,
  manages: boolean,
): GuestsCard {
  const counts = countsOf(list);
  const replyBy = replyByOf(event.id);
  const comingOf = GW.comingOf(counts.coming, counts.invited);

  if (event.status === 'draft')
    return {
      tags: [{ kind: 'draft', word: 'Draft' }],
      says: GW.onList(counts.all),
      arrived: null,
      line: GW.draftLine,
      step: manages ? 'makeLive' : null,
    };
  if (event.status === 'paused')
    return {
      tags: [{ kind: 'paused', word: 'Paused' }],
      says: comingOf,
      arrived: null,
      line: GW.pausedLine,
      step: null,
    };
  if (eventPhase(event, now) === 'finished')
    return {
      tags: [{ kind: null, word: 'Finished' }],
      says: comingOf,
      arrived: null,
      line: GW.finishedLine,
      step: null,
    };
  if (list.length === 0)
    return { tags: [], says: GW.noGuests, arrived: null, line: null, step: manages ? 'add' : null };

  if (kind === 'day1' || kind === 'day2') {
    const tags = cardOf(event, now).tags.map((tag) => ({
      kind: tag.kind === 'now' ? ('now' as const) : null,
      word: tag.word,
    }));

    return {
      tags,
      says: kind === 'day1' ? GW.arrivedOf(41, 98) : GW.arrivedOf(87, 99),
      arrived: GW.arrived,
      line: `${comingOf}. ${kind === 'day1' ? GW.checkInOpened('16:00') : GW.openAllDay}`,
      step: null,
    };
  }
  if (kind === 'beforeDoor')
    return {
      tags: [
        { kind: 'live', word: 'Live' },
        { kind: null, word: 'Today, 18:00' },
      ],
      says: GW.checkInOpens('16:00'),
      arrived: null,
      line: `${comingOf}.`,
      step: null,
    };
  if (counts.invited === 0)
    return { tags: [], says: GW.onList(counts.all), arrived: null, line: null, step: null };

  const who = counts.havent === 0 ? GW.everyoneReplied : haventLine(counts);
  const close = replyBy == null ? null : closeLine(replyBy, localDay(now, event.timeZone));

  return {
    tags: [],
    says: comingOf,
    arrived: null,
    line: [who, close].filter(Boolean).join(' '),
    step: manages && counts.havent > 0 ? 'write' : null,
  };
}

/** One whole sentence per case, the day reckoned in the event's zone as sc-3780 reckons Reply by (l10n, 8 Nov). */
export function closeLine(replyBy: string, today: string): string {
  if (replyBy < today) return GW.closedOn(weekdayOf(replyBy));
  if (replyBy === today) return GW.closesToday;
  if (replyBy === nextDay(today)) return GW.closesTomorrow(weekdayOf(replyBy));

  return GW.closesOn(weekdayOf(replyBy));
}

function nextDay(iso: string): string {
  const at = new Date(`${iso}T12:00:00Z`);

  at.setUTCDate(at.getUTCDate() + 1);

  return at.toISOString().slice(0, 10);
}

/** member: a member without guests.manage (sc-3784), who exports without the needs columns. */
export type Role = 'owner' | 'member' | 'viewer' | 'staff';
export type GuestNote = 'recorded' | 'notReplaced' | 'linkReplaced' | 'unmarked' | 'unmarkRefused';
export type Invite = 'copied' | 'refused' | 'mark' | 'markRefused' | 'markNotSaved';

export interface EditStart {
  values?: Partial<Values>;
  tried?: boolean;
  duplicate?: boolean;
  conflict?: boolean;
  notSaved?: boolean;
  discard?: boolean;
  removed?: string;
  at?: string;
  /** A seated companion's Remove pressed: the Ask is open for them. */
  removing?: string;
  /** sc-3779: Fewer places pressed with every place named. */
  placesRefused?: boolean;
  /** sc-3777: the Needs sections open, `guest` or `c{n}`. */
  needs?: string[];
}

export interface RecordStart {
  answer?: Answer;
  how?: HowTold;
  tried?: boolean;
  replace?: boolean;
  notSaved?: boolean;
}

export interface AgreeStart {
  how?: HowAgreed;
  tried?: boolean;
  notSaved?: boolean;
}

export interface AddStart {
  values?: Partial<Values>;
  tried?: boolean;
  duplicate?: boolean;
  notAdded?: boolean;
  added?: string;
  at?: string;
  placesRefused?: boolean;
  needs?: string[];
}

export type Pane =
  | { kind: 'none' }
  | { kind: 'guest'; id: string; note?: GuestNote; invite?: Invite }
  | { kind: 'loading'; id: string }
  | { kind: 'notFound' }
  | { kind: 'edit'; id: string; start: EditStart }
  | { kind: 'record'; id: string; start: RecordStart }
  | { kind: 'whatsApp'; id: string; start: AgreeStart }
  | { kind: 'add'; start: AddStart };

export interface GuestsStart {
  event: string;
  role: Role;
  list: Guest[];
  status: 'ready' | 'loading' | 'failed';
  card: CardKind;
  clock: Date;
  choice: Filter;
  q: string;
  /** sc-4331: the last look the Changed since you looked filter counts from, kept in the address; null counts every change. */
  since: string | null;
  /** sc-4331: when the event's Guest replies item was last marked read, as the state opens: null is never, and by default it is the state's clock, so nothing has changed since. */
  looked?: string | null;
  /** sc-3777's Dietary notes chip. */
  dietary: boolean;
  menu: boolean;
  pane: Pane;
  asking: 'replace' | null;
  told: string | null;
  exporting: ExportStart | null;
  /** sc-26025: the guests whose Sent on WhatsApp? question is open, and how the next mark from it ends. */
  asked: string[] | null;
  askFailed: boolean;
  markEnds: 'saved' | 'fails' | 'refused';
  paused: boolean;
}

export const THEIRS = { email: 'kwame.mensha@outlook.com', number: '7700 900518' } as const;

const CLOCK_DOOR = new Date('2026-11-05T09:41:00Z');
const CLOCK_DAY1 = new Date('2026-11-05T18:41:00Z');
const CLOCK_DAY2 = new Date('2026-11-06T10:30:00Z');
const TODAY = '2026-11-03';
const CHUKA: Phone = { country: 'NG', number: '806 114 2290' };
const CLOCK_CLOSES = new Date('2026-11-04T09:41:00Z');
const CLOCK_EARLIER = new Date('2026-11-01T09:41:00Z');
/** Past Reply by and before 05:00, when the event's day begins for the door (sc-3895). */
const CLOCK_CLOSED = new Date('2026-11-05T00:30:00Z');

/** Every invited guest has answered: those who had not said Not coming, with the companions held behind them. */
function everyoneReplied(list: readonly Guest[]): Guest[] {
  return list.map((one) =>
    one.reply !== 'noReply'
      ? one
      : {
          ...one,
          reply: 'notComing',
          replied: '2026-11-02',
          companions: one.companions.map((companion) => ({
            ...companion,
            reply: 'notComing' as const,
          })),
        },
  );
}

/** No companion held behind a guest who owes a reply: the card's line loses its bracket. */
function noCompanionWaiting(list: readonly Guest[]): Guest[] {
  return list.map((one) => (one.reply === 'noReply' ? { ...one, companions: [] } : one));
}

/** The guest's own reply landing before the host's Mark as not invited: the 409's sample (sc-3788). */
function repliedFirst(list: readonly Guest[], id: string): Guest[] {
  return list.map((one) => (one.id === id ? { ...one, reply: 'coming', replied: TODAY } : one));
}

/** sc-3790's Add guest: a guest from Paris, Language set by the host. */
const LUCAS: Partial<Values> = {
  name: 'Lucas Moreau',
  email: 'lucas.moreau@orange.fr',
  language: 'fr',
};

/** sc-3960's Greet as one over the limit: 61 code points. */
const GREET_AS_LONG = 'Auntie Bisi, who taught every one of us to dance at weddings!';

/** sc-3777's limits, just over: an Other of 101 characters and a note of 506. */
const OTHER_LONG =
  'Raw kiwi, and anything cooked with kiwi, including the fruit salad at dessert and garnish on a plate.';
const NOTE_LONG = `${'She asked us to tell the kitchen herself on the night. '.repeat(9)}Thanks Ada.`;

const BIMPE: Partial<Values> = {
  name: 'Bimpe Adeyemi',
  email: 'bimpe.adeyemi@gmail.com',
  country: 'GB',
  number: '7700 900877',
};

export const GUESTS_STATES = [
  { key: 'first', name: 'First time: No guests yet, and Add guest' },
  { key: 'inUse', name: 'In use, nobody open yet' },
  { key: 'filterOpen', name: 'The filter menu open' },
  { key: 'filtered', name: 'Filtered to No reply, Dr Emeka Nwosu open' },
  { key: 'search', name: 'A search: “okon”' },
  { key: 'searchNone', name: 'A search that matches nobody: “kofi”' },
  { key: 'filterNone', name: 'Held and “marta”: nobody in both' },
  { key: 'changedRow', name: 'The filter menu with Changed since you looked first' },
  { key: 'changed', name: 'Changed since you looked, from the bell' },
  { key: 'changedMenu', name: 'Changed since you looked, the menu open on it' },
  { key: 'changedNone', name: 'Changed since you looked: nothing since' },
  { key: 'searchNumber', name: 'A number in its national form: “0803 412”' },
  { key: 'everyoneReplied', name: 'Everyone has replied' },
  { key: 'noCompanionsWaiting', name: 'No companion among those who haven’t replied' },
  { key: 'closesToday', name: 'Replies close today' },
  { key: 'closesLater', name: 'Replies close on a later date' },
  { key: 'repliesClosedLive', name: 'Replies have closed, the event still to come' },
  { key: 'loading', name: 'Loading' },
  { key: 'failed', name: 'Failed, with Try again' },
  { key: 'viewer', name: 'Can view: names and replies only' },
  { key: 'staffBefore', name: 'Door staff before the day: read-only' },
  { key: 'draft', name: 'A Draft event' },
  { key: 'paused', name: 'A Paused event' },
  { key: 'eventDeleted', name: 'The event deleted: not found' },
  { key: 'onTheDay', name: 'On the day: arrivals and a walk-in' },
  { key: 'secondDay', name: 'The event’s second day' },
  { key: 'guest', name: 'Dr Emeka Nwosu, no reply' },
  { key: 'guestComing', name: 'Kwame Mensah, Coming' },
  { key: 'recorded', name: 'A reply recorded by phone' },
  { key: 'notYetInvited', name: 'Bisi Adewale, not yet invited' },
  { key: 'guestViewer', name: 'Can view: a guest' },
  { key: 'guestLoading', name: 'A guest loading' },
  { key: 'notFound', name: 'No longer on the list' },
  { key: 'repliesClosed', name: 'Replies closed' },
  { key: 'repliesClosedViewer', name: 'Can view: replies closed' },
  { key: 'reopened', name: 'One reply reopened' },
  { key: 'askAgain', name: 'Not sure yet: when each will be asked again (sc-1363)' },
  { key: 'edit', name: 'Edit guest, in place' },
  { key: 'editErrors', name: 'Save refused before sending' },
  { key: 'editDuplicate', name: 'The name is already on the list' },
  { key: 'editCompanions', name: 'Companions: named, one removed' },
  { key: 'editMax', name: 'Ten companions, the most' },
  { key: 'editSeated', name: 'Removing a companion with a seat and a meal' },
  { key: 'editDiscard', name: 'Cancel with a change' },
  { key: 'edit412', name: 'A colleague’s change (412)' },
  { key: 'editNotSaved', name: 'Save failed' },
  { key: 'saved', name: 'Saved' },
  { key: 'record', name: 'Record a reply, nothing chosen' },
  { key: 'recordRefused', name: 'Save with nothing chosen' },
  { key: 'recordComing', name: 'Coming, by phone, with their companion' },
  { key: 'recordReplace', name: 'Replacing their own reply' },
  { key: 'recordNotSaved', name: 'Record a reply failed' },
  { key: 'add', name: 'Add guest, in place' },
  { key: 'addRefused', name: 'Add guest refused before sending' },
  { key: 'addDuplicate', name: 'The name is already on the list' },
  { key: 'added', name: 'Added: the form cleared for the next' },
  { key: 'addNotAdded', name: 'Add guest failed' },
  { key: 'linkCopied', name: 'Link copied, then Mark as invited' },
  { key: 'clipboardRefused', name: 'The browser refused the clipboard' },
  { key: 'replaceAsk', name: 'Replace link…: the Ask' },
  { key: 'replaced', name: 'The link replaced' },
  { key: 'notReplaced', name: 'Replace link failed' },
  { key: 'flagged', name: 'Their link may have reached the wrong person' },
  { key: 'flaggedAsk', name: 'Replace link… from the notice: the Ask' },
  { key: 'flaggedReplaced', name: 'Replaced from the notice: the notice gone' },
  { key: 'flaggedNotReplaced', name: 'Replace from the notice failed: the notice stays' },
  { key: 'flaggedViewer', name: 'Can view: a flagged guest, no notice' },
  { key: 'draftGuest', name: 'A Draft: no Copy, Replace link… stays' },
  { key: 'markAsInvited', name: 'Mark as invited: how?' },
  { key: 'markRefused', name: 'Mark as invited with nothing chosen' },
  { key: 'marked', name: 'Marked as invited' },
  { key: 'markNotSaved', name: 'Mark as invited failed' },
  { key: 'notYetFilter', name: 'Not yet invited, from the menu' },
  { key: 'invitedByMessage', name: 'Invited by Soirely’s message' },
  { key: 'invitedWhenReplied', name: 'Invited when they replied' },
  { key: 'unmarked', name: 'Mark as not invited: Marked as not invited' },
  { key: 'unmarkRefused', name: 'Mark as not invited refused: they replied first (409)' },
  { key: 'finished', name: 'A Finished event: nobody can be invited' },
  { key: 'languageAdd', name: 'Add guest, Language: Français' },
  { key: 'languageEdit', name: 'Edit guest, the guest chose their own language' },
  { key: 'languageNotSet', name: 'Details, Language Not set' },
  { key: 'languageSet', name: 'Details, Language Français' },
  { key: 'languageGuestChose', name: 'Details, the guest chose Português' },
  { key: 'greetAs', name: 'Details, Bisi Adewale with a Greet as' },
  { key: 'greetAsEmpty', name: 'Edit guest, Greet as empty' },
  { key: 'greetAsEdit', name: 'Edit guest, Greet as “Auntie Bisi”' },
  { key: 'greetAsLong', name: 'Greet as over 60, Save refused' },
  { key: 'greetAsSpaces', name: 'Only spaces saved: their full name' },
  { key: 'greetAsViewer', name: 'Can view: Greet as, no Edit' },
  { key: 'greetAsAdd', name: 'Add guest, Greet as “Auntie Bisi”' },
  { key: 'places', name: 'Edit guest: Places for companions, 0 of 1 named' },
  { key: 'placesSeated', name: 'Fewer places dropping an unnamed place with a seat: asked' },
  { key: 'placesSeatedTwo', name: 'Fewer places dropping two seated places: asked about each' },
  { key: 'placesRefused', name: 'Fewer places with every place named: refused' },
  { key: 'placesMax', name: 'Add guest: ten places, the most' },
  { key: 'namedByGuest', name: 'Details: Named by the guest' },
  { key: 'needsDetails', name: 'Details: Dr Emeka Nwosu’s allergies, diet and note' },
  { key: 'needsNone', name: 'Details: No dietary notes.' },
  { key: 'needsCompanion', name: 'Details: Inês Duarte’s diet, Rui Duarte’s allergy' },
  { key: 'needsChip', name: 'The Dietary notes chip on' },
  { key: 'needsViewer', name: 'Can view: no needs anywhere' },
  { key: 'needsAdd', name: 'Add guest: Needs closed, None recorded' },
  { key: 'needsAddOpen', name: 'Add guest: Needs open, nothing ticked' },
  { key: 'needsEdit', name: 'Edit guest: Needs open, filled' },
  { key: 'needsEditClosed', name: 'Edit guest: Needs closed, its chips' },
  { key: 'needsOtherBlank', name: 'Other allergy ticked and empty: Say which' },
  { key: 'needsOtherLong', name: 'Other allergy over 100: Save refused' },
  { key: 'needsNoteLong', name: 'Private note over 500: Save refused' },
  { key: 'needsCompanionForm', name: 'Edit guest: Their needs under a companion' },
  { key: 'needsSaved', name: 'Saved: the needs in Details' },
  {
    key: 'whatsAppNone',
    name: 'WhatsApp: Has not agreed to WhatsApp, and The guest agreed to WhatsApp',
  },
  { key: 'whatsAppAgree', name: 'Agreed to WhatsApp, nothing picked' },
  { key: 'whatsAppAgreeBlank', name: 'Save with nothing picked' },
  { key: 'whatsAppAgreePicked', name: 'In person picked' },
  { key: 'whatsAppNotSaved', name: 'Agreed to WhatsApp failed' },
  { key: 'whatsAppRecorded', name: 'Saved: the host’s record' },
  { key: 'whatsAppGuestAgreed', name: 'Lucía Ortega agreed on their page' },
  { key: 'whatsAppOptedOut', name: 'Sophie Laurent unsubscribed: only the guest can change it' },
  { key: 'whatsAppNoMobile', name: 'Inês Duarte, no mobile number: no WhatsApp row' },
  { key: 'whatsAppViewer', name: 'Can view (guests.read): no contact details, no WhatsApp row' },
  { key: 'export', name: 'Export: This view and Excel, the defaults' },
  { key: 'exportNarrowed', name: 'Export from Coming and “duarte”: a guest and their companion' },
  { key: 'exportEmpty', name: 'Export from an empty view: This view off, All guests chosen' },
  { key: 'exportCsv', name: 'Export: All guests as CSV' },
  { key: 'exportNoNeeds', name: 'Export without guests.manage: no allergies, diet or access' },
  { key: 'exportPreparing', name: 'Preparing the file…' },
  { key: 'exportFailed', name: 'The file couldn’t be made: Try again' },
  { key: 'exportReady', name: 'Your file is ready: the dialog closed' },
  { key: 'exportGrantView', name: 'Can view or Can check guests in: no Export' },
  { key: 'sendNone', name: 'Yusuf Ibrahim: Send on WhatsApp, nothing pressed' },
  { key: 'sendQuestion', name: 'Pressed: Sent to Yusuf Ibrahim on WhatsApp?' },
  { key: 'sendTwo', name: 'Two questions open: Yusuf Ibrahim and Chuka Nwankwo' },
  { key: 'sendNotSaved', name: 'Mark as invited from the question failed' },
  { key: 'sendFails', name: 'The next mark fails, the one after goes through' },
  { key: 'sendRefused', name: 'The next mark is refused: the event was paused (409)' },
  { key: 'sendLeftLive', name: 'The event left Live before the answer: no question' },
  { key: 'sendLastOne', name: 'Not yet invited: the last one marked, the list empties' },
  { key: 'sendBecameInvited', name: 'A colleague marked them meanwhile: the question goes' },
  { key: 'sendInvited', name: 'Already invited: a press asks nothing' },
  { key: 'sendNoMobile', name: 'Bisi Adewale, no mobile number: not offered' },
  { key: 'sendFinished', name: 'A Finished event: Yusuf Ibrahim is not offered Send' },
] as const;

export type GuestsState = (typeof GUESTS_STATES)[number]['key'];

export function guestsStateOf(raw: string | null): GuestsState | null {
  return GUESTS_STATES.find((one) => one.key === raw)?.key ?? null;
}

export function choiceOf(raw: string | null): Choice | null {
  return CHOICES.find((one) => one === raw) ?? null;
}

/** Where each `?state=` opens; a guest's states keep the list as the desk board draws it, filtered to No reply (Guests-A-Web). */
export function guestsStart(state: GuestsState | null, params: URLSearchParams): GuestsStart {
  const asked = params.get('event');
  const event =
    state === 'draft' || state === 'draftGuest'
      ? DRAFT
      : state === 'paused'
        ? PARTY
        : asked != null && hasGuests(asked)
          ? asked
          : WEDDING;
  const start: GuestsStart = {
    event,
    role: 'owner',
    list: sampleGuests(event),
    status: 'ready',
    card: 'live',
    clock: CLOCKS.rest,
    choice: 'all',
    q: '',
    since: null,
    dietary: false,
    menu: false,
    pane: { kind: 'none' },
    asking: null,
    told: null,
    exporting: null,
    asked: null,
    askFailed: false,
    markEnds: 'saved',
    paused: false,
  };
  const column = (pane: Pane, more: Partial<GuestsStart> = {}): GuestsStart => ({
    ...start,
    choice: 'noReply',
    pane,
    ...more,
  });
  const guestPane = (id: string, more: Partial<Extract<Pane, { kind: 'guest' }>> = {}): Pane => ({
    kind: 'guest',
    id,
    ...more,
  });
  const edit = (id: string, from: EditStart = {}): GuestsStart =>
    column({ kind: 'edit', id, start: from });
  const record = (id: string, from: RecordStart = {}): GuestsStart =>
    column({ kind: 'record', id, start: from });
  const agree = (from: AgreeStart = {}): GuestsStart => ({
    ...column({ kind: 'whatsApp', id: 'kwame', start: from }),
    choice: 'coming',
  });
  const add = (from: AddStart = {}): GuestsStart => column({ kind: 'add', start: from });
  const send = (more: Partial<GuestsStart> = {}): GuestsStart =>
    column(guestPane('yusuf'), { choice: 'notYet', ...more });
  const refusedNeeds = (needs: Partial<Needs>, at: string): GuestsStart => ({
    ...edit('kwame', { values: { needs: needsOf(needs) }, tried: true, needs: ['guest'], at }),
    choice: 'coming',
  });
  const closed = { clock: CLOCK_DOOR, card: 'beforeDoor' as const };
  const picked = applyParams(start, params);

  switch (state) {
    case null:
      return picked;
    case 'first':
      return { ...start, list: [] };
    case 'inUse':
    case 'draft':
    case 'paused':
    case 'eventDeleted':
      return start;
    case 'filterOpen':
      return column(guestPane('emeka'), { menu: true });
    case 'filtered':
    case 'guest':
      return column(guestPane('emeka'));
    case 'search':
      return { ...start, q: 'okon' };
    case 'searchNone':
      return { ...start, q: 'kofi' };
    case 'filterNone':
      return { ...start, choice: 'held', q: 'marta' };
    case 'changed':
      return { ...start, choice: 'changed', looked: start.clock.toISOString() };
    case 'changedMenu':
      return { ...start, choice: 'changed', menu: true, looked: start.clock.toISOString() };
    case 'changedRow':
      return { ...start, menu: true, looked: null };
    case 'changedNone':
      return {
        ...start,
        choice: 'changed',
        since: start.clock.toISOString(),
        looked: start.clock.toISOString(),
      };
    case 'searchNumber':
      return { ...start, q: '0803 412' };
    case 'everyoneReplied':
      return { ...start, list: everyoneReplied(start.list) };
    case 'noCompanionsWaiting':
      return { ...start, list: noCompanionWaiting(start.list) };
    case 'closesToday':
      return { ...start, clock: CLOCK_CLOSES };
    case 'closesLater':
      return { ...start, clock: CLOCK_EARLIER };
    case 'repliesClosedLive':
      return { ...start, clock: CLOCK_CLOSED };
    case 'loading':
      return { ...start, status: 'loading' };
    case 'failed':
      return { ...start, status: 'failed' };
    case 'viewer':
      return { ...start, role: 'viewer', pane: guestPane('kwame') };
    case 'staffBefore':
      return { ...start, role: 'staff' };
    case 'onTheDay':
      return { ...start, clock: CLOCK_DAY1, card: 'day1', list: [...start.list, WALK_IN] };
    case 'secondDay':
      return { ...start, clock: CLOCK_DAY2, card: 'day2', list: [...start.list, WALK_IN] };
    case 'guestComing':
      return column(guestPane('kwame'));
    case 'recorded':
      return column(guestPane('emeka', { note: 'recorded' }), {
        list: recordReply(start.list, 'emeka', 'coming', 'By phone', new Set(['emeka-c1']), TODAY),
      });
    case 'notYetInvited':
      return column(guestPane('bisi'));
    case 'guestViewer':
      return column(guestPane('kwame'), { role: 'viewer' });
    case 'guestLoading':
      return column({ kind: 'loading', id: 'emeka' });
    case 'notFound':
      return column({ kind: 'notFound' });
    case 'repliesClosed':
      return column(guestPane('emeka'), closed);
    case 'repliesClosedViewer':
      return column(guestPane('emeka'), { ...closed, role: 'viewer' });
    case 'reopened':
      return column(guestPane('emeka'), {
        ...closed,
        list: reopen(start.list, 'emeka', '2026-11-05'),
      });
    case 'askAgain':
      return column(guestPane('folasade'), {
        choice: 'notSure',
        clock: ASK_AGAIN_CLOCK,
        list: withAsks(start.list),
      });
    case 'edit':
      return edit('kwame');
    case 'editErrors':
      return edit('kwame', { values: { name: '', email: 'kwame.mensah@outlook' }, tried: true });
    case 'editDuplicate':
      return edit('kwame', { values: { name: 'Marta Silva' }, duplicate: true });
    case 'editCompanions':
      return edit('musa', {
        values: { companions: [{ id: 'musa-c1', name: 'Hauwa Bello' }] },
        removed: GW.guestOfNth('Alhaji Musa Bello', 2),
      });
    case 'editMax':
      return edit('musa', {
        values: {
          companions: [
            { id: 'musa-c1', name: 'Hauwa Bello' },
            ...Array.from({ length: MOST_COMPANIONS - 1 }, (_, at) => ({
              id: `musa-c${at + 2}`,
              name: '',
            })),
          ],
        },
      });
    case 'editSeated':
      return { ...edit('ines', { removing: 'ines-c1' }), choice: 'coming' };
    case 'editDiscard':
      return edit('kwame', { values: { email: 'kwame@mensah.co.uk' }, discard: true });
    case 'edit412':
      return edit('kwame', { conflict: true });
    case 'editNotSaved':
      return edit('kwame', { values: { email: 'kwame@mensah.co.uk' }, notSaved: true });
    case 'saved':
      return column(guestPane('kwame'), {
        list: saveGuest(start.list, 'kwame', {
          ...valuesOf(start.list.find((one) => one.id === 'kwame') ?? null),
          email: 'kwame@mensah.co.uk',
        }),
        told: GW.saved,
      });
    case 'record':
      return record('emeka');
    case 'recordRefused':
      return record('emeka', { tried: true });
    case 'recordComing':
      return record('emeka', { answer: 'coming', how: 'By phone' });
    case 'recordReplace':
      return record('ngozi', { answer: 'coming', how: 'By phone', replace: true });
    case 'recordNotSaved':
      return record('emeka', { answer: 'coming', how: 'By phone', notSaved: true });
    case 'add':
      return add();
    case 'addRefused':
      return add({ values: { number: '7700 90' }, tried: true });
    case 'addDuplicate':
      return add({ values: { name: 'Marta Silva', email: 'm.silva@gmail.com' }, duplicate: true });
    case 'added':
      return {
        ...add({ added: 'Bimpe Adeyemi' }),
        list: addGuest(start.list, { ...valuesOf(null), ...BIMPE }, TODAY),
      };
    case 'addNotAdded':
      return add({ values: BIMPE, notAdded: true });
    case 'linkCopied':
      return column(guestPane('bisi', { invite: 'copied' }));
    case 'clipboardRefused':
      return column(guestPane('kwame', { invite: 'refused' }));
    case 'replaceAsk':
      return column(guestPane('kwame'), { asking: 'replace' });
    case 'replaced':
      return column(guestPane('kwame', { note: 'linkReplaced' }), {
        list: replaceLink(start.list, 'kwame', TODAY),
      });
    case 'notReplaced':
      return column(guestPane('kwame', { note: 'notReplaced' }));
    case 'flagged':
      return column(guestPane('emeka'), { list: flagLink(start.list, 'emeka') });
    case 'flaggedAsk':
      return column(guestPane('emeka'), {
        list: flagLink(start.list, 'emeka'),
        asking: 'replace',
      });
    case 'flaggedReplaced':
      return column(guestPane('emeka', { note: 'linkReplaced' }), {
        list: replaceLink(flagLink(start.list, 'emeka'), 'emeka', TODAY),
      });
    case 'flaggedNotReplaced':
      return column(guestPane('emeka', { note: 'notReplaced' }), {
        list: flagLink(start.list, 'emeka'),
      });
    case 'flaggedViewer':
      return column(guestPane('emeka'), { list: flagLink(start.list, 'emeka'), role: 'viewer' });
    case 'draftGuest':
      return { ...start, pane: guestPane('leila') };
    case 'markAsInvited':
      return column(guestPane('bisi', { invite: 'mark' }));
    case 'markRefused':
      return column(guestPane('bisi', { invite: 'markRefused' }));
    case 'marked':
      return column(guestPane('bisi'), {
        list: markInvited(start.list, 'bisi', 'WhatsApp', TODAY),
      });
    case 'markNotSaved':
      return column(guestPane('bisi', { invite: 'markNotSaved' }));
    case 'sendNone':
      return send();
    case 'sendQuestion':
      return send({ asked: ['yusuf'] });
    case 'sendTwo':
      return send({
        asked: ['yusuf', 'chuka-nwankwo'],
        list: start.list.map((one) =>
          one.id === 'chuka-nwankwo' ? { ...one, phone: CHUKA } : one,
        ),
      });
    case 'sendNotSaved':
      return send({ asked: ['yusuf'], askFailed: true });
    case 'sendFails':
      return send({ asked: ['yusuf'], markEnds: 'fails' });
    case 'sendRefused':
      return send({ asked: ['yusuf'], markEnds: 'refused' });
    case 'sendLeftLive':
      return send({ asked: ['yusuf'], paused: true });
    case 'sendLastOne':
      return send({
        asked: ['yusuf'],
        list: start.list.filter((one) => one.reply !== 'notYet' || one.id === 'yusuf'),
      });
    case 'sendBecameInvited':
      return send({
        asked: ['yusuf'],
        list: start.list.map((one) =>
          one.id === 'yusuf'
            ? {
                ...one,
                reply: 'noReply' as const,
                invited: { by: 'Tunde Bakare', how: 'WhatsApp' as const, on: TODAY },
              }
            : one,
        ),
        choice: 'all',
      });
    case 'sendInvited':
      return column(guestPane('amaka'), { choice: 'coming' });
    case 'sendNoMobile':
      return send({ pane: guestPane('bisi') });
    case 'sendFinished':
      return send({ clock: CLOCKS.finished });
    case 'notYetFilter':
      return column(guestPane('bisi'), { choice: 'notYet' });
    case 'invitedByMessage':
      return column(guestPane('marta'), { choice: 'coming' });
    case 'invitedWhenReplied':
      return column(guestPane('ngozi'), { choice: 'coming' });
    case 'unmarked':
      return column(guestPane('emeka', { note: 'unmarked' }), {
        choice: 'notYet',
        list: markNotInvited(start.list, 'emeka'),
      });
    case 'unmarkRefused':
      return column(guestPane('seun', { note: 'unmarkRefused' }), {
        choice: 'coming',
        list: repliedFirst(start.list, 'seun'),
      });
    case 'finished':
      return column(guestPane('bisi'), { choice: 'notYet', clock: CLOCKS.finished });
    case 'languageAdd':
      return add({ values: LUCAS });
    case 'languageEdit':
      return { ...edit('ines'), choice: 'coming' };
    case 'languageNotSet':
      return column(guestPane('kwame'), { choice: 'coming' });
    case 'languageSet':
      return column(guestPane('sophie'), { choice: 'coming' });
    case 'languageGuestChose':
      return column(guestPane('ines'), { choice: 'coming' });
    case 'greetAs':
      return column(guestPane('bisi'), { choice: 'notYet' });
    case 'greetAsEmpty':
      return { ...edit('kwame', { at: 'greet-as' }), choice: 'coming' };
    case 'greetAsEdit':
      return { ...edit('bisi', { at: 'greet-as' }), choice: 'notYet' };
    case 'greetAsLong':
      return {
        ...edit('bisi', { values: { greetAs: GREET_AS_LONG }, tried: true, at: 'greet-as' }),
        choice: 'notYet',
      };
    case 'greetAsSpaces':
      return column(guestPane('bisi'), {
        choice: 'notYet',
        list: saveGuest(start.list, 'bisi', {
          ...valuesOf(start.list.find((one) => one.id === 'bisi') ?? null),
          greetAs: '   ',
        }),
        told: GW.saved,
      });
    case 'greetAsViewer':
      return column(guestPane('bisi'), { choice: 'notYet', role: 'viewer' });
    case 'greetAsAdd':
      return add({ values: { name: 'Olabisi Martins', greetAs: 'Auntie Bisi' }, at: 'greet-as' });
    case 'places':
      return { ...edit('musa', { at: 'places' }), choice: 'coming' };
    case 'placesSeated':
      return { ...edit('carlos-mendoza', { at: 'places' }), choice: 'coming' };
    case 'placesSeatedTwo':
      return { ...edit('daniel-asamoah', { at: 'places' }), choice: 'coming' };
    case 'placesRefused':
      return { ...edit('sophie', { placesRefused: true, at: 'places' }), choice: 'coming' };
    case 'placesMax':
      return add({
        values: {
          name: 'Adaeze Okafor',
          companions: Array.from({ length: MOST_COMPANIONS }, () => ({ id: null, name: '' })),
        },
        at: 'places',
      });
    case 'namedByGuest':
      return column(guestPane('sophie'), { choice: 'coming' });
    case 'needsDetails':
      return column(guestPane('emeka'));
    case 'needsNone':
      return column(guestPane('kwame'), { choice: 'coming' });
    case 'needsCompanion':
      return column(guestPane('ines'), { choice: 'coming' });
    case 'needsChip':
      return { ...start, dietary: true, pane: guestPane('emeka') };
    case 'needsViewer':
      return column(guestPane('emeka'), { role: 'viewer' });
    case 'needsAdd':
      return add({ values: { name: 'Olu Bankole' } });
    case 'needsAddOpen':
      return add({ values: { name: 'Olu Bankole' }, needs: ['guest'] });
    case 'needsEdit':
      return edit('emeka', { needs: ['guest'] });
    case 'needsEditClosed':
      return edit('emeka');
    case 'needsOtherBlank':
      return refusedNeeds({ allergies: ['other'] }, 'needs-otherAllergy');
    case 'needsOtherLong':
      return refusedNeeds({ allergies: ['other'], otherAllergy: OTHER_LONG }, 'needs-otherAllergy');
    case 'needsNoteLong':
      return refusedNeeds({ note: NOTE_LONG }, 'needs-note');
    case 'needsCompanionForm':
      return { ...edit('ines', { needs: ['c0'] }), choice: 'coming' };
    case 'needsSaved':
      return column(guestPane('kwame'), {
        choice: 'coming',
        list: saveGuest(start.list, 'kwame', {
          ...valuesOf(start.list.find((one) => one.id === 'kwame') ?? null),
          needs: needsOf({ allergies: ['milk'], diet: ['pescatarian'] }),
        }),
        told: GW.saved,
      });
    case 'whatsAppNone':
      return column(guestPane('kwame'), { choice: 'coming' });
    case 'whatsAppAgree':
      return agree();
    case 'whatsAppAgreeBlank':
      return agree({ tried: true });
    case 'whatsAppAgreePicked':
      return agree({ how: 'In person' });
    case 'whatsAppNotSaved':
      return agree({ how: 'In person', notSaved: true });
    case 'whatsAppRecorded':
      return column(guestPane('kwame'), {
        choice: 'coming',
        list: agreeToWhatsApp(start.list, 'kwame', 'In person', TODAY),
        told: GW.saved,
      });
    case 'whatsAppGuestAgreed':
      return column(guestPane('lucia'), { choice: 'notSure' });
    case 'whatsAppOptedOut':
      return column(guestPane('sophie'), { choice: 'coming' });
    case 'whatsAppNoMobile':
      return column(guestPane('ines'), { choice: 'coming' });
    case 'whatsAppViewer':
      return column(guestPane('kwame'), { choice: 'coming', role: 'viewer' });
    case 'export':
      return { ...start, exporting: {} };
    case 'exportNarrowed':
      return { ...start, choice: 'coming', q: 'duarte', exporting: {} };
    case 'exportEmpty':
      return { ...start, choice: 'held', q: 'marta', exporting: {} };
    case 'exportCsv':
      return { ...start, exporting: { scope: 'all', format: 'csv' } };
    case 'exportNoNeeds':
      return { ...start, role: 'member', exporting: {} };
    case 'exportPreparing':
      return { ...start, exporting: { making: 'preparing' } };
    case 'exportFailed':
      return { ...start, exporting: { making: 'failed' } };
    case 'exportReady':
      return {
        ...start,
        told: XW.ready(
          fileName(
            sampleEvent(start.event)?.name ?? '',
            exportDay(start.event, start.clock),
            'xlsx',
          ),
        ),
      };
    case 'exportGrantView':
      return { ...start, role: 'viewer' };
  }
}

/** With no state, `?guest=` opens a guest, as Overview's numbers do; `?filter=` and `?q=` are read by `useGuestsAddress`. */
function applyParams(start: GuestsStart, params: URLSearchParams): GuestsStart {
  const id = params.get('guest');
  const known = id != null && start.list.some((one) => one.id === id);

  return { ...start, pane: known ? { kind: 'guest', id } : start.pane };
}

/** The menu's choice and the search, as the address keeps them. */
export interface ViewInAddress {
  choice: Filter;
  q: string;
  since: string | null;
}

export function filterOf(raw: string | null): Filter | null {
  return raw === 'changed' ? 'changed' : choiceOf(raw);
}

/** What a state's list opens on before the address says otherwise. */
export function viewBase(state: GuestsState | null): ViewInAddress {
  const opened = guestsStart(state, new URLSearchParams());

  return { choice: opened.choice, q: opened.q, since: opened.since };
}

export const NUMBERS_STATES = [
  { key: 'overview', name: 'Overview: the counts beside Details', event: WEDDING },
  { key: 'overviewLoading', name: 'Overview: the counts loading', event: WEDDING },
  { key: 'overviewFailed', name: 'Overview: the counts didn’t load', event: WEDDING },
  { key: 'overviewNone', name: 'Overview: nobody invited yet', event: DRAFT },
  { key: 'overviewViewer', name: 'Overview without guests.read: no counts', event: WEDDING },
] as const;

export type NumbersState = (typeof NUMBERS_STATES)[number]['key'];

export function numbersStateOf(raw: string | null): NumbersState | null {
  return NUMBERS_STATES.find((one) => one.key === raw)?.key ?? null;
}

const at = (state: GuestsState): DemoLink => ({
  to: `/demo/guests?state=${state}`,
  name: GUESTS_STATES.find((one) => one.key === state)?.name ?? state,
});

const group = (name: string, states: readonly GuestsState[]) => ({ name, states: states.map(at) });

export const GUESTS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  group('The list', [
    'first',
    'inUse',
    'filterOpen',
    'filtered',
    'search',
    'searchNumber',
    'searchNone',
    'filterNone',
    'everyoneReplied',
    'noCompanionsWaiting',
    'closesToday',
    'closesLater',
    'repliesClosedLive',
  ]),
  group('The list’s other states', [
    'loading',
    'failed',
    'viewer',
    'staffBefore',
    'draft',
    'paused',
    'eventDeleted',
    'onTheDay',
    'secondDay',
  ]),
  group('A guest, beside the list', [
    'guest',
    'guestComing',
    'recorded',
    'notYetInvited',
    'guestViewer',
    'guestLoading',
    'notFound',
    'repliesClosed',
    'repliesClosedViewer',
    'reopened',
    'askAgain',
  ]),
  group('Edit, in place', [
    'edit',
    'editErrors',
    'editDuplicate',
    'editCompanions',
    'editMax',
    'editSeated',
    'editDiscard',
    'edit412',
    'editNotSaved',
    'saved',
  ]),
  group('Record a reply, in place', [
    'record',
    'recordRefused',
    'recordComing',
    'recordReplace',
    'recordNotSaved',
  ]),
  group('Add guest, in place', ['add', 'addRefused', 'addDuplicate', 'added', 'addNotAdded']),
  group('The guest’s language (sc-3790)', [
    'add',
    'languageAdd',
    'languageEdit',
    'languageNotSet',
    'languageSet',
    'languageGuestChose',
  ]),
  group('Greet as (sc-3960)', [
    'greetAs',
    'greetAsEmpty',
    'greetAsEdit',
    'greetAsLong',
    'greetAsSpaces',
    'greetAsViewer',
    'greetAsAdd',
  ]),
  group('Places for companions (sc-3779)', [
    'places',
    'placesSeated',
    'placesSeatedTwo',
    'placesRefused',
    'placesMax',
    'namedByGuest',
  ]),
  group('Needs (sc-3777)', [
    'needsDetails',
    'needsNone',
    'needsCompanion',
    'needsChip',
    'needsViewer',
    'needsAdd',
    'needsAddOpen',
    'needsEdit',
    'needsEditClosed',
    'needsOtherBlank',
    'needsOtherLong',
    'needsNoteLong',
    'needsCompanionForm',
    'needsSaved',
  ]),
  group('WhatsApp, only to guests who agreed (sc-3950)', [
    'whatsAppNone',
    'whatsAppAgree',
    'whatsAppAgreeBlank',
    'whatsAppAgreePicked',
    'whatsAppNotSaved',
    'whatsAppRecorded',
    'whatsAppGuestAgreed',
    'whatsAppOptedOut',
    'whatsAppNoMobile',
    'whatsAppViewer',
  ]),
  group('Export (sc-3784)', [
    'export',
    'exportNarrowed',
    'exportEmpty',
    'exportCsv',
    'exportNoNeeds',
    'exportPreparing',
    'exportFailed',
    'exportReady',
    'exportGrantView',
  ]),
  group('Send on WhatsApp (sc-26025)', [
    'sendNone',
    'sendQuestion',
    'sendTwo',
    'sendNotSaved',
    'sendFails',
    'sendRefused',
    'sendLeftLive',
    'sendLastOne',
    'sendBecameInvited',
    'sendInvited',
    'sendNoMobile',
    'sendFinished',
  ]),
  group('Their link may have reached the wrong person (sc-1526)', [
    'flagged',
    'flaggedAsk',
    'flaggedReplaced',
    'flaggedNotReplaced',
    'flaggedViewer',
  ]),
  group('The link and Mark as invited', [
    'linkCopied',
    'clipboardRefused',
    'replaceAsk',
    'replaced',
    'notReplaced',
    'draftGuest',
    'markAsInvited',
    'markRefused',
    'marked',
    'markNotSaved',
    'notYetFilter',
    'invitedByMessage',
    'invitedWhenReplied',
    'unmarked',
    'unmarkRefused',
    'finished',
  ]),
  {
    name: 'The numbers on Overview and Events',
    states: [
      ...NUMBERS_STATES.map((one) => ({
        to: `/demo/events/${one.event}?state=${one.key}`,
        name: one.name,
      })),
      { to: '/demo/events?state=events', name: 'Events: the two tiles and each event’s line' },
      { to: '/demo/events?state=eventsFirst', name: 'Events, a first run: no tiles' },
      { to: '/demo/events?state=eventsZero', name: 'Events, nobody invited: 0, never blank' },
    ],
  },
];
