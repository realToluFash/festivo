import { wallDay } from '@soirely/domain';

const WEEKS_52 = 364 * 86_400_000;

/** Where Duplicate's Starts begins: 52 weeks after the original, so the copy falls on the same weekday, at the same time on the event's own clock. */
export function copyStart(event: { startsAt: string; timeZone: string }): {
  date: string;
  time: string;
} {
  const moment = new Date(Date.parse(event.startsAt) + WEEKS_52);

  return {
    date: wallDay(moment, event.timeZone),
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: event.timeZone,
    }).format(moment),
  };
}
