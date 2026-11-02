import {
  type EventState,
  type NextStep,
  eventDays,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { LayoutKind } from '../layout/classify.ts';

export const EVENT_CARD_GAP: Record<LayoutKind, number> = {
  phone: 10,
  tabletPortrait: 14,
  tabletLandscape: 14,
};

/** A card on Events is a column wide and never grows, so one left alone in a row stays that wide (sc-22103). Upright keeps three to a row where 250 would not fit. */
export function eventCardWidth(kind: LayoutKind, room: number): number {
  const fitted = (columns: number) =>
    Math.floor((room - EVENT_CARD_GAP[kind] * (columns - 1)) / columns);

  return kind === 'phone' ? fitted(2) : kind === 'tabletPortrait' ? Math.min(250, fitted(3)) : 288;
}

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
