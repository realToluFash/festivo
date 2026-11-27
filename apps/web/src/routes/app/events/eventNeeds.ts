import { type EventState, type Milestone, formatEventDate, isNeed } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { dueWords } from '../todayNeeds.ts';

export interface NeedRow {
  key: string;
  milestone: Milestone;
  due: string;
  late: boolean;
}

function due(at: string, timeZone: string, now: Date, locale: string, t: TFunction) {
  const { words, late } = dueWords(
    at,
    timeZone,
    now,
    (_day, withYear) => formatEventDate(at, timeZone, locale, withYear),
    t,
  );

  return { due: words, late };
}

/** The event's You milestones the reader's role changes, earliest first and a tie by title: the rows Today lists for this event (sc-29884, sc-32801). */
export function needRows(
  milestones: readonly Milestone[],
  event: { permissions: readonly string[]; status: EventState; startsAt: string; endsAt: string },
  timeZone: string,
  now: Date,
  locale: string,
  t: TFunction,
): NeedRow[] {
  const byTitle = new Intl.Collator(locale);

  return milestones
    .filter((milestone) => isNeed(milestone, event, now))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byTitle.compare(a.title, b.title))
    .map((milestone) => ({
      key: `${milestone.area}|${milestone.at}|${milestone.title}`,
      milestone,
      ...due(milestone.at, timeZone, now, locale, t),
    }));
}
