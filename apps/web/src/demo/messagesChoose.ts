import { demoWords } from './demoWords.ts';
import { CHW } from './messagesChooseWords.ts';
import { NW } from './messagesNoticeWords.ts';
import { POPULATION } from './messagesPopulation.ts';
import type { Audience } from './messagesTo.ts';
import { MW } from './messagesWords.ts';

/** Choose guests, one by one (sc-3942, Messaging-B-Web-Choose): the guest list's names, their addresses with guests.manage, and why email can't reach some. */
export { CHW };

export const chw = demoWords(CHW);

export type Flag = 'noAddress' | 'bouncing' | 'complained';

export interface Pickable {
  id: string;
  name: string;
  email: string | null;
  mobile: boolean;
  flag: Flag | null;
}

const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'proton.me'] as const;
const BOUNCING = new Set(['Dayo Amoah', 'Ama Diallo']);
const COMPLAINED = new Set(['Diego Amoah', 'Ama Kamara']);

/** Blocked by the provider (provider_blocked): tried again on the next send, so never flagged here. */
export const PROVIDER_BLOCKED = 'Dayo Moreau';

const BY_NAME = new Intl.Collator('en', { sensitivity: 'base' });

function folded(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');
}

function addressOf(name: string, index: number): string {
  const local = folded(name)
    .replaceAll(/[^a-z ]/gu, '')
    .trim()
    .replaceAll(/\s+/gu, '.');
  const domain = BOUNCING.has(name) ? 'gmial.com' : DOMAINS[index % DOMAINS.length];

  return `${local}@${domain}`;
}

function flagOf(name: string, email: boolean): Flag | null {
  if (!email) return 'noAddress';
  if (BOUNCING.has(name)) return 'bouncing';

  return COMPLAINED.has(name) ? 'complained' : null;
}

let made: readonly Pickable[] | null = null;

/** The event's 142 guests as the guest list sends them, A to Z; companions are not listed, having no contact details of their own (sc-1468). */
export function pickable(): readonly Pickable[] {
  made ??= POPULATION.map((guest, index) => ({
    id: `g${index + 1}`,
    name: guest.name,
    email: guest.email ? addressOf(guest.name, index) : null,
    mobile: guest.mobile,
    flag: flagOf(guest.name, guest.email),
  })).sort((one, other) => BY_NAME.compare(one.name, other.name));

  return made;
}

export function idOf(name: string): string {
  return pickable().find((guest) => guest.name === name)?.id ?? '';
}

export function pickedOf(ids: readonly string[]): Pickable[] {
  return ids.flatMap((id) => pickable().find((guest) => guest.id === id) ?? []);
}

export function flagWord(flag: Flag): string {
  return flag === 'noAddress'
    ? MW.noEmail
    : flag === 'bouncing'
      ? MW.addressBouncing
      : NW.reportedSpam;
}

/** sc-3772's search: any part of the name, ignoring case and accents; the address too only with guests.manage (sc-3773). */
export function matching(typed: string, addresses: boolean): readonly Pickable[] {
  const looked = folded(typed.trim());

  if (looked === '') return pickable();

  return pickable().filter(
    (guest) =>
      folded(guest.name).includes(looked) ||
      (addresses && guest.email != null && folded(guest.email).includes(looked)),
  );
}

export function chosenIds(to: Audience): readonly string[] {
  return to.kind === 'who' && to.pick === 'chosen' ? (to.chosen ?? []) : [];
}

export function choseAudience(ids: readonly string[]): Audience {
  return { kind: 'who', conditions: [], pick: 'chosen', chosen: ids };
}

/** The To row shows this many chosen guests as chips, then "{n} more", which opens the picker. */
export const CHIPS_SHOWN = 6;

export const CHOOSE_GROUP = 'Choose guests, one by one (sc-3942)';

export const CHOOSE_STATES = [
  { key: 'chooseOpen', name: 'Choose guests, nobody chosen yet' },
  { key: 'chooseSearch', name: 'Searching by name or address' },
  { key: 'chooseNoMatch', name: 'A search with no match' },
  { key: 'chooseSeveral', name: 'Several chosen' },
  { key: 'chosen', name: 'Chosen: the guests back in To' },
  { key: 'chosenMany', name: 'Nine chosen: six shown in To' },
  { key: 'chooseFlags', name: 'No address, bouncing, reported as spam' },
  { key: 'chooseNoAddresses', name: 'Without guests.manage: names only' },
  { key: 'chooseLoading', name: 'Loading the list' },
  { key: 'chooseLong', name: 'A long list, by keyboard' },
] as const;

export type ChooseState = (typeof CHOOSE_STATES)[number]['key'];

export function isChooseState(state: string | null): state is ChooseState {
  return CHOOSE_STATES.some((one) => one.key === state);
}

export interface ChooseView {
  typed: string;
  loading: boolean;
  first: string | null;
}

const SEVERAL = ['Abena Mensah', 'Adwoa Rossi', 'Ama Owusu'];
const NINE = [
  ...SEVERAL,
  'Bisi Adewale',
  'Camille Dubois',
  'Kemi Bankole',
  'Kwame Mensah',
  'Lucía Ortega',
  'Yetunde Bakare',
];

/** What each state opens with: the picker open or shut, who is chosen, what is typed, and where focus starts. */
export function chooseSeedOf(state: ChooseState): {
  open: boolean;
  chosen: readonly string[];
  view: ChooseView;
} {
  const open = (typed: string, names: readonly string[], first: string | null = 'find') => ({
    open: true,
    chosen: names.map(idOf),
    view: { typed, loading: false, first },
  });

  switch (state) {
    case 'chooseOpen':
      return open('', []);
    case 'chooseSearch':
      return open('ade', []);
    case 'chooseNoMatch':
      return open('Zainab', []);
    case 'chooseSeveral':
      return open('', SEVERAL, `guest:${idOf('Ama Owusu')}`);
    case 'chosen':
      return {
        open: false,
        chosen: SEVERAL.map(idOf),
        view: { typed: '', loading: false, first: null },
      };
    case 'chosenMany':
      return {
        open: false,
        chosen: NINE.map(idOf),
        view: { typed: '', loading: false, first: null },
      };
    case 'chooseFlags':
      return open('', ['Dayo Amoah', 'Dayo Gomez'], `guest:${idOf('Dayo Amoah')}`);
    case 'chooseNoAddresses':
      return open('dayo', []);
    case 'chooseLoading':
      return { open: true, chosen: [], view: { typed: '', loading: true, first: 'find' } };
    case 'chooseLong':
      return open('', [...SEVERAL, 'Kemi Bankole'], `guest:${idOf('Kemi Bankole')}`);
  }
}
