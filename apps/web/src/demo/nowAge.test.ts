import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  afterRead,
  asOfWords,
  FIRST_READ,
  lineDueAt,
  nowShows,
  outcomeOf,
  type Reads,
} from './nowAge.ts';

const t = i18next.t.bind(i18next);
const ZONE = 'Africa/Lagos';
const at = (iso: string) => new Date(iso);
const LANDED = at('2026-11-07T15:38:00Z');
const landed: Reads = afterRead(FIRST_READ, 'landed', LANDED);
const plus = (seconds: number) => new Date(LANDED.getTime() + seconds * 1000);

describe('a read', () => {
  it('lands only with a running order', () => {
    expect(outcomeOf({ kind: 'order' })).toBe('landed');
  });

  it('fails when it does not reach Soirely, has no answer in 10 seconds, or meets an error', () => {
    expect(outcomeOf({ kind: 'unreached' })).toBe('failed');
    expect(outcomeOf({ kind: 'noAnswer' })).toBe('failed');
    expect(outcomeOf({ kind: 'status', status: 500 })).toBe('failed');
    expect(outcomeOf({ kind: 'status', status: 401 })).toBe('failed');
  });

  it('is refused, not failed, on 403 and 404', () => {
    expect(outcomeOf({ kind: 'status', status: 403 })).toBe('refused');
    expect(outcomeOf({ kind: 'status', status: 404 })).toBe('refused');
  });
});

describe("Now's line", () => {
  it('is not there while the last read that landed is 60 seconds old or less', () => {
    const failed = afterRead(landed, 'failed', plus(50));

    expect(nowShows(failed, plus(60))).toEqual({ kind: 'run', asOf: null });
  });

  it('shows once that read is more than 60 seconds old, with its time', () => {
    const failed = afterRead(landed, 'failed', plus(50));

    expect(nowShows(failed, plus(61))).toEqual({ kind: 'run', asOf: LANDED });
  });

  it('counts a read with no answer as failed 10 seconds after it was made', () => {
    const failed = afterRead(landed, outcomeOf({ kind: 'noAnswer' }), plus(60));

    expect(nowShows(failed, plus(60.001))).toEqual({ kind: 'run', asOf: LANDED });
  });

  it('is due 60 seconds after the last landed read at the latest, and never before a read fails', () => {
    const failed = afterRead(landed, 'failed', plus(1));

    expect(lineDueAt(landed, plus(1))).toBeNull();
    expect(lineDueAt(failed, plus(1))?.getTime()).toBe(plus(60).getTime() + 1);
    expect(lineDueAt(failed, plus(61))).toBeNull();
  });

  it('goes when a read lands, and Now shows that read', () => {
    const failed = afterRead(landed, 'failed', plus(50));
    const back = afterRead(failed, 'landed', plus(100));

    expect(nowShows(back, plus(101))).toEqual({ kind: 'run', asOf: null });
  });

  it('is never there on a refused read: Now is built', () => {
    const refused = afterRead(landed, outcomeOf({ kind: 'status', status: 403 }), plus(50));

    expect(nowShows(refused, plus(200))).toEqual({ kind: 'built' });
  });

  it('is never there when the first read fails: Now is built', () => {
    const failed = afterRead(FIRST_READ, 'failed', plus(0));

    expect(nowShows(failed, plus(200))).toEqual({ kind: 'built' });
  });
});

describe("the line's words", () => {
  it("say the read's time in the event's zone", () => {
    expect(asOfWords(LANDED, plus(120), ZONE, 'en-GB', t)).toBe('Offline · as of 16:38');
  });

  it('say its day once it landed on an earlier day there', () => {
    const late = at('2026-11-06T22:58:00Z');

    expect(asOfWords(late, at('2026-11-07T00:10:00Z'), ZONE, 'en-GB', t)).toBe(
      'Offline · as of Friday 6 Nov at 23:58',
    );
  });

  it('keep the time alone when the day is the same in the event zone, whatever it is in UTC', () => {
    expect(
      asOfWords(at('2026-11-06T23:30:00Z'), at('2026-11-07T00:10:00Z'), ZONE, 'en-GB', t),
    ).toBe('Offline · as of 00:30');
  });
});
