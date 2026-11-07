import { YOU } from './sample.ts';

const ORGANISATION = YOU.organisation;
const PLURAL = new Intl.PluralRules('en');

/** English counts in their plural family, one and other, as the catalogue writes them (sc-614, Settled 7 Nov). */
function byCount(count: number, one: string, other: string): string {
  return PLURAL.select(count) === 'one' ? one : other;
}

export type HandoverKind = 'remove' | 'leave' | 'hand';

/** Handing over a departing member's work, A · One person, in the Ask: the words of handover-a-spec.md. */
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
  yoursSaid: (name: string) => `${name}, you`,
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
    HandoverKind,
    string
  >,
  failed: {
    remove: 'Removing did not work. Nothing was changed. Try again in a moment.',
    leave: 'Leaving did not work. Nothing was changed. Try again in a moment.',
    hand: 'Handing over did not work. Nothing was changed. Try again in a moment.',
  } satisfies Record<HandoverKind, string>,
  search: 'Search members',
  clearSearch: 'Clear search',
  noMatch: (text: string) => `Nobody in ${ORGANISATION} matches “${text}”.`,
  matches: (count: number) => byCount(count, '1 member matches', `${count} members match`),
  /** Who leads them now; handing them to yourself sends you no email (sc-614, Settled 7 Nov). */
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
  former: 'They are listed under Former, with everything they did kept.',
};

/** Marta's card once Hand over now is done: who leads them, and that restoring her won't give them back. */
export function handedLines(name: string, count: number, who: string | null): string[] {
  return [HANDOVER_WORDS.ledBy(count, who), HANDOVER_WORDS.handTail(name, count)];
}
