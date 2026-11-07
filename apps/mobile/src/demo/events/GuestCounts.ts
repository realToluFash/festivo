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
  'evt-wed-4': { invited: 180, coming: 142, replied: 160 },
  'evt-ireti-2': { invited: 60, coming: 31, replied: 38 },
  'evt-gala-4': { invited: 120, coming: 64, replied: 85 },
  'evt-party-2': { invited: 45, coming: 20, replied: 26 },
};

const COUNTED = new Set(['live', 'happening_now', 'paused']);

/** sc-23284: over the organisation's Live, Happening now and Paused events; a finished or called-off one drops out. */
export function guestCountsOf(
  events: readonly SampleEvent[],
  guests: Readonly<Record<string, Guests>>,
  now: Date,
): GuestCounts {
  const total = events
    .filter((event) => COUNTED.has(eventPhase(event, now)))
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
} as const;
