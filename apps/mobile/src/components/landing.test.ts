import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LANDING_MS, endLandingSoon, landingAfter } from './landing.ts';

describe('landingAfter', () => {
  it('names the picker a list has just closed on, on Android', () => {
    expect(landingAfter(null, null, 'zone', true)).toBe('zone');
  });

  it('never starts on iOS, where nothing changes', () => {
    expect(landingAfter(null, null, 'zone', false)).toBeNull();
  });

  it('keeps the picker until the timer ends it', () => {
    expect(landingAfter('type', null, null, true)).toBe('type');
  });

  it('ends when another list opens, so the next close names its own picker only', () => {
    expect(landingAfter('type', 'currency', null, true)).toBeNull();
    expect(landingAfter(null, null, 'currency', true)).toBe('currency');
  });
});

describe('endLandingSoon', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('always ends the window: the header and the fields come back', () => {
    const end = vi.fn();
    endLandingSoon(end);
    vi.advanceTimersByTime(LANDING_MS - 1);
    expect(end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('does not end a window that was already given up, as when a second close restarts it', () => {
    const end = vi.fn();
    const giveUp = endLandingSoon(end);
    giveUp();
    vi.advanceTimersByTime(LANDING_MS * 2);
    expect(end).not.toHaveBeenCalled();
  });
});
