import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Anchor } from '../components/Summary.tsx';
import { SETTLE_EVERY_MS, SETTLE_TRIES, hasSettled, openOnceSettled } from './menuSettles.ts';

const at = (x: number, y: number, width: number): Anchor => ({ x, y: y + 44, width, top: y });
const UNDER = at(280, 212, 96);
const NOT_LAID_OUT = at(0, 0, 0);

function button(...measures: (Anchor | null)[]) {
  let i = 0;
  return (then: (now: Anchor | null) => void) =>
    then(measures[Math.min(i++, measures.length - 1)]!);
}

describe('a demo state that opens its menu by itself', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('settles only on two agreeing measures of a laid-out button', () => {
    expect(hasSettled(NOT_LAID_OUT, NOT_LAID_OUT)).toBe(false);
    expect(hasSettled(null, UNDER)).toBe(false);
    expect(hasSettled(at(280, 412, 96), UNDER)).toBe(false);
    expect(hasSettled(UNDER, UNDER)).toBe(true);
  });

  it('waits while the button is not laid out or still sliding in, then opens under it', () => {
    const open = vi.fn();
    openOnceSettled(button(NOT_LAID_OUT, null, at(280, 412, 96), UNDER, UNDER), open, 700);
    vi.advanceTimersByTime(700 + 3 * SETTLE_EVERY_MS);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SETTLE_EVERY_MS);
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(UNDER);
  });

  it('opens on the last measure once the tries run out, if the button has a width', () => {
    const open = vi.fn();
    let y = 0;
    openOnceSettled((then) => then(at(280, (y += 10), 96)), open, 700);
    vi.advanceTimersByTime(700 + SETTLE_TRIES * SETTLE_EVERY_MS);
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(at(280, SETTLE_TRIES * 10, 96));
  });

  it('never opens on a button that was never laid out', () => {
    const open = vi.fn();
    openOnceSettled(button(NOT_LAID_OUT), open, 700);
    vi.advanceTimersByTime(700 + 2 * SETTLE_TRIES * SETTLE_EVERY_MS);
    expect(open).not.toHaveBeenCalled();
  });

  it('stops measuring once the screen is left', () => {
    const open = vi.fn();
    const measure = vi.fn(button(NOT_LAID_OUT, UNDER, UNDER));
    const leave = openOnceSettled(measure, open, 700);
    vi.advanceTimersByTime(700);
    leave();
    vi.advanceTimersByTime(SETTLE_TRIES * SETTLE_EVERY_MS);
    expect(measure).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });
});
