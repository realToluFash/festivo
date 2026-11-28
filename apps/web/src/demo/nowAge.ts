import { ApiError, ApiUnreachableError } from '@soirely/api-client';
import {
  nowAfterRead,
  nowAsOfLine,
  nowReadOutcome,
  type NowReadOutcome,
  type NowReads,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

/** The demo draws its own sample day, so a read that lands carries only when it landed; the rules are the product's, in @soirely/domain. */
export type Reads = NowReads<true>;

export const READ_EVERY_MS = 50_000;

export type Answer =
  | { kind: 'order' }
  | { kind: 'unreached' }
  | { kind: 'noAnswer' }
  | { kind: 'status'; status: number };

/** Sorted by the product's own rule, from what the answer would have thrown. A read with no answer has failed once it gives up. */
export function outcomeOf(answer: Answer): NowReadOutcome {
  switch (answer.kind) {
    case 'order':
      return 'landed';
    case 'noAnswer':
      return 'failed';
    case 'unreached':
      return nowReadOutcome(new ApiUnreachableError());
    case 'status':
      return nowReadOutcome(
        new ApiError({ type: 'about:blank', title: '', status: answer.status }),
      );
  }
}

export function afterRead(reads: Reads, outcome: NowReadOutcome, answeredAt: Date): Reads {
  return nowAfterRead(
    reads,
    outcome === 'landed' ? { outcome, schedule: true, at: answeredAt } : { outcome },
  );
}

export function landedAt(at: Date, failing = false): Reads {
  return { landed: { schedule: true, at }, failing, refused: false };
}

export function asOfWords(
  at: Date,
  now: Date,
  timeZone: string,
  locale: string,
  t: TFunction,
): string {
  const line = nowAsOfLine(at, now, timeZone, locale);

  return t(line.key, line.values);
}
