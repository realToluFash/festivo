import { milestoneDistance } from '@soirely/domain';
import { type TFunction } from 'i18next';

/** "in 32 days", counted in calendar dates in the event's zone, where its date is read. */
export function distanceWords(t: TFunction, at: string, timeZone: string, now: Date): string {
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
