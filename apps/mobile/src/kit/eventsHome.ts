import {
  type EventPhase,
  calledOff,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
  milestoneDistance,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export const TABS = ['upcoming', 'drafts', 'past'] as const;

export type Tab = (typeof TABS)[number];

let chosen: { organisationId: string; tab: Tab } | null = null;

/** Kept while the person moves around the app and back; another organisation opens on Upcoming (sc-3594). */
export function rememberedTab(organisationId: string): Tab {
  return chosen?.organisationId === organisationId ? chosen.tab : 'upcoming';
}

export function rememberTab(organisationId: string, tab: Tab): void {
  chosen = { organisationId, tab };
}

export function forgetEventsTab(): void {
  chosen = null;
}

/** "Saturday, Nov 14 · in 32 days", "Today · started 09:00 Europe/Madrid" or "Called off on Sep 30". */
export function cardDate(
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
  if (phase === 'happening_now') {
    return t('eventsScreen.startedToday', {
      time: formatEventClock(event.startsAt, event.timeZone, locale),
      timeZone: event.timeZone,
    });
  }

  if (phase === 'finished' && calledOff(event) && event.concludedAt != null) {
    return t('eventsScreen.calledOffOn', {
      date: formatEventShortDay(event.concludedAt, event.timeZone, locale),
    });
  }

  return t('eventsScreen.dateAway', {
    date: formatEventWeekday(event.startsAt, event.timeZone, locale),
    distance: distanceWords(event.startsAt, event.timeZone, now, t),
  });
}

export function distanceWords(at: string, timeZone: string, now: Date, t: TFunction): string {
  const distance = milestoneDistance(at, timeZone, now);

  switch (distance.kind) {
    case 'now':
      return t('timeline.now');
    case 'today':
      return t('timeline.today');
    case 'inDays':
      return t('timeline.inDays', { count: distance.count });
    case 'daysAgo':
      return t('timeline.daysAgo', { count: distance.count });
  }
}
