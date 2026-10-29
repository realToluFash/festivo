import { describe, expect, it } from 'vitest';

import {
  fieldToBlur,
  focusBackMs,
  holdEnds,
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

  it('on Android with TalkBack on, holds the scroll where it is, gives input focus to a holder TalkBack does not read before the keys go down, and moves TalkBack’s focus to the opener once their scroll has landed, before the step goes (sc-18588, sc-18587)', () => {
    expect(stepCloseSteps('android', true, SETTLED_MS)).toEqual([
      { do: 'holdScroll' },
      { do: 'showOpener' },
      { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to: 'holder' },
      { do: 'putKeysDown' },
      { do: 'settleOpener', into: 'outOfSight' },
      { do: 'finish', focusBack: false, atMs: SETTLED_MS + TALKBACK_FOCUS_TAKEN_MS },
    ]);
  });

  it('closes at once with no screen reader, which has no focus to lose', () => {
    expect(stepCloseSteps('android', false, SETTLED_MS)).toEqual([
      { do: 'finish', focusBack: true, atMs: 0 },
    ]);
  });

  it('closes at once on iOS, where VoiceOver waits for the move it is asked for', () => {
    expect(stepCloseSteps('ios', true, SETTLED_MS)).toEqual([
      { do: 'finish', focusBack: true, atMs: 0 },
    ]);
  });
});

describe('the field a closing step blurs to put the keys down', () => {
  it('is the one holding input focus', () => {
    expect(fieldToBlur('new password', 'current password')).toBe('new password');
  });

  it('is the one that raised the keys once it has given input focus up, which leaves them up (sc-18588)', () => {
    expect(fieldToBlur(null, 'current password')).toBe('current password');
  });

  it('is none when no field raised the keys', () => {
    expect(fieldToBlur(null, null)).toBeNull();
  });
});

describe('a scroll hold letting go', () => {
  const VIEW = 600;

  it('waits while the view’s end is past the content’s real end, where letting go would clamp the scroll (sc-18587)', () => {
    expect(holdEnds(500, VIEW, 1000)).toBe(false);
  });

  it('lets go once the view’s end is back inside the content’s real end', () => {
    expect(holdEnds(400, VIEW, 1000)).toBe(true);
  });

  it('lets go on content shorter than the view once the scroll is back at the top', () => {
    expect(holdEnds(0, VIEW, 300)).toBe(true);
    expect(holdEnds(50, VIEW, 300)).toBe(false);
  });
});
