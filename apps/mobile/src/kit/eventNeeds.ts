import { type Milestone } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { dueWords, isYours } from './todayNeeds.ts';

export interface EventNeed {
  key: string;
  title: string;
  due: string;
  late: boolean;
}

type DayWords = (day: string, withYear: boolean) => string;

/** This event's You milestones the reader can act on, earliest first and a tie by title in the shown language: Today's rows for one event, naming none (sc-32801). */
export function eventNeeds(
  milestones: readonly Milestone[],
  permissions: readonly string[],
  timeZone: string,
  now: Date,
  locale: string,
  day: DayWords,
  t: TFunction,
): EventNeed[] {
  const byTitle = new Intl.Collator(locale);

  return milestones
    .filter((milestone) => isYours(milestone, permissions))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byTitle.compare(a.title, b.title))
    .map((milestone) => ({
      key: `${milestone.area}|${milestone.at}|${milestone.title}`,
      title: milestone.title,
      ...(({ words, late }) => ({ due: words, late }))(
        dueWords(milestone.at, timeZone, now, day, t),
      ),
    }));
}
