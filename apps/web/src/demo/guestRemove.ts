import type { Guest } from './guests.ts';

/** sc-3774's English, kept in the demo; the developer puts it in the four locales with [en]'s words. */
export const RMW = {
  remove: 'Remove from the list',
  title: (name: string) => `Remove ${name}?`,
  goes: 'These go with them:',
  theirReply: 'Their reply',
  companion: 'Companion',
  seatedAt: (table: string) => `seated at ${table}`,
  mealChosen: 'meal chosen',
  nothingSent: 'Nothing is sent to them.',
  keep: 'Keep on the list',
  go: 'Remove',
  removed: (name: string, companions: readonly string[]) =>
    companions.length === 0
      ? `${name} removed.`
      : `${name} removed, with ${LIST.format(companions)}.`,
  undoOpen: 'Undo is open for 10 seconds.',
  undo: 'Undo',
  secondsLeft: (left: number) => `${left} s`,
  backOnList: 'Back on the list. As they were, with their link, reply and companions.',
  arrival: 'Arrival',
  arrived: 'Arrived',
  staysArrived:
    'They have arrived, so they stay on the list. Their record ends with the event’s guest data setting.',
  justArrived: (name: string) => `${name} has just arrived, so they stay on the list.`,
  backToDetails: 'Back to their details',
  alreadyRemoved: (name: string) => `${name} was already removed by someone else.`,
  backToGuests: 'Back to guests',
} as const;

const LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** The count Undo stays open for, in seconds (sc-3774, WCAG 2.2 §2.2.1). */
export const UNDO_SECONDS = 10;

/** What Remove meets at the API: it goes, 409 guest_arrived, or 404 already removed. */
export type RemoveEnds = 'removes' | 'arrived' | 'gone';

export interface Removing {
  id: string;
  ends: RemoveEnds;
  refused?: 'arrived' | 'gone';
}

export interface Removed {
  guest: Guest;
  at: number;
}

/** Without guests.manage there is no Remove; an arrived guest has none either (sc-1454). */
export function removable(guest: Guest, manages: boolean): boolean {
  return manages && guest.arrived == null;
}

export function removeGuest(
  list: readonly Guest[],
  id: string,
): { list: Guest[]; removed: Removed | null } {
  const at = list.findIndex((one) => one.id === id);
  const guest = list[at];

  if (guest == null) return { list: [...list], removed: null };

  return { list: list.filter((one) => one.id !== id), removed: { guest, at } };
}

export function putBack(list: readonly Guest[], removed: Removed): Guest[] {
  if (list.some((one) => one.id === removed.guest.id)) return [...list];
  const at = Math.min(removed.at, list.length);

  return [...list.slice(0, at), removed.guest, ...list.slice(at)];
}

/** One second of the count: held while focus or the pointer is on the message, and from 10 again once both leave. */
export function nextCount(left: number, held: boolean): number {
  return held ? UNDO_SECONDS : Math.max(left - 1, 0);
}

export function arrivedIn(list: readonly Guest[], id: string, at: string): Guest[] {
  return list.map((one) => (one.id === id ? { ...one, arrived: at } : one));
}
