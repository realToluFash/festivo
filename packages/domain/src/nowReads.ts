import { ApiError } from '@soirely/api-client';

import { formatEventClock, formatEventWeekday } from './datetime.ts';

/** Past this, Now can no longer keep its promise that a press shows within a minute, and says how old it is (sc-62416). */
export const NOW_STALE_AFTER_MS = 60_000;

/** A read with no answer by then has failed, at that moment. */
export const NOW_READ_GIVES_UP_MS = 10_000;

export type NowReadOutcome = 'landed' | 'failed' | 'refused';

/** 403 is a role without run_of_show.read now, 404 an event gone: neither is a failure, and Now goes back to its built form. */
export function nowReadOutcome(error: unknown): Exclude<NowReadOutcome, 'landed'> {
  return error instanceof ApiError && (error.status === 403 || error.status === 404)
    ? 'refused'
    : 'failed';
}

export interface NowReads<S> {
  /** The last read that landed and when it was answered; null while none has landed since Today opened. */
  landed: { schedule: S; at: Date } | null;
  failing: boolean;
  refused: boolean;
}

export const NO_NOW_READS: NowReads<never> = { landed: null, failing: false, refused: false };

export function nowAfterRead<S>(
  reads: NowReads<S>,
  read: { outcome: 'landed'; schedule: S; at: Date } | { outcome: 'failed' | 'refused' },
): NowReads<S> {
  switch (read.outcome) {
    case 'landed':
      return { landed: { schedule: read.schedule, at: read.at }, failing: false, refused: false };
    case 'refused':
      return { ...reads, failing: false, refused: true };
    case 'failed':
      return { ...reads, failing: true };
  }
}

/** What Now shows: the run of show from the last read that landed, or null for today's built Now; with that read's time once it is past 60 seconds and a read has failed since. */
export interface NowShown<S> {
  schedule: S | null;
  asOf: Date | null;
}

export function nowShown<S>(reads: NowReads<S>, now: Date): NowShown<S> {
  if (reads.refused || reads.landed == null) return { schedule: null, asOf: null };

  const stale = reads.failing && now.getTime() - reads.landed.at.getTime() > NOW_STALE_AFTER_MS;

  return { schedule: reads.landed.schedule, asOf: stale ? reads.landed.at : null };
}

/** When the line is due, while a read has failed and the last that landed is not yet past 60 seconds old. */
export function nowLineDueAt(reads: NowReads<unknown>, now: Date): Date | null {
  if (reads.refused || reads.landed == null || !reads.failing) return null;

  const due = reads.landed.at.getTime() + NOW_STALE_AFTER_MS + 1;

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
export function nowAsOfLine(
  at: Date,
  now: Date,
  timeZone: string,
  locale: string,
):
  | { key: 'offline.asOf'; values: { time: string } }
  | { key: 'offline.asOfDay'; values: { day: string; time: string } } {
  const time = formatEventClock(at.toISOString(), timeZone, locale);

  return dayIn(at, timeZone) < dayIn(now, timeZone)
    ? {
        key: 'offline.asOfDay',
        values: { day: formatEventWeekday(at.toISOString(), timeZone, locale), time },
      }
    : { key: 'offline.asOf', values: { time } };
}

/** Today's reads of the running order: each read gives up after 10 s, and `show` hears what Now shows whenever that changes, the line included once it falls due. */
export function watchNowReads<S>({
  read,
  every,
  clock,
  show,
}: {
  read: () => Promise<S>;
  every: number;
  clock: () => Date;
  show: (shown: NowShown<S>) => void;
}): { readNow: () => void; stop: () => void } {
  let reads: NowReads<S> = NO_NOW_READS;
  let stopped = false;
  let due: ReturnType<typeof setTimeout> | null = null;
  let shown: NowShown<S> = { schedule: null, asOf: null };

  const tell = () => {
    const next = nowShown(reads, clock());
    if (next.schedule === shown.schedule && next.asOf === shown.asOf) return;
    shown = next;
    show(next);
  };

  const settle = (after: Parameters<typeof nowAfterRead<S>>[1]) => {
    if (stopped) return;
    reads = nowAfterRead(reads, after);
    if (due != null) clearTimeout(due);
    const at = nowLineDueAt(reads, clock());
    due =
      at == null
        ? null
        : setTimeout(() => {
            due = null;
            tell();
          }, at.getTime() - clock().getTime());
    tell();
  };

  const readNow = () => {
    let answered = false;
    const giveUp = setTimeout(() => {
      if (answered) return;
      answered = true;
      settle({ outcome: 'failed' });
    }, NOW_READ_GIVES_UP_MS);

    read().then(
      (schedule) => {
        clearTimeout(giveUp);
        if (answered) return;
        answered = true;
        settle({ outcome: 'landed', schedule, at: clock() });
      },
      (error: unknown) => {
        clearTimeout(giveUp);
        if (answered) return;
        answered = true;
        settle({ outcome: nowReadOutcome(error) });
      },
    );
  };

  readNow();
  const again = setInterval(readNow, every);

  return {
    readNow,
    stop: () => {
      stopped = true;
      clearInterval(again);
      if (due != null) clearTimeout(due);
    },
  };
}
