import { skippedTime } from '@soirely/domain';
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
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });

  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const savedDate = skipped.savedAs.slice(0, 10);
  const words = {
    time: clock.format(new Date(`${date}T${time}Z`)),
    day: day.format(new Date(`${date}T00:00Z`)),
    zone: timeZone,
    savedAs: clock.format(new Date(`${skipped.savedAs}Z`)),
  };

  return savedDate === date
    ? t('eventForm.clocksSkip', words)
    : t('eventForm.clocksSkipNextDay', {
        ...words,
        savedDay: day.format(new Date(`${savedDate}T00:00Z`)),
      });
}
