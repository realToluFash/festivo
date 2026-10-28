import { describe, expect, it } from 'vitest';

import { focusBackMs, TALKBACK_FOCUS_BACK_MS } from './focusBack.ts';

describe('focus going back to a step’s opener', () => {
  it('lands on Android before TalkBack puts its own focus back', () => {
    expect(focusBackMs('android', 500)).toBe(TALKBACK_FOCUS_BACK_MS);
    expect(TALKBACK_FOCUS_BACK_MS).toBeLessThan(140);
  });

  it('waits on iOS for the scroll to land', () => {
    expect(focusBackMs('ios', 500)).toBe(500);
  });

  it('never waits on Android past the scroll', () => {
    expect(focusBackMs('android', 20)).toBe(20);
  });
});
