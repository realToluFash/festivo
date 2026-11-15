import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BACK_ROW_HELD_MS, backRowHiding } from './backRow.ts';
import { TALKBACK_FOCUS_BACK_MS } from './focusBack.ts';

const TALKBACK_OWN_FOCUS_SOONEST_MS = 140;

describe('the header’s back row while a step hides it', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides at once', () => {
    const hidden: boolean[] = [];
    backRowHiding((value) => hidden.push(value)).hide(true);

    expect(hidden).toEqual([true]);
  });

  it('comes back only after the closing step’s focus has landed (sc-18587)', () => {
    const hidden: boolean[] = [];
    const row = backRowHiding((value) => hidden.push(value));
    row.hide(true);
    row.hide(false);

    vi.advanceTimersByTime(TALKBACK_OWN_FOCUS_SOONEST_MS);
    expect(hidden).toEqual([true]);

    vi.advanceTimersByTime(BACK_ROW_HELD_MS);
    expect(hidden).toEqual([true, false]);
  });

  it('is held past both the step’s focus and TalkBack’s own', () => {
    expect(BACK_ROW_HELD_MS).toBeGreaterThan(TALKBACK_FOCUS_BACK_MS);
    expect(BACK_ROW_HELD_MS).toBeGreaterThan(TALKBACK_OWN_FOCUS_SOONEST_MS);
  });

  it('stays hidden when hidden again before it comes back', () => {
    const hidden: boolean[] = [];
    const row = backRowHiding((value) => hidden.push(value));
    row.hide(true);
    row.hide(false);
    row.hide(true);

    vi.advanceTimersByTime(BACK_ROW_HELD_MS);
    expect(hidden).toEqual([true, true]);
  });

  it('does not come back once stopped', () => {
    const hidden: boolean[] = [];
    const row = backRowHiding((value) => hidden.push(value));
    row.hide(false);
    row.stop();

    vi.advanceTimersByTime(BACK_ROW_HELD_MS);
    expect(hidden).toEqual([]);
  });
});
