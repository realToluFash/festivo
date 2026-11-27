import {
  type Milestone,
  formatEventDate,
  levelOf,
  milestoneDistance,
  notThisYear,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export interface NeedRow {
  key: string;
  milestone: Milestone;
  due: string;
  late: boolean;
}

function dueWords(
  at: string,
  timeZone: string,
  now: Date,
  locale: string,
  t: TFunction,
): { due: string; late: boolean } {
  const distance = milestoneDistance(at, timeZone, now);

  switch (distance.kind) {
    case 'now':
      return { due: t('eventNeeds.overdue'), late: true };
    case 'daysAgo':
      return { due: t('eventNeeds.overdueDays', { count: distance.count }), late: true };
    case 'today':
      return { due: t('eventNeeds.dueToday'), late: false };
    case 'inDays':
      return {
        due:
          distance.count === 1
            ? t('eventNeeds.dueTomorrow')
            : t('eventNeeds.dueOn', {
                date: formatEventDate(at, timeZone, locale, notThisYear(timeZone, now, at)),
              }),
        late: false,
      };
  }
}

/** The event's You milestones the reader's role changes, earliest first and a tie by title: the rows Today lists for this event (sc-29884, sc-32801). */
export function needRows(
  milestones: readonly Milestone[],
  permissions: readonly string[],
  timeZone: string,
  now: Date,
  locale: string,
  t: TFunction,
): NeedRow[] {
  const byTitle = new Intl.Collator(locale);

  return milestones
    .filter(({ owner, area }) => owner === 'you' && levelOf(permissions, area) === 'change')
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byTitle.compare(a.title, b.title))
    .map((milestone) => ({
      key: `${milestone.area}|${milestone.at}|${milestone.title}`,
      milestone,
      ...dueWords(milestone.at, timeZone, now, locale, t),
    }));
}
