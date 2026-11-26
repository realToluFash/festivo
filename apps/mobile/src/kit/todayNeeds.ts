import type { ListedEvent } from '@soirely/api-client';
import { type Milestone, levelOf, milestoneDistance, wallDay } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { Need, ShownEvent } from './today.ts';

type DayWords = (day: string, withYear: boolean) => string;

export interface YouEvent {
  shown: ShownEvent;
  startsAt: string;
  timeZone: string;
  permissions: readonly string[];
  milestones: readonly Milestone[];
}

/** The reader's own milestone, in an area their role changes on this event. */
export function isYours(
  { owner, area }: Pick<Milestone, 'owner' | 'area'>,
  permissions: readonly string[],
): boolean {
  return owner === 'you' && levelOf(permissions, area) === 'change';
}

export interface NeedKey {
  at: string;
  title: string;
  startsAt: string;
  name: string;
}

/** Earliest first; a tie goes by the event's start, then its name, then the milestone's title, in the reader's language. Today's Needs you and the Calendar's Only what needs you both order by it. */
export function needOrder(a: NeedKey, b: NeedKey): number {
  return (
    Date.parse(a.at) - Date.parse(b.at) ||
    Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
    a.name.localeCompare(b.name) ||
    a.title.localeCompare(b.title)
  );
}

/** A milestone's due words, in calendar days in the event's zone: "Due {{date}}" carries the year only when its day falls in another year than today (sc-29884). */
export function dueWords(
  at: string,
  timeZone: string,
  now: Date,
  day: DayWords,
  t: TFunction,
): { words: string; late: boolean } {
  const distance = milestoneDistance(at, timeZone, now);
  const dueDay = wallDay(at, timeZone);

  switch (distance.kind) {
    case 'now':
      return { words: t('todayScreen.overdue'), late: true };
    case 'daysAgo':
      return { words: t('todayScreen.overdueDays', { count: distance.count }), late: true };
    case 'today':
      return { words: t('todayScreen.dueToday'), late: false };
    case 'inDays':
      return {
        words:
          distance.count === 1
            ? t('todayScreen.dueTomorrow')
            : t('todayScreen.dueOn', {
                date: day(dueDay, dueDay.slice(0, 4) !== wallDay(now, timeZone).slice(0, 4)),
              }),
        late: false,
      };
  }
}

/** The You milestones the reader can act on, in needOrder. The app's Today and the demos draw them through this one function. */
export function needsOf(
  events: readonly YouEvent[],
  now: Date,
  day: DayWords,
  t: TFunction,
): Need[] {
  return events
    .flatMap((event) =>
      event.milestones
        .filter((milestone) => isYours(milestone, event.permissions))
        .map((milestone) => ({ event, milestone })),
    )
    .sort((a, b) =>
      needOrder(
        {
          at: a.milestone.at,
          title: a.milestone.title,
          startsAt: a.event.startsAt,
          name: a.event.shown.name,
        },
        {
          at: b.milestone.at,
          title: b.milestone.title,
          startsAt: b.event.startsAt,
          name: b.event.shown.name,
        },
      ),
    )
    .map(({ event, milestone }) => {
      const { words, late } = dueWords(milestone.at, event.timeZone, now, day, t);

      return { event: event.shown, title: milestone.title, due: words, late };
    });
}

/** The You milestones the reader can act on across their events, earliest first (sc-29884). */
export function needsToday(
  events: readonly ListedEvent[],
  shown: (event: ListedEvent) => ShownEvent,
  now: Date,
  day: DayWords,
  t: TFunction,
): Need[] {
  return needsOf(
    events.map((event) => ({
      shown: shown(event),
      startsAt: event.startsAt,
      timeZone: event.timeZone,
      permissions: event.permissions,
      milestones: event.milestones,
    })),
    now,
    day,
    t,
  );
}
