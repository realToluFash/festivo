import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { codeProps, FIELD_DEFAULTS, passwordProps } from './fields.ts';
import {
  barFits,
  coveredBy,
  groupInWindow,
  keyboardInWindow,
  keyboardLift,
  keysOver,
  listRoom,
  offsetAboveKeyboard,
  offsetToFocus,
  scrollInsets,
  shortWhileTyping,
  shownEnd,
} from './keyboard.ts';

describe('the keyboard lifts the card once', () => {
  it('on iOS, by the scroll view alone', () => {
    expect(keyboardLift('ios')).toEqual({ avoid: null, adjustScrollInsets: true });
  });

  it('on Android, by the avoiding view alone', () => {
    expect(keyboardLift('android')).toEqual({ avoid: 'padding', adjustScrollInsets: false });
  });

  it('by the frame alone while a bar is docked on the keys', () => {
    for (const os of ['ios', 'android']) {
      const insets = scrollInsets(keyboardLift(os), true);

      expect(insets.automaticallyAdjustKeyboardInsets, os).toBe(false);
      expect(insets.contentInset?.bottom, os).toBeGreaterThan(0);
      expect(insets.contentInset?.bottom, os).toBeLessThan(1);
    }
    expect(scrollInsets(keyboardLift('ios'), false)).toEqual({
      automaticallyAdjustKeyboardInsets: true,
      contentInset: undefined,
    });
  });

  it('never by both on one platform', () => {
    for (const os of ['ios', 'android', 'web']) {
      const lift = keyboardLift(os);

      expect(lift.avoid != null && lift.adjustScrollInsets, os).toBe(false);
    }
  });
});

describe('the focused field stays in a sheet body too short for its notices (sc-4527)', () => {
  // A 140 body; a 90 notice, then the 16 gap, then the 100 field: the group is 206.
  const body = { scrollTop: 0, keyboardTop: 140, margin: 16 };
  const group = { ...body, contentY: 40, height: 206 };
  const field = { contentY: 146, height: 100 };

  it('rests the field above the body end and lets the notice above it go', () => {
    const offset = offsetToFocus(group, field);

    expect(offset).toBe(122);
    expect(field.contentY + field.height - offset + body.margin).toBe(body.keyboardTop);
  });

  it('keeps the whole group, top first, while it fits', () => {
    const roomy = { ...group, keyboardTop: 400 };

    expect(offsetToFocus(roomy, field)).toBe(offsetAboveKeyboard(roomy));
  });

  it('keeps the field top when even the field does not fit', () => {
    const tiny = { ...group, keyboardTop: 60 };

    expect(offsetToFocus(tiny, field)).toBe(field.contentY - body.margin);
  });
});

describe('a field and its button rest above the keyboard', () => {
  const underHeader = { contentY: 600, height: 150, scrollTop: 100, keyboardTop: 500, margin: 16 };

  it('counting the header above the scroll view', () => {
    const offset = offsetAboveKeyboard(underHeader);
    const groupBottom = underHeader.scrollTop + underHeader.contentY - offset + underHeader.height;

    expect(offset).toBe(366);
    expect(groupBottom + underHeader.margin).toBe(underHeader.keyboardTop);
  });

  it('keeping the top of a group taller than the room below the scroll view top', () => {
    const tall = { ...underHeader, height: 500 };
    const offset = offsetAboveKeyboard(tall);
    const groupTop = tall.scrollTop + tall.contentY - offset;

    expect(offset).toBe(584);
    expect(groupTop).toBe(tall.scrollTop + tall.margin);
  });

  it('never past the top of the content', () => {
    expect(offsetAboveKeyboard({ ...underHeader, contentY: 0, height: 40 })).toBe(0);
  });

  it('finding the group in the window from a scrolled view', () => {
    expect(groupInWindow({ scrollTop: 100, contentY: 600, offset: 0 })).toBe(700);
    expect(groupInWindow({ scrollTop: 100, contentY: 600, offset: 366 })).toBe(334);
  });

  it('judging a scrolled group uncovered once the keys have scrolled to it', () => {
    const y = groupInWindow({ scrollTop: 100, contentY: 600, offset: 366 });

    expect(coveredBy(500, { y, height: 150 }, 16)).toBe(false);
    expect(
      coveredBy(
        500,
        { y: groupInWindow({ scrollTop: 100, contentY: 600, offset: 300 }), height: 150 },
        16,
      ),
    ).toBe(true);
  });

  it('above a bar docked on the keys, where the scroll view ends', () => {
    const docked = { y: 100, height: 300 };

    expect(shownEnd(500, docked)).toBe(400);
    expect(shownEnd(500, { y: 100, height: 600 })).toBe(500);
    expect(coveredBy(shownEnd(500, docked), { y: 300, height: 150 }, 16)).toBe(true);
    expect(coveredBy(500, { y: 300, height: 150 }, 16)).toBe(false);
  });

  it('with a docked bar only when the field still fits above it', () => {
    const portrait = { room: 420, field: 90, bar: 190, margin: 16 };

    expect(barFits(portrait)).toBe(true);
    expect(barFits({ ...portrait, room: 312 })).toBe(true);
    expect(barFits({ ...portrait, room: 311 })).toBe(false);
    expect(barFits({ ...portrait, room: 140 })).toBe(false);
  });

  it('only when the keyboard covers the group or its margin', () => {
    expect(coveredBy(500, { y: 300, height: 150 }, 16)).toBe(false);
    expect(coveredBy(500, { y: 300, height: 190 }, 16)).toBe(true);
    expect(coveredBy(500, { y: 450, height: 150 }, 16)).toBe(true);
  });
});

describe('the keyboard and a screen under the header share one frame', () => {
  // Android with the status bar counted out: a view at the screen's top measures at -24.
  const origin = -24;

  it('moving the keyboard by the origin, not by where the screen starts', () => {
    expect(keyboardInWindow(500, origin)).toBe(476);
    expect(keyboardInWindow(500, 0)).toBe(500);
  });

  it('so a group under the header is judged against where the keys really are', () => {
    const keyboardTop = keyboardInWindow(500, origin);

    expect(coveredBy(keyboardTop, { y: 300, height: 150 }, 16)).toBe(false);
    expect(coveredBy(keyboardTop, { y: 320, height: 150 }, 16)).toBe(true);
  });

  it('padding a screen by as much of it as the keys cover', () => {
    const keyboardTop = keyboardInWindow(500, origin);

    expect(keysOver({ y: 56, height: 600 }, keyboardTop)).toBe(180);
    expect(keysOver({ y: 56, height: 400 }, keyboardTop)).toBe(0);
    expect(keysOver({ y: 56, height: 600 }, null)).toBe(0);
  });

  it('and by the same once a shorter header lets the screen start higher and grow', () => {
    const keyboardTop = keyboardInWindow(500, origin);

    expect(keysOver({ y: 0, height: 656 }, keyboardTop)).toBe(180);
  });
});

describe('a list between a field and its button shrinks to fit above the keyboard', () => {
  const smallPhone = { room: 300, rest: 220, oneRow: 70, most: 264 };

  it('to the room the field and the button leave', () => {
    expect(listRoom(smallPhone)).toBe(80);
  });

  it('never under one whole row', () => {
    expect(listRoom({ ...smallPhone, rest: 280 })).toBe(70);
  });

  it('never taller than with the keyboard down', () => {
    expect(listRoom({ ...smallPhone, room: 900 })).toBe(264);
  });
});

describe('a short Android phone gives up the help line and back row while typing', () => {
  const smallAndroid = { os: 'android', phone: true, height: 640, keysUp: true };

  it('at 360×640 dp with the keys up', () => {
    expect(shortWhileTyping(smallAndroid)).toBe(true);
  });

  it('up to 700 dp tall', () => {
    expect(shortWhileTyping({ ...smallAndroid, height: 700 })).toBe(true);
    expect(shortWhileTyping({ ...smallAndroid, height: 701 })).toBe(false);
  });

  it('never with the keys down', () => {
    expect(shortWhileTyping({ ...smallAndroid, keysUp: false })).toBe(false);
  });

  it('never on a tablet', () => {
    expect(shortWhileTyping({ ...smallAndroid, phone: false, height: 600 })).toBe(false);
  });

  it('never on iOS', () => {
    expect(shortWhileTyping({ ...smallAndroid, os: 'ios', height: 667 })).toBe(false);
  });
});

describe('every field carries the caret colour', () => {
  it('in the defaults, the password field and the code field', () => {
    for (const props of [
      FIELD_DEFAULTS,
      passwordProps(false),
      passwordProps(true),
      codeProps(false),
      codeProps(true),
    ]) {
      expect(props.cursorColor).toBe(tokens.colorInk);
      expect(props.selectionColor).toBe(tokens.colorInk);
      expect(props.autoCorrect).toBe(false);
      expect(props.spellCheck).toBe(false);
    }
  });
});

describe('the password field reveals', () => {
  it('hides by default and shows on request', () => {
    expect(passwordProps(false).secureTextEntry).toBe(true);
    expect(passwordProps(true).secureTextEntry).toBe(false);
  });

  it('keeps autocorrect off while revealed, and never blocks a paste', () => {
    const revealed = passwordProps(true);

    expect(revealed.autoCorrect).toBe(false);
    expect(revealed.autoCapitalize).toBe('none');
    expect(revealed.contextMenuHidden).toBe(false);
  });
});

describe('a code field offers the keyboard its code needs', () => {
  it('digits only, for a code that can only be digits', () => {
    expect(codeProps(false).keyboardType).toBe('number-pad');
  });

  it('letters and the hyphen, for a field that also takes a recovery code', () => {
    expect(codeProps(true).keyboardType).toBe('default');
    expect(codeProps(true).autoCapitalize).toBe('none');
  });
});
