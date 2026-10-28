import { describe, expect, it } from 'vitest';

import { focusBackMs, TALKBACK_FOCUS_BACK_MS } from './focusBack.ts';

const TALKBACK_OWN_FOCUS_SOONEST_MS = 140;

describe('focus going back to a step’s opener', () => {
  it('lands on Android before TalkBack puts its own focus back, 0.14 s at the soonest qa2 measured (sc-17281)', () => {
    expect(focusBackMs('android', 500, 'step')).toBe(TALKBACK_FOCUS_BACK_MS);
    expect(TALKBACK_FOCUS_BACK_MS).toBeLessThan(TALKBACK_OWN_FOCUS_SOONEST_MS);
  });

  it('waits on iOS for the scroll to land', () => {
    expect(focusBackMs('ios', 500, 'step')).toBe(500);
  });

  it('waits on Android for a returning page’s rows to settle, which TalkBack drops a hover on until it has them (sc-9950)', () => {
    expect(focusBackMs('android', 500, 'page')).toBe(500);
  });

  it('never waits on Android past the scroll', () => {
    expect(focusBackMs('android', 20, 'step')).toBe(20);
  });
});
