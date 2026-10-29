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
  const SETTLED_MS = 500;

  it('on Android with TalkBack on, shows a control, gives it input focus before the keys go down, settles it without a second move of TalkBack’s focus, and only then takes the step away (sc-18588, sc-18587)', () => {
    expect(stepCloseSteps('android', true, 'control', SETTLED_MS)).toEqual([
      { do: 'showOpener' },
      { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to: 'opener' },
      { do: 'putKeysDown' },
      { do: 'settleOpener', into: 'outOfSight', read: false },
      { do: 'finish', focusBack: false, atMs: TALKBACK_FOCUS_TAKEN_MS },
    ]);
  });

  it('on Android with TalkBack on, gives a line’s input focus to a holder TalkBack does not read, and moves TalkBack’s focus to the line once the keys are down and the scroll has landed, before the step goes (sc-18587)', () => {
    expect(stepCloseSteps('android', true, 'line', SETTLED_MS)).toEqual([
      { do: 'showOpener' },
      { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to: 'holder' },
      { do: 'putKeysDown' },
      { do: 'settleOpener', into: 'outOfSight', read: true },
      { do: 'finish', focusBack: false, atMs: SETTLED_MS + TALKBACK_FOCUS_TAKEN_MS },
    ]);
  });

  it('closes at once with no screen reader, which has no focus to lose', () => {
    expect(stepCloseSteps('android', false, 'line', SETTLED_MS)).toEqual([
      { do: 'finish', focusBack: true, atMs: 0 },
    ]);
  });

  it('closes at once on iOS, where VoiceOver waits for the move it is asked for', () => {
    expect(stepCloseSteps('ios', true, 'control', SETTLED_MS)).toEqual([
      { do: 'finish', focusBack: true, atMs: 0 },
    ]);
  });
});
