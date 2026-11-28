import type { ListedEvent } from '@soirely/api-client';
import { type EventState, type Milestone, isNeed, needDue, needOrder } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { Need, ShownEvent } from '../../components/today.ts';

type DayWords = (day: string, withYear: boolean) => string;

export interface YouEvent {
  shown: ShownEvent;
  startsAt: string;
  endsAt: string;
  status: EventState;
  timeZone: string;
  permissions: readonly string[];
  milestones: readonly Milestone[];
}

/** A milestone's due words, in the reader's language, from the due the domain classifies (sc-29884). */
export function dueWords(
  at: string,
  timeZone: string,
  now: Date,
  day: DayWords,
  t: TFunction,
): { words: string; late: boolean } {
  const due = needDue(at, timeZone, now);

  switch (due.kind) {
    case 'overdue':
      return { words: t('today.overdue'), late: true };
    case 'overdueDays':
      return { words: t('today.overdueDays', { count: due.count }), late: true };
    case 'dueToday':
      return { words: t('today.dueToday'), late: false };
    case 'dueTomorrow':
      return { words: t('today.dueTomorrow'), late: false };
    case 'dueOn':
      return { words: t('today.dueOn', { date: day(due.day, due.withYear) }), late: false };
  }
}

/** The You milestones the reader can act on, in needOrder. The web's Today draws them through this one function, as the app's does (sc-61015). */
export function needsOf(
  events: readonly YouEvent[],
  now: Date,
  day: DayWords,
  t: TFunction,
): Need[] {
  return events
    .flatMap((event) =>
      event.milestones
        .filter((milestone) => isNeed(milestone, event, now))
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

      return {
        key: `${event.shown.id}|${milestone.area}|${milestone.at}|${milestone.title}`,
        event: event.shown,
        title: milestone.title,
        due: words,
        late,
        action: milestone.action,
      };
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
      endsAt: event.endsAt,
      status: event.status,
      timeZone: event.timeZone,
      permissions: event.permissions,
      milestones: event.milestones,
    })),
    now,
    day,
    t,
  );
}
