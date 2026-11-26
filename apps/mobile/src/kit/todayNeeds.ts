import type { ListedEvent } from '@soirely/api-client';
import { milestoneDistance, wallDay } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { isYours, needOrder } from '../demo/today/needsYou.ts';
import type { Need } from './today.ts';

type DayWords = (day: string, withYear: boolean) => string;

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

/** The You milestones the reader can act on across their events, earliest first (sc-29884). */
export function needsToday(
  events: readonly ListedEvent[],
  shown: (event: ListedEvent) => Need['event'],
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
          name: a.event.name,
        },
        {
          at: b.milestone.at,
          title: b.milestone.title,
          startsAt: b.event.startsAt,
          name: b.event.name,
        },
      ),
    )
    .map(({ event, milestone }) => {
      const { words, late } = dueWords(milestone.at, event.timeZone, now, day, t);

      return { event: shown(event), title: milestone.title, due: words, late, action: '' };
    });
}
