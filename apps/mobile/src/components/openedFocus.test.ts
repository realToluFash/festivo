import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { holdOpenedFocus } from './openedFocus.ts';

const SETTLED = 500;

describe('a field a sliding Android window opens with takes typing at once (sc-91027)', () => {
  const field = { name: 'opened' };
  const other = { name: 'other' };
  let holding: object | null;
  let present: object | null;
  let up: () => void;
  let down: () => void;
  const raise = vi.fn();
  const off = vi.fn();

  const hold = () =>
    holdOpenedFocus({
      field: () => present,
      holder: () => holding,
      raise,
      onKeys: (onUp, onDown) => {
        up = onUp;
        down = onDown;
        return off;
      },
      settledMs: SETTLED,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    holding = null;
    present = field;
    raise.mockClear();
    off.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('raises the keys on it as they rise, and once more when the window has settled', () => {
    hold();
    up();
    expect(raise).toHaveBeenCalledExactlyOnceWith(field);

    vi.advanceTimersByTime(SETTLED - 1);
    expect(raise).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(raise).toHaveBeenCalledTimes(2);
    expect(off).toHaveBeenCalledOnce();

    vi.runAllTimers();
    expect(raise).toHaveBeenCalledTimes(2);
  });

  it('raises them while it holds focus itself', () => {
    holding = field;
    hold();
    vi.advanceTimersByTime(SETTLED);
    expect(raise).toHaveBeenCalledExactlyOnceWith(field);
  });

  it('never takes focus from another field', () => {
    holding = other;
    hold();
    up();
    vi.advanceTimersByTime(SETTLED);
    expect(raise).not.toHaveBeenCalled();
  });

  it('stops once the keys are put down, so Back keeps them down', () => {
    holding = field;
    hold();
    down();
    expect(off).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(SETTLED);
    expect(raise).not.toHaveBeenCalled();
  });

  it('does nothing for a field already gone, or once stopped', () => {
    present = null;
    hold();
    vi.advanceTimersByTime(SETTLED);
    expect(raise).not.toHaveBeenCalled();

    present = field;
    const stop = hold();
    stop();
    vi.advanceTimersByTime(SETTLED);
    expect(raise).not.toHaveBeenCalled();
  });
});
