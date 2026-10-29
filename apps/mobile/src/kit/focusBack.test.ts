import { describe, expect, it } from 'vitest';

import {
  focusBackMs,
  INPUT_FOCUS_TAKEN_MS,
  stepCloseSteps,
  TALKBACK_FOCUS_BACK_MS,
  TALKBACK_FOCUS_TAKEN_MS,
} from './focusBack.ts';

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
  it('on Android with TalkBack on, shows the opener, gives it input focus before the keys go down, focuses it, and only then takes the step away (sc-18588, sc-18587)', () => {
    expect(stepCloseSteps('android', true)).toEqual([
      { do: 'showOpener' },
      { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS },
      { do: 'putKeysDown' },
      { do: 'focusOpener', atMs: TALKBACK_FOCUS_BACK_MS, into: 'outOfSight' },
      { do: 'finish', focusBack: false, atMs: TALKBACK_FOCUS_BACK_MS + TALKBACK_FOCUS_TAKEN_MS },
    ]);
  });

  it('closes at once with no screen reader, which has no focus to lose', () => {
    expect(stepCloseSteps('android', false)).toEqual([{ do: 'finish', focusBack: true, atMs: 0 }]);
  });

  it('closes at once on iOS, where VoiceOver waits for the move it is asked for', () => {
    expect(stepCloseSteps('ios', true)).toEqual([{ do: 'finish', focusBack: true, atMs: 0 }]);
  });
});
