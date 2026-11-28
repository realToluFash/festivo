import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { savedRowFocus, toastOverPage } from './savedRowFocus.ts';

const SETTLED = 500;
const LATEST = 1500;

function focusAfterSave() {
  const move = vi.fn();
  const bringIntoSight = vi.fn<(rested: () => void) => void>();
  const timing = savedRowFocus({ settledMs: SETTLED, latestMs: LATEST, move, bringIntoSight });

  return { move, bringIntoSight, timing };
}

describe('when focus goes back to the row a Save closed onto (sc-86228)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits SETTLED_MS from the toast’s layout, not from the Save', () => {
    const { move, timing } = focusAfterSave();
    timing.rested();
    vi.advanceTimersByTime(400);
    timing.toastLaidOut();

    vi.advanceTimersByTime(SETTLED - 1);
    expect(move).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(move).toHaveBeenCalledTimes(1);
  });

  it('waits for the page to come to rest after the edit has gone', () => {
    const { move, timing } = focusAfterSave();
    timing.toastLaidOut();
    vi.advanceTimersByTime(SETTLED + 200);
    expect(move).not.toHaveBeenCalled();

    timing.rested();
    expect(move).toHaveBeenCalledTimes(1);
  });

  it('counts from the first layout only, as the toast is laid out again', () => {
    const { move, timing } = focusAfterSave();
    timing.rested();
    timing.toastLaidOut();
    vi.advanceTimersByTime(SETTLED - 100);
    timing.toastLaidOut();
    vi.advanceTimersByTime(100);

    expect(move).toHaveBeenCalledTimes(1);
  });

  it('brings the row into sight at the deadline when no toast was laid out, and focus goes from that landing', () => {
    const { move, bringIntoSight } = focusAfterSave();
    vi.advanceTimersByTime(LATEST - 1);
    expect(bringIntoSight).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(bringIntoSight).toHaveBeenCalledTimes(1);
    expect(move).not.toHaveBeenCalled();

    bringIntoSight.mock.calls[0]?.[0]();
    expect(move).toHaveBeenCalledTimes(1);
  });

  it('goes at the deadline at once when the page had already come to rest', () => {
    const { move, bringIntoSight, timing } = focusAfterSave();
    timing.rested();
    vi.advanceTimersByTime(LATEST);

    expect(move).toHaveBeenCalledTimes(1);
    expect(bringIntoSight).not.toHaveBeenCalled();
  });

  it('moves focus once, and not at all once stopped by the next close', () => {
    const first = focusAfterSave();
    first.timing.rested();
    first.timing.toastLaidOut();
    vi.advanceTimersByTime(LATEST * 2);
    first.timing.rested();
    expect(first.move).toHaveBeenCalledTimes(1);

    const second = focusAfterSave();
    second.timing.toastLaidOut();
    second.timing.stop();
    second.timing.rested();
    vi.advanceTimersByTime(LATEST * 2);
    expect(second.move).not.toHaveBeenCalled();
    expect(second.bringIntoSight).not.toHaveBeenCalled();
  });
});

describe('the toast as the page reads it (sc-86228)', () => {
  const first = { name: 'cover' };
  const second = { name: 'type' };

  it('says the Save once its own box has been laid out', () => {
    expect(
      toastOverPage(
        { words: 'Saved', id: 'saved-1', over: first },
        { words: 'Saved', id: 'saved-1', top: 700 },
      ),
    ).toEqual({ top: 700, over: first });
  });

  it('keeps the second Save, with the same words, from the first toast’s layout until its own is laid out', () => {
    const shown = { words: 'Saved', id: 'saved-2', over: second };

    expect(toastOverPage(shown, { words: 'Saved', id: 'saved-1', top: 700 })).toEqual({
      top: 700,
      over: null,
    });
    expect(toastOverPage(shown, { words: 'Saved', id: 'saved-2', top: 690 })).toEqual({
      top: 690,
      over: second,
    });
  });

  it('reads no toast while other words show, and none at all before a layout', () => {
    expect(
      toastOverPage({ words: 'Saved', id: 'saved-1' }, { words: 'Link copied', top: 700 }),
    ).toBeNull();
    expect(toastOverPage({ words: 'Saved', id: 'saved-1' }, null)).toBeNull();
    expect(toastOverPage(null, { words: 'Saved', top: 700 })).toBeNull();
  });

  it('reads a toast that says no Save, as before', () => {
    expect(toastOverPage({ words: 'Link copied' }, { words: 'Link copied', top: 700 })).toEqual({
      top: 700,
      over: null,
    });
  });
});
