import { type EventState, eventDayWords, formatEventClock } from '@soirely/domain';
import type { TFunction } from 'i18next';

/** "2 happening now · 3 upcoming · 1 draft", leaving out any part whose count is 0; null with nothing to count (sc-22103). */
export function summaryWords(
  counts: { happeningNow: number; upcoming: number; drafts: number },
  t: TFunction,
): string | null {
  const parts = [
    counts.happeningNow > 0 &&
      t('eventsScreen.summaryHappeningNow', { count: counts.happeningNow }),
    counts.upcoming > 0 && t('eventsScreen.summaryUpcoming', { count: counts.upcoming }),
    counts.drafts > 0 && t('eventsScreen.summaryDrafts', { count: counts.drafts }),
  ].filter((part): part is string => typeof part === 'string');

  return parts.length === 0
    ? null
    : parts.reduceRight((rest, first) => t('eventsScreen.summaryJoin', { first, rest }));
}

/** Its day, or its first and last day, with their year unless it is this one, then its start and zone, all in the event's own zone; a called-off event says when. */
export function eventDatesWords(
  event: {
    status: EventState;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    concludedAt: string | null;
  },
  now: Date,
  locale: string,
  t: TFunction,
): { days: string; time: string | null } {
  const days = eventDayWords(event, now, locale);

  switch (days.kind) {
    case 'calledOffOn':
      return { days: t('eventsScreen.calledOffOn', { date: days.date }), time: null };
    case 'oneDay':
    case 'days':
      return {
        days:
          days.kind === 'oneDay'
            ? days.day
            : t('eventsScreen.days', { first: days.first, last: days.last }),
        time: t('eventsScreen.timeAndZone', {
          time: formatEventClock(event.startsAt, event.timeZone, locale),
          timeZone: event.timeZone,
        }),
      };
  }
}
