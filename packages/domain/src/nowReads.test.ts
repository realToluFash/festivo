import { ApiError, ApiUnreachableError } from '@soirely/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type NowShown, nowAsOfLine, nowReadOutcome, watchNowReads } from './nowReads.ts';

const refusal = (status: number) =>
  new ApiError({ type: 'https://soirely.app/errors/forbidden', title: 'No', status });

function watched(answers: (() => Promise<string>)[], every = 50_000) {
  const shows: NowShown<string>[] = [];
  const read = vi.fn(() => (answers.shift() ?? (() => new Promise<string>(() => {})))());
  const watch = watchNowReads({
    read,
    every,
    clock: () => new Date(),
    show: (shown) => shows.push(shown),
  });

  return { shows, watch, last: () => shows.at(-1) ?? { schedule: null, asOf: null } };
}

const lands = (schedule: string) => () => Promise.resolve(schedule);
const fails = () => Promise.reject(new ApiUnreachableError(new Error('down')));
const hangs = () => new Promise<string>(() => {});

describe('watchNowReads', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('counts a read with no answer after 10 seconds as failed', async () => {
    // Read again only by hand, so the read that hangs is the only one out.
    const { last, watch } = watched([lands('one'), hangs], 600_000);
    await vi.advanceTimersByTimeAsync(55_000);
    watch.readNow();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(last()).toEqual({ schedule: 'one', asOf: null });
    await vi.advanceTimersByTimeAsync(1);
    expect(last()).toEqual({ schedule: 'one', asOf: new Date('2026-11-05T15:00:00Z') });
    watch.stop();
  });

  it('shows no line while the last read that landed is 60 seconds old or less', async () => {
    const { last, watch } = watched([lands('one'), fails]);
    await vi.advanceTimersByTimeAsync(0);
    watch.readNow();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(last()).toEqual({ schedule: 'one', asOf: null });
    watch.stop();
  });

  it("shows the line with that read's time once it is more than 60 seconds old", async () => {
    const { last, watch } = watched([lands('one'), fails]);
    await vi.advanceTimersByTimeAsync(0);
    watch.readNow();
    await vi.advanceTimersByTimeAsync(60_001);
    expect(last()).toEqual({ schedule: 'one', asOf: new Date('2026-11-05T15:00:00Z') });
    watch.stop();
  });

  it('drops the line and shows what a read says once one lands', async () => {
    const { last, watch } = watched([lands('one'), fails, lands('two')]);
    await vi.advanceTimersByTimeAsync(50_000);
    await vi.advanceTimersByTimeAsync(11_000);
    expect(last().asOf).not.toBeNull();
    watch.readNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ schedule: 'two', asOf: null });
    watch.stop();
  });

  it.each([403, 404])('goes back to built Now with no line after a %i', async (status) => {
    const { last, watch } = watched([lands('one'), fails, () => Promise.reject(refusal(status))]);
    await vi.advanceTimersByTimeAsync(50_000);
    await vi.advanceTimersByTimeAsync(20_000);
    watch.readNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ schedule: null, asOf: null });
    watch.stop();
  });

  it('shows built Now with no line when the first read fails', async () => {
    const { shows, watch } = watched([fails, fails]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(shows).toEqual([]);
    watch.stop();
  });
});

describe('nowReadOutcome', () => {
  it('counts a server error as failed and a refusal as refused', () => {
    expect(nowReadOutcome(refusal(500))).toBe('failed');
    expect(nowReadOutcome(refusal(403))).toBe('refused');
    expect(nowReadOutcome(new TypeError('fetch'))).toBe('failed');
  });
});

describe('nowAsOfLine', () => {
  it("names the day once the read landed on an earlier day in the event's zone", () => {
    const at = new Date('2026-11-05T22:30:00Z');

    expect(nowAsOfLine(at, new Date('2026-11-05T22:50:00Z'), 'Europe/London', 'en-GB')).toEqual({
      key: 'offline.asOf',
      values: { time: '22:30' },
    });
    expect(nowAsOfLine(at, new Date('2026-11-05T23:10:00Z'), 'Europe/Berlin', 'en-GB')).toEqual({
      key: 'offline.asOfDay',
      values: { day: expect.stringContaining('Thursday') as string, time: '23:30' },
    });
  });
});
