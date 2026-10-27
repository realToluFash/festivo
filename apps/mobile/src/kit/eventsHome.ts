import {
  type EventPhase,
  cardDate,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { distanceWords } from './distanceWords.ts';

export function cardDateWords(
  event: {
    status: 'draft' | 'live' | 'paused' | 'ended';
    startsAt: string;
    timeZone: string;
    concludedAt: string | null;
  },
  phase: EventPhase,
  now: Date,
  locale: string,
  t: TFunction,
): string {
  const date = cardDate(event, phase);

  switch (date.kind) {
    case 'startedToday':
      return t('eventsScreen.startedToday', {
        time: formatEventClock(date.startsAt, event.timeZone, locale),
        timeZone: event.timeZone,
      });
    case 'calledOffOn':
      return t('eventsScreen.calledOffOn', {
        date: formatEventShortDay(date.concludedAt, event.timeZone, locale),
      });
    case 'dateAway':
      return t('eventsScreen.dateAway', {
        date: formatEventWeekday(date.startsAt, event.timeZone, locale),
        distance: distanceWords(t, date.startsAt, event.timeZone, now),
      });
  }
}
