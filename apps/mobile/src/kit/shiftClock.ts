import {
  ApiUnreachableError,
  type ClockAction,
  type ClockOutcome,
  type ShiftClockCard,
} from '@soirely/api-client';
import { wallDay, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { clockAt } from './myNight.ts';

export type ClockLine = 'alreadyIn' | 'alreadyOut' | 'offIn' | 'offOut' | null;

/** A time not today in the event's zone gives its weekday, never the date (#12988): "16:58" today, "Saturday 16:58" otherwise. */
export function timeWords(
  t: TFunction,
  at: string,
  now: Date,
  timeZone: string,
  locale: string,
): string {
  const day = wallOfZoned(at).slice(0, 10);
  const time = clockAt(at, locale);
  if (day === wallDay(now, timeZone)) return time;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00Z`),
  );

  return t('shiftClock.dayTime', { day: weekday, time });
}

/** "8 h 44 min", "8 h", "44 min". */
export function hoursWords(t: TFunction, minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = t('shiftClock.hours', { count: hours });
  const min = t('shiftClock.minutes', { count: rest });
  if (hours === 0 && rest > 0) return min;

  return rest === 0 ? h : t('shiftClock.hoursMinutes', { hoursPart: h, minutesPart: min });
}

/** What a tap on the card sends: Clock in while the window is open, Clock out while on; nothing otherwise. */
export function actionOf(clock: ShiftClockCard): ClockAction | null {
  if (clock.phase === 'ready') return 'in';

  return clock.phase === 'on' ? 'out' : null;
}

export type ClockAnswer =
  | { kind: 'shown'; clock: ShiftClockCard; line: ClockLine }
  | { kind: 'offline'; line: ClockLine }
  | { kind: 'reread' };

/** The server's answer to a tap: the card as recorded, with a line when nothing changed; no connection keeps the button as the retry; anything else, a 409 among them, reads the night again. */
export function answerOf(
  action: ClockAction,
  result: { outcome: ClockOutcome } | { error: unknown },
): ClockAnswer {
  if ('outcome' in result) {
    const already = result.outcome.outcome === 'already';

    return {
      kind: 'shown',
      clock: result.outcome.clock,
      line: already ? (action === 'in' ? 'alreadyIn' : 'alreadyOut') : null,
    };
  }
  if (result.error instanceof ApiUnreachableError)
    return { kind: 'offline', line: action === 'in' ? 'offIn' : 'offOut' };

  return { kind: 'reread' };
}

/** A recorded tap's words for a screen reader: the line the card now heads with. */
export function recordedWords(
  t: TFunction,
  clock: ShiftClockCard,
  now: Date,
  timeZone: string,
  locale: string,
): string | null {
  const at = (time: string) => timeWords(t, time, now, timeZone, locale);
  if (clock.phase === 'on' && clock.clockedInAt != null)
    return t('shiftClock.clockedInAt', { time: at(clock.clockedInAt) });
  if (clock.phase === 'off' && clock.clockedOutAt != null)
    return t('shiftClock.clockedOutAt', { time: at(clock.clockedOutAt) });

  return null;
}

/** The line under the card's status, each {time} by the weekday rule. */
export function lineWords(
  t: TFunction,
  line: ClockLine,
  clock: ShiftClockCard,
  now: Date,
  timeZone: string,
  locale: string,
): string | null {
  const at = (time: string | null) =>
    time == null ? '' : timeWords(t, time, now, timeZone, locale);
  if (line === 'alreadyIn') return t('shiftClock.alreadyIn', { time: at(clock.clockedInAt) });
  if (line === 'alreadyOut') return t('shiftClock.alreadyOut', { time: at(clock.clockedOutAt) });
  if (line === 'offIn') return t('shiftClock.offIn');

  return line === 'offOut' ? t('shiftClock.offOut') : null;
}
