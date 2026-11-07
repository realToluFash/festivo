import { eventPhase } from '@soirely/domain';

import en from '../i18n/locales/en.json';
import { type SampleEvent, sampleEvent } from './events.ts';
import type { Person } from './members.ts';
import { SAMPLE } from './rules.ts';

/** The handover's words (sc-614, A), read from the web's catalogue so the demo and the product cannot drift. */
export const HANDOVER_WORDS = en.handover;
const H = HANDOVER_WORDS;
const ORG = SAMPLE.organisation;

export const SEND_MS = 500;
export const HELD_MS = 8000;
export const SEARCH_ABOVE = 15;
export const LISTED = 5;

export function filled(words: string, slots: Readonly<Record<string, string | number>>): string {
  return words.replaceAll(/\{\{(\w+)(?:, number)?\}\}/gu, (whole, slot: string) =>
    String(slots[slot] ?? whole),
  );
}

type Family =
  | 'leads'
  | 'youLead'
  | 'handTo'
  | 'nobody'
  | 'willMove'
  | 'more'
  | 'leadsHead'
  | 'handTitle'
  | 'handTail'
  | 'matches'
  | 'ledBy'
  | 'ledByYou';

/** A plural family in English, by CLDR's rule, with its slots filled. */
export function counted(
  family: Family,
  count: number,
  slots: Readonly<Record<string, string>> = {},
): string {
  const form = new Intl.PluralRules('en').select(count) === 'one' ? 'one' : 'other';

  return filled(H[`${family}_${form}`], { ...slots, count });
}

export type Leads = Readonly<Record<string, readonly string[]>>;

export const SAMPLE_NOW = new Date('2026-11-04T12:00:00Z');

/** Soonest first (pm, 7 Nov): events not yet over by when they start, then those over, the most recent first. */
export function soonestFirst(events: readonly SampleEvent[], now = SAMPLE_NOW): SampleEvent[] {
  const over = (event: SampleEvent) => eventPhase(event, now) === 'finished';
  const ended = (event: SampleEvent) => Date.parse(event.concludedAt ?? event.endsAt);

  return [
    ...events
      .filter((event) => !over(event))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    ...events.filter(over).sort((a, b) => ended(b) - ended(a)),
  ];
}

export function ledBy(leads: Leads, id: string): SampleEvent[] {
  return soonestFirst((leads[id] ?? []).flatMap((event) => sampleEvent(event) ?? []));
}

export function handedOver(leads: Leads, from: string, to: string): Leads {
  const moving = leads[from] ?? [];

  return { ...leads, [to]: [...new Set([...(leads[to] ?? []), ...moving])], [from]: [] };
}

/** Who may take the events: active members, never the one leaving and never anyone suspended. */
export function offeredFor(people: readonly Person[], departing: string): Person[] {
  return people.filter((one) => one.status === 'active' && one.id !== departing);
}

export function fold(words: string): string {
  return words.normalize('NFD').replaceAll(/\p{M}/gu, '').toLocaleLowerCase('en');
}

/** At the start of any word in the name, case and accents ignored. */
export function matching(name: string, typed: string): boolean {
  const wanted = fold(typed.trim());

  return wanted === '' || ` ${fold(name)}`.includes(` ${wanted}`);
}

export function matchesLine(count: number): string {
  return count === 0 ? '' : counted('matches', count);
}

export function noMatchLine(typed: string): string {
  return filled(H.noMatch, { organisation: ORG, text: typed.trim() });
}

export type HandKind = 'remove' | 'leave' | 'hand';

export interface AskWords {
  title: string;
  lead: string;
  last: string;
  keep: string;
  go: string;
  red: boolean;
  busy: string;
  failed: string;
}

export function askWords(kind: HandKind, name: string, count: number): AskWords {
  const O = en.ownership;

  switch (kind) {
    case 'remove':
      return {
        title: `Remove ${name} from ${ORG}?`,
        lead: counted('leads', count, { name }),
        last: H.removeTail,
        keep: `Keep ${name.split(' ')[0] ?? name}`,
        go: 'Remove',
        red: true,
        busy: H.busy.remove,
        failed: H.failed.remove,
      };
    case 'leave':
      return {
        title: filled(O.leaveTitle, { organisation: ORG }),
        lead: counted('youLead', count),
        last: filled(O.leaveBody, { organisation: ORG }),
        keep: O.stay,
        go: filled(O.leave, { organisation: ORG }),
        red: true,
        busy: H.busy.leave,
        failed: H.failed.leave,
      };
    case 'hand':
      return {
        title: counted('handTitle', count, { name }),
        lead: counted('leads', count, { name }),
        last: counted('handTail', count, { name }),
        keep: 'Cancel',
        go: H.handOver,
        red: false,
        busy: H.busy.hand,
        failed: H.failed.hand,
      };
  }
}

/** Who takes them, as the button and the menu say it: "Nobody: the owners take them" for nobody. */
export function whoWords(
  person: Pick<Person, 'id' | 'name'> | null,
  viewer: string,
  count: number,
): string {
  if (person == null) return counted('nobody', count);

  return person.id === viewer ? filled(H.yours, { name: person.name }) : person.name;
}

export interface Handed {
  to: string;
  count: number;
}

/** Where the events went. Handing them to yourself sends you no email (pm, 7 Nov). */
export function ledByLine(handed: Handed, name: string, viewer: string): string {
  return handed.to === viewer
    ? counted('ledByYou', handed.count)
    : counted('ledBy', handed.count, { name });
}

export type HandPhase = 'asking' | 'held' | 'failed';

/** Where a handover's confirm starts: who is picked, the menu, what is typed, and an answer held on its way or failed. */
export interface HandStart {
  to: string | null;
  menu: boolean;
  query: string;
  phase: HandPhase;
}

export function handStart(
  to: string | null,
  change: Partial<Omit<HandStart, 'to'>> = {},
): HandStart {
  return { to, menu: false, query: '', phase: 'asking', ...change };
}
