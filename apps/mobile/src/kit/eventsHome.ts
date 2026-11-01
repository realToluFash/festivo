import {
  type EventState,
  type NextStep,
  eventDays,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
} from '@soirely/domain';
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

/** Its day, or its first and last day, then its start and zone, all in the event's own zone; a called-off event says when. */
export function eventDatesWords(
  event: {
    status: EventState;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    concludedAt: string | null;
  },
  locale: string,
  t: TFunction,
): { days: string; time: string | null } {
  const days = eventDays(event);

  if (days.kind === 'calledOffOn') {
    return {
      days: t('eventsScreen.calledOffOn', {
        date: formatEventShortDay(days.concludedAt, event.timeZone, locale),
      }),
      time: null,
    };
  }

  const first = formatEventWeekday(days.startsAt, event.timeZone, locale);

  return {
    days:
      days.kind === 'oneDay'
        ? first
        : t('eventsScreen.days', {
            first,
            last: formatEventWeekday(days.endsAt, event.timeZone, locale),
          }),
    time: t('eventsScreen.timeAndZone', {
      time: formatEventClock(event.startsAt, event.timeZone, locale),
      timeZone: event.timeZone,
    }),
  };
}

/** A card's last line: what its phase asks for next, else its next milestone. */
export function nextStepWords(step: NextStep | null, t: TFunction): string | null {
  switch (step?.kind) {
    case undefined:
      return null;
    case 'makeLive':
      return t('eventsScreen.nextMakeLive');
    case 'changeDates':
      return t('eventsScreen.nextChangeDates');
    case 'resume':
      return t('eventsScreen.nextResume');
    case 'nextUp':
      return t('eventsScreen.nextUp', { title: step.milestone.title });
  }
}
