import { describe, expect, it } from 'vitest';

import { focusBackMs, stepCloseWay, TALKBACK_FOCUS_BACK_MS } from './focusBack.ts';

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

describe('a step closing back to its opener', () => {
  it('closes in order on Android with TalkBack on, so its focus never rests on a view that has gone (sc-18588)', () => {
    expect(stepCloseWay('android', true)).toBe('inOrder');
  });

  it('closes at once with no screen reader, which has no focus to lose', () => {
    expect(stepCloseWay('android', false)).toBe('atOnce');
  });

  it('closes at once on iOS, where VoiceOver waits for the move it is asked for', () => {
    expect(stepCloseWay('ios', true)).toBe('atOnce');
  });
});
