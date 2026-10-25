import { formatWallClock, formatWallDay, skippedTime } from '@soirely/domain';
import { type TFunction } from 'i18next';

import { dateLocale } from '../../../i18n/index.ts';

export function skippedLine(
  date: string,
  time: string,
  timeZone: string,
  t: TFunction,
): string | null {
  const skipped = skippedTime(date, time, timeZone);

  if (skipped == null) return null;

  const locale = dateLocale();
  const savedDate = skipped.savedAs.slice(0, 10);
  const words = {
    time: formatWallClock(time, locale),
    day: formatWallDay(date, locale),
    zone: timeZone,
    savedAs: formatWallClock(skipped.savedAs, locale),
  };

  return savedDate === date
    ? t('eventForm.clocksSkip', words)
    : t('eventForm.clocksSkipNextDay', {
        ...words,
        savedDay: formatWallDay(savedDate, locale),
      });
}
