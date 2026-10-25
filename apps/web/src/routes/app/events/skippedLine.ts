import { skippedTime } from '@soirely/domain';
import { type TFunction } from 'i18next';

export function skippedLine(
  date: string,
  time: string,
  timeZone: string,
  locale: string,
  t: TFunction,
): string | null {
  const skipped = skippedTime(date, time, timeZone);

  if (skipped == null) return null;

  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });

  return t('eventForm.clocksSkip', {
    time: clock.format(new Date(`${date}T${time}Z`)),
    day: new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00Z`)),
    zone: timeZone,
    savedAs: clock.format(new Date(`${skipped.savedAs}Z`)),
  });
}
