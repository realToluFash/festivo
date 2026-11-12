import { eventPhase } from '@soirely/domain';

import type { SampleEvent } from './EventsSample.ts';

/** One event's guests, as sc-3971 (Invited) and sc-1439 (Coming, Not coming, Not sure yet) will return them: `replied` counts every answer, `coming` the Coming ones. */
export interface Guests {
  invited: number;
  coming: number;
  replied: number;
}

export interface GuestCounts {
  invited: number;
  coming: number;
  replied: number;
  notReplied: number;
}

/** The web demo's numbers, so both demos show the same organisation; a draft has nobody invited (`draftBody`). */
export const SAMPLE_GUESTS: Readonly<Record<string, Guests>> = {
  'evt-wed-4': { invited: 142, coming: 96, replied: 117 },
  'evt-ireti-2': { invited: 60, coming: 31, replied: 38 },
  'evt-gala-4': { invited: 120, coming: 64, replied: 85 },
  'evt-party-2': { invited: 45, coming: 20, replied: 26 },
};

const COUNTED = new Set(['live', 'happening_now', 'paused']);

export function countsGuests(phase: string): boolean {
  return COUNTED.has(phase);
}

/** An event's row on Events (sc-3786): the figures the tiles add up, or none for an event they leave out. */
export function rowGuests(
  event: Omit<SampleEvent, 'photo'>,
  guests: Readonly<Record<string, Guests>>,
  now: Date,
): { coming: number; notReplied: number } | null {
  const one = guests[event.id];
  if (one == null || !countsGuests(eventPhase(event, now))) return null;
  return { coming: one.coming, notReplied: one.invited - one.replied };
}

/** A reply landing (sc-99): one guest who owed an answer says Coming, and every figure that counts it changes in place. */
export function withReply(
  guests: Readonly<Record<string, Guests>>,
  id: string,
): Readonly<Record<string, Guests>> {
  const one = guests[id];
  if (one == null || one.replied >= one.invited) return guests;

  return { ...guests, [id]: { ...one, coming: one.coming + 1, replied: one.replied + 1 } };
}

export type GuestsTile = 'invited' | 'replied';

/** sc-3786: Guests invited opens the events with invited guests, Replies in the events with guests who haven't replied. */
export function eventsOfTile<E extends Omit<SampleEvent, 'photo'>>(
  tile: GuestsTile,
  events: readonly E[],
  guests: Readonly<Record<string, Guests>>,
  now: Date,
): E[] {
  return events.filter((event) => {
    const row = rowGuests(event, guests, now);
    if (row == null) return false;

    return tile === 'invited' ? (guests[event.id]?.invited ?? 0) > 0 : row.notReplied > 0;
  });
}

/** sc-3786: the figures on an event's line are links into its Guests, with Coming or No reply chosen in the filter menu. */
export const FIGURE_OPENS = { coming: 'coming', notReplied: 'noreply' } as const;

/** sc-23284: over the organisation's Live, Happening now and Paused events; a finished or called-off one drops out. */
export function guestCountsOf(
  events: readonly Omit<SampleEvent, 'photo'>[],
  guests: Readonly<Record<string, Guests>>,
  now: Date,
): GuestCounts {
  const total = events
    .filter((event) => countsGuests(eventPhase(event, now)))
    .reduce(
      (sum, event) => {
        const one = guests[event.id];

        return one == null
          ? sum
          : {
              invited: sum.invited + one.invited,
              coming: sum.coming + one.coming,
              replied: sum.replied + one.replied,
            };
      },
      { invited: 0, coming: 0, replied: 0 },
    );

  return { ...total, notReplied: total.invited - total.replied };
}

/** A figure in the language's digits and grouping (CLDR), as "1,250" in English. */
export function figureOf(count: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale).format(count);
}

export const GUEST_WORDS = {
  invited: 'Guests invited',
  coming: (count: number, locale?: string) => `${figureOf(count, locale)} coming`,
  replied: 'Replies in',
  notReplied: (count: number, locale?: string) =>
    count === 1 ? '1 hasn’t replied' : `${figureOf(count, locale)} haven’t replied`,
  comingOpens: (event: string) => `opens the guests coming to ${event}`,
  notRepliedOpens: (event: string) => `opens the guests of ${event} with no reply`,
  tileOpens: {
    invited: 'shows the events with invited guests',
    replied: 'shows the events with guests who haven’t replied',
  },
  tileShown: {
    invited: (shown: number, total: number) => `Events with invited guests · ${shown} of ${total}`,
    replied: (shown: number, total: number) =>
      `Events with guests who haven’t replied · ${shown} of ${total}`,
  },
  clear: 'Clear',
} as const;
