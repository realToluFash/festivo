import { eventPhase } from '@soirely/domain';

import { type SampleEvent, sampleEvent } from './events.ts';
import type { Person } from './members.ts';
import { fold } from './switcher.ts';

export const SEND_MS = 500;
export const HELD_MS = 8000;
export const SEARCH_ABOVE = 15;
export const LISTED = 5;

const PLURAL = new Intl.PluralRules('en');

function byCount(count: number, one: string, other: string): string {
  return PLURAL.select(count) === 'one' ? one : other;
}

export type HandKind = 'remove' | 'leave' | 'hand';

/** Handing over a departing member's work (sc-614, A): the spec's words, as the app's MembersHandoverWords.ts has them. */
export const HANDOVER_WORDS = {
  leads: (name: string, count: number) =>
    byCount(
      count,
      `${name} leads 1 event. Hand it to:`,
      `${name} leads ${count} events. Hand them to:`,
    ),
  youLead: (count: number) =>
    byCount(count, 'You lead 1 event. Hand it to:', `You lead ${count} events. Hand them to:`),
  handTo: (count: number, who: string) => `${byCount(count, 'Hand it to', 'Hand them to')}: ${who}`,
  nobody: (count: number) =>
    byCount(count, 'Nobody: the owners take it', 'Nobody: the owners take them'),
  yours: (name: string) => `${name} · you`,
  willMove: (count: number) =>
    byCount(count, 'What will move, 1 event', `What will move, ${count} events`),
  more: (count: number) => byCount(count, 'and 1 more', `and ${count} more`),
  leadsHead: (count: number) => byCount(count, 'Leads 1 event', `Leads ${count} events`),
  handOverNow: 'Hand over now',
  removeTail: 'They lose access on their next request.',
  handTitle: (name: string, count: number) =>
    byCount(count, `Hand over ${name}’s event?`, `Hand over ${name}’s events?`),
  handTail: (name: string, count: number) =>
    byCount(
      count,
      `Restoring ${name} won’t give it back.`,
      `Restoring ${name} won’t give them back.`,
    ),
  handOver: 'Hand over',
  cancel: 'Cancel',
  busy: { remove: 'Removing…', leave: 'Leaving…', hand: 'Handing over…' } satisfies Record<
    HandKind,
    string
  >,
  failed: {
    remove: 'Removing did not work. Nothing was changed. Try again in a moment.',
    leave: 'Leaving did not work. Nothing was changed. Try again in a moment.',
    hand: 'Handing over did not work. Nothing was changed. Try again in a moment.',
  } satisfies Record<HandKind, string>,
  search: 'Search members',
  clearSearch: 'Clear search',
  matches: (count: number) => byCount(count, '1 member matches', `${count} members match`),
  /** Who leads them now; handing them to yourself sends you no email (pm, 7 Nov). */
  ledBy: (count: number, who: string | null) =>
    who == null
      ? byCount(
          count,
          'Their 1 event is now led by you.',
          `Their ${count} events are now led by you.`,
        )
      : byCount(
          count,
          `Their 1 event is now led by ${who}, who is emailed the list.`,
          `Their ${count} events are now led by ${who}, who is emailed the list.`,
        ),
};

const H = HANDOVER_WORDS;

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

/** At the start of any word in the name, case and accents ignored. */
export function matching(name: string, typed: string): boolean {
  const wanted = fold(typed.trim());

  return wanted === '' || ` ${fold(name)}`.includes(` ${wanted}`);
}

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

/** Who takes them, as the button and the menu say it: "Nobody: the owners take them" for nobody. */
export function whoWords(
  person: Pick<Person, 'id' | 'name'> | null,
  viewer: string,
  count: number,
): string {
  if (person == null) return H.nobody(count);

  return person.id === viewer ? H.yours(person.name) : person.name;
}

export interface Handed {
  to: string;
  count: number;
}

export function ledByLine(handed: Handed, name: string, viewer: string): string {
  return H.ledBy(handed.count, handed.to === viewer ? null : name);
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
