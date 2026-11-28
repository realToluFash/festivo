import { describe, expect, it } from 'vitest';

import { settlingAfter } from './uncovered.ts';

describe('settlingAfter', () => {
  it('starts when a cover ends on Android', () => {
    expect(settlingAfter(false, false, true, true)).toBe(true);
  });

  it('never starts on iOS, where nothing changes', () => {
    expect(settlingAfter(false, false, true, false)).toBe(false);
  });

  it('keeps going until the timer ends it', () => {
    expect(settlingAfter(true, false, false, true)).toBe(true);
  });

  it('is off while covered, and a new cover ends a running window', () => {
    expect(settlingAfter(false, true, false, true)).toBe(false);
    expect(settlingAfter(true, true, false, true)).toBe(false);
  });
});
