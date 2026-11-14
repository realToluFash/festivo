import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HELD_AGAIN_MS, holdFocus } from './heldFocus.ts';

describe('holding TalkBack on a refused picker (sc-43907)', () => {
  const move = vi.fn();
  const ended = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    move.mockClear();
    ended.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves at once and again after each gap, then ends', () => {
    const { hold } = holdFocus(move, ended);
    hold();
    expect(move).toHaveBeenCalledTimes(1);

    for (const [index, gap] of HELD_AGAIN_MS.entries()) {
      vi.advanceTimersByTime(gap - 1);
      expect(move).toHaveBeenCalledTimes(index + 1);
      vi.advanceTimersByTime(1);
      expect(move).toHaveBeenCalledTimes(index + 2);
    }
    expect(ended).toHaveBeenCalledOnce();

    vi.runAllTimers();
    expect(move).toHaveBeenCalledTimes(HELD_AGAIN_MS.length + 1);
  });

  it('runs one chain when the settle timer and the scroll landing both call it', () => {
    const { hold } = holdFocus(move, ended);
    hold();
    vi.advanceTimersByTime(100);
    hold();
    vi.runAllTimers();

    expect(move).toHaveBeenCalledTimes(HELD_AGAIN_MS.length + 1);
    expect(ended).toHaveBeenCalledOnce();
  });

  it('moves no more once stopped part way, as a field focused meanwhile stops it', () => {
    const { hold, stop } = holdFocus(move, ended);
    hold();
    vi.advanceTimersByTime(HELD_AGAIN_MS[0]!);
    stop();
    vi.runAllTimers();

    expect(move).toHaveBeenCalledTimes(2);
    expect(ended).not.toHaveBeenCalled();
  });

  it('never moves when stopped before it holds', () => {
    const { hold, stop } = holdFocus(move, ended);
    stop();
    hold();
    vi.runAllTimers();

    expect(move).not.toHaveBeenCalled();
  });
});
