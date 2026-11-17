import { formatEventClock, formatEventWeekday } from '@soirely/domain';
import type { TFunction } from 'i18next';

export const STALE_AFTER_MS = 60_000;

/** A read with no answer by then has failed, at that moment. */
export const READ_GIVES_UP_MS = 10_000;

export const READ_EVERY_MS = 50_000;

export type Answer =
  | { kind: 'order' }
  | { kind: 'unreached' }
  | { kind: 'noAnswer' }
  | { kind: 'status'; status: number };

export type Outcome = 'landed' | 'failed' | 'refused';

/** 403 is a role without run_of_show.read now, 404 an event gone: neither is a failure, and Now goes back to its built form. */
export function outcomeOf(answer: Answer): Outcome {
  if (answer.kind === 'order') return 'landed';
  if (answer.kind === 'status' && (answer.status === 403 || answer.status === 404))
    return 'refused';

  return 'failed';
}

export interface Reads {
  /** When the last read that landed was answered; null while none has landed since Today opened. */
  landed: Date | null;
  failing: boolean;
  refused: boolean;
}

export const FIRST_READ: Reads = { landed: null, failing: false, refused: false };

export function afterRead(reads: Reads, outcome: Outcome, answeredAt: Date): Reads {
  if (outcome === 'landed') return { landed: answeredAt, failing: false, refused: false };
  if (outcome === 'refused') return { ...reads, failing: false, refused: true };

  return { ...reads, failing: true };
}

/** What Now shows: today's built Now, or the run of show, with the age of its last landed read once that is past 60 seconds and a read has failed since. */
export type NowShows = { kind: 'built' } | { kind: 'run'; asOf: Date | null };

export function nowShows(reads: Reads, now: Date): NowShows {
  if (reads.refused || reads.landed == null) return { kind: 'built' };

  const stale = reads.failing && now.getTime() - reads.landed.getTime() > STALE_AFTER_MS;

  return { kind: 'run', asOf: stale ? reads.landed : null };
}

export function lineDueAt(reads: Reads, now: Date): Date | null {
  if (reads.refused || reads.landed == null || !reads.failing) return null;

  const due = reads.landed.getTime() + STALE_AFTER_MS + 1;

  return due > now.getTime() ? new Date(due) : null;
}

const dayIn = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(at);

/** "Offline · as of 16:38", or with its day once that read landed on an earlier day; both in the event's zone, as every time in Now is. */
export function asOfWords(
  at: Date,
  now: Date,
  timeZone: string,
  locale: string,
  t: TFunction,
): string {
  const time = formatEventClock(at.toISOString(), timeZone, locale);

  return dayIn(at, timeZone) < dayIn(now, timeZone)
    ? t('offline.asOfDay', { day: formatEventWeekday(at.toISOString(), timeZone, locale), time })
    : t('offline.asOf', { time });
}
