import { EVENTS, meshFor, type MeshKey } from '../events/EventsSample.ts';
import { fold } from '../OrgSwitcherModel.ts';

/** An event somebody leads, as the work list would carry it: its id and title, and the start and state that order it. */
export interface LedEvent {
  id: string;
  name: string;
  mesh: MeshKey;
  startsAt: string;
  over: boolean;
}

/** The Ask shows this many, then "and {n} more"; it never scrolls inside itself (sc-614). */
export const SHOWN_AT_MOST = 5;

/** The person menu searches above this many people, as the switcher does above 15 organisations. */
export const SEARCH_ABOVE = 15;

/** Soonest first: events not yet over by when they start, then the ones over (finished or called off), the latest first. */
export function soonestFirst(a: LedEvent, b: LedEvent): number {
  if (a.over !== b.over) return a.over ? 1 : -1;
  const order = a.startsAt.localeCompare(b.startsAt);

  return a.over ? -order : order;
}

export function ledEvents(ids: readonly string[]): LedEvent[] {
  return ids
    .flatMap((id) => EVENTS.filter((event) => event.id === id))
    .map((event) => ({
      id: event.id,
      name: event.name,
      mesh: meshFor(event.id),
      startsAt: event.startsAt,
      over: event.status === 'ended',
    }))
    .sort(soonestFirst);
}

export function firstFew(events: readonly LedEvent[]): { shown: LedEvent[]; more: number } {
  return {
    shown: events.slice(0, SHOWN_AT_MOST),
    more: Math.max(0, events.length - SHOWN_AT_MOST),
  };
}

export function searches(offered: number): boolean {
  return offered > SEARCH_ABOVE;
}

/** A name matches at the start of any of its words, case and accents aside: "jo" finds Joana, Jonas and João. */
export function nameMatches(name: string, query: string): boolean {
  const typed = fold(query.trim());
  if (typed === '') return true;

  return fold(name)
    .split(/\s+/u)
    .some((word) => word.startsWith(typed));
}
