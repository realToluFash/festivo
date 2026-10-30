import { describe, expect, it } from 'vitest';

import {
  fieldToBlur,
  focusBackMs,
  holdEnds,
  INPUT_FOCUS_TAKEN_MS,
  scrollAsked,
  stepCloseSteps,
  stepOpensInOrder,
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
  it('on Android with TalkBack on, holds the scroll where it is and gives a control opener input focus, which TalkBack says once, with nothing moving its focus there again, before the keys go down and the step goes (sc-18588)', () => {
    expect(stepCloseSteps('android', true, 'opener')).toEqual([
      { do: 'holdScroll' },
      { do: 'showOpener' },
      { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to: 'opener' },
      { do: 'putKeysDown' },
      { do: 'settleOpener', into: 'outOfSight', read: false },
      { do: 'finish', focusBack: false, atMs: TALKBACK_FOCUS_TAKEN_MS },
    ]);
  });

  it('on Android with TalkBack on, gives input focus to a holder TalkBack does not read beside a line of words, and moves TalkBack’s focus to the line once the keys’ scroll has landed, before the step goes (sc-18587)', () => {
    expect(stepCloseSteps('android', true, 'holder')).toEqual([
      { do: 'holdScroll' },
      { do: 'showOpener' },
      { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to: 'holder' },
      { do: 'putKeysDown' },
      { do: 'settleOpener', into: 'outOfSight', read: true },
      { do: 'finish', focusBack: false, atMs: TALKBACK_FOCUS_TAKEN_MS },
    ]);
  });

  it('closes at once with no screen reader, which has no focus to lose', () => {
    expect(stepCloseSteps('android', false, 'opener')).toEqual([
      { do: 'finish', focusBack: true, atMs: 0 },
    ]);
  });

  it('closes at once on iOS, where VoiceOver waits for the move it is asked for', () => {
    expect(stepCloseSteps('ios', true, 'opener')).toEqual([
      { do: 'finish', focusBack: true, atMs: 0 },
    ]);
  });
});

describe('the field a closing step blurs to put the keys down', () => {
  it('is the one holding input focus', () => {
    expect(fieldToBlur('new password', 'current password', 'current password')).toBe(
      'new password',
    );
  });

  it("is one of the step's own when JS knows of no field holding input focus, so the hide reaches the keys (sc-18588)", () => {
    expect(fieldToBlur(null, 'current password', null)).toBe('current password');
    expect(fieldToBlur(null, 'current password', 'time zone')).toBe('current password');
  });

  it('is the one that raised the keys once it has given input focus up, in a step with no field of its own', () => {
    expect(fieldToBlur(null, null, 'time zone')).toBe('time zone');
  });

  it('is none when no field raised the keys', () => {
    expect(fieldToBlur(null, null, null)).toBeNull();
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

describe('a scroll a close asks for itself', () => {
  it('is the one that lands where it was asked to, which keeps the hold (sc-22357)', () => {
    expect(scrollAsked(240, 240)).toBe(true);
    expect(scrollAsked(240, 240.5)).toBe(true);
  });

  it('is not any other scroll, nor any scroll when none was asked for', () => {
    expect(scrollAsked(240, 200)).toBe(false);
    expect(scrollAsked(null, 240)).toBe(false);
  });
});

describe('a step opening from its opener', () => {
  it('on Android with TalkBack on, keeps the opener until the step’s field has input focus, so TalkBack goes from one to the other with nothing between (sc-22392)', () => {
    expect(stepOpensInOrder('android', true)).toBe(true);
  });

  it('opens at once with TalkBack off, and on iOS', () => {
    expect(stepOpensInOrder('android', false)).toBe(false);
    expect(stepOpensInOrder('ios', true)).toBe(false);
  });
});
