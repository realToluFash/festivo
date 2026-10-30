import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import {
  codeProps,
  FIELD_DEFAULTS,
  fieldName,
  type FieldText,
  fieldText,
  keyTyped,
  nextGiven,
  nextPin,
  passwordProps,
  type Typing,
  valueHanded,
} from './fields.ts';
import {
  barFits,
  coveredBy,
  fieldKeptInSight,
  groupInWindow,
  keyboardInWindow,
  keptLeavesSight,
  keyboardLift,
  keysDownThen,
  keysOver,
  liftNeeded,
  listRoom,
  offsetAboveKeyboard,
  offsetIntoView,
  offsetToFocus,
  outOfSight,
  scrollInsets,
  searchBesideTitle,
  settledOffset,
  settledOffsetKeeping,
  shortWhileTyping,
  shownAboveKeys,
  shownEnd,
  titleScrollsWhileTyping,
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

describe('the field typed in stays in sight above a group lifted under it (sc-11978)', () => {
  // Current password, 110 tall at 400, then the New password group, 420 tall at 526.
  const card = { contentY: 526, height: 420, scrollTop: 100, keyboardTop: 600, margin: 16 };
  const current = 400;

  it('stops the lift with the focused field at the top of the scroll view', () => {
    const offset = offsetAboveKeyboard({ ...card, focusY: current });

    expect(offset).toBe(current - card.margin);
    expect(offset).toBeLessThan(offsetAboveKeyboard(card));
  });

  it('lifts the whole group when it fits under the focused field', () => {
    const tall = { ...card, keyboardTop: 900 };

    expect(offsetAboveKeyboard({ ...tall, focusY: current })).toBe(offsetAboveKeyboard(tall));
  });

  it('keeps the group top when the focused field sits inside the group', () => {
    expect(offsetAboveKeyboard({ ...card, focusY: card.contentY })).toBe(offsetAboveKeyboard(card));
  });

  it('lifts a group already above the keys when the focused field sits under the header', () => {
    const check = { shown: 600, group: { y: 150, height: 300 }, scrollTop: 100, margin: 16 };

    expect(liftNeeded(check)).toBe(false);
    expect(liftNeeded({ ...check, focusTop: 60 })).toBe(true);
    expect(liftNeeded({ ...check, focusTop: 120 })).toBe(false);
  });

  it('lifts a group the keys cover wherever the focused field sits', () => {
    const check = { shown: 400, group: { y: 150, height: 300 }, scrollTop: 100, margin: 16 };

    expect(liftNeeded({ ...check, focusTop: 120 })).toBe(true);
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

describe('a line that appears off screen is brought wholly into sight (sc-9382)', () => {
  const line = { height: 80, shown: 600, margin: 16 };

  it('stays put when it is already wholly on screen', () => {
    expect(offsetIntoView({ ...line, contentY: 300, offset: 200 })).toBeNull();
    expect(offsetIntoView({ ...line, contentY: 200, offset: 200 })).toBeNull();
    expect(offsetIntoView({ ...line, contentY: 720, offset: 200 })).toBeNull();
  });

  it('comes down to the top, a margin clear, when it is above the screen or partly above it', () => {
    expect(offsetIntoView({ ...line, contentY: 40, offset: 900 })).toBe(24);
    expect(offsetIntoView({ ...line, contentY: 180, offset: 200 })).toBe(164);
  });

  it('never scrolls above the content', () => {
    expect(offsetIntoView({ ...line, contentY: 8, offset: 300 })).toBe(0);
  });

  it('comes up to the bottom, a margin clear, when it is below the screen', () => {
    expect(offsetIntoView({ ...line, contentY: 1000, offset: 0 })).toBe(496);
  });

  it('keeps its top in sight when it is taller than the screen', () => {
    expect(offsetIntoView({ ...line, height: 900, contentY: 1000, offset: 0 })).toBe(984);
  });
});

describe('a field a check focuses comes wholly into sight above the keys (sc-20721)', () => {
  const scrollView = { y: 100, height: 700 };
  const field = { height: 120, margin: 16 };

  it('has the whole scroll view in sight with the keys down, and down to the keys with them up', () => {
    expect(shownAboveKeys(null, scrollView)).toBe(700);
    expect(shownAboveKeys(500, scrollView)).toBe(400);
    expect(shownAboveKeys(900, scrollView)).toBe(700);
  });

  it('comes down from above the screen to a margin under its top', () => {
    const shown = shownAboveKeys(500, scrollView);

    expect(offsetIntoView({ ...field, contentY: 40, offset: 900, shown })).toBe(24);
  });

  it('comes up out from under the keys', () => {
    const shown = shownAboveKeys(500, scrollView);

    expect(offsetIntoView({ ...field, contentY: 400, offset: 0, shown })).toBe(136);
  });

  it('stays put when it is already wholly in sight above them', () => {
    const shown = shownAboveKeys(500, scrollView);

    expect(offsetIntoView({ ...field, contentY: 100, offset: 0, shown })).toBeNull();
  });
});

describe("a closed step's opener is scrolled under TalkBack's focus only once it is out of sight (sc-18588)", () => {
  const opener = { height: 48, shown: 600 };

  it('is out of sight wholly above or wholly below the screen', () => {
    expect(outOfSight({ ...opener, contentY: 100, offset: 148 })).toBe(true);
    expect(outOfSight({ ...opener, contentY: 900, offset: 300 })).toBe(true);
  });

  it('is in sight wholly on screen, or with any part of it showing', () => {
    expect(outOfSight({ ...opener, contentY: 300, offset: 200 })).toBe(false);
    expect(outOfSight({ ...opener, contentY: 180, offset: 200 })).toBe(false);
    expect(outOfSight({ ...opener, contentY: 780, offset: 200 })).toBe(false);
  });

  it('stays put while any part of it shows, where a wholly pass would scroll it', () => {
    const partly = { ...opener, contentY: 180, offset: 200, margin: 16 };

    expect(settledOffset(partly, 'outOfSight')).toBeNull();
    expect(settledOffset(partly, 'wholly')).toBe(164);
  });

  it('comes back into sight once it has wholly left it', () => {
    expect(settledOffset({ ...opener, contentY: 900, offset: 300, margin: 16 }, 'outOfSight')).toBe(
      364,
    );
  });

  it('scrolls back up only as far as keeps Cancel, under TalkBack’s focus, wholly in sight', () => {
    const above = { ...opener, contentY: 400, offset: 800, margin: 16 };

    expect(settledOffsetKeeping(above, 'outOfSight', { contentY: 950, height: 48 })).toBe(398);
    expect(settledOffsetKeeping(above, 'outOfSight', { contentY: 900, height: 48 })).toBe(384);
  });

  it('scrolls back up as before when keeping Cancel in sight leaves the opener out of it', () => {
    const above = { ...opener, contentY: 400, offset: 800, margin: 16 };

    expect(settledOffsetKeeping(above, 'outOfSight', { contentY: 1000, height: 48 })).toBe(384);
    expect(settledOffsetKeeping(above, 'outOfSight', { contentY: 1500, height: 48 })).toBe(384);
  });

  it('says when that scroll carries Cancel wholly out of sight, as TalkBack sees it (sc-22357)', () => {
    expect(keptLeavesSight(600, 384, { contentY: 1000, height: 48 })).toBe(true);
    expect(keptLeavesSight(600, 398, { contentY: 950, height: 48 })).toBe(false);
    expect(keptLeavesSight(600, 384, { contentY: 950, height: 48 })).toBe(false);
    expect(keptLeavesSight(600, null, { contentY: 1500, height: 48 })).toBe(false);
    expect(keptLeavesSight(600, 384, null)).toBe(false);
  });

  it('brings an opener below into sight as before, and with nothing to keep', () => {
    const below = { ...opener, contentY: 900, offset: 300, margin: 16 };

    expect(settledOffsetKeeping(below, 'outOfSight', { contentY: 400, height: 48 })).toBe(364);
    expect(
      settledOffsetKeeping(
        { ...opener, contentY: 400, offset: 800, margin: 16 },
        'outOfSight',
        null,
      ),
    ).toBe(384);
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

describe("a list's search moves beside its title on an iPhone on its side (sc-10118)", () => {
  const onItsSide = { os: 'ios', phone: true, width: 667, height: 375 };

  it('on its side', () => {
    expect(searchBesideTitle(onItsSide)).toBe(true);
  });

  it('not upright', () => {
    expect(searchBesideTitle({ ...onItsSide, width: 375, height: 667 })).toBe(false);
  });

  it('not on an Android phone', () => {
    expect(searchBesideTitle({ ...onItsSide, os: 'android' })).toBe(false);
  });

  it('not on an iPad', () => {
    expect(searchBesideTitle({ ...onItsSide, phone: false, width: 1194, height: 834 })).toBe(false);
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

describe('an iPhone on its side scrolls the sheet title with its body while typing', () => {
  const sideways = { os: 'ios', phone: true, width: 844, height: 390, keysUp: true };

  it('on its side with the keys up', () => {
    expect(titleScrollsWhileTyping(sideways)).toBe(true);
  });

  it('never in portrait', () => {
    expect(titleScrollsWhileTyping({ ...sideways, width: 390, height: 844 })).toBe(false);
  });

  it('never with the keys down', () => {
    expect(titleScrollsWhileTyping({ ...sideways, keysUp: false })).toBe(false);
  });

  it('never on a tablet', () => {
    expect(titleScrollsWhileTyping({ ...sideways, phone: false })).toBe(false);
  });

  it('never on an Android phone', () => {
    expect(titleScrollsWhileTyping({ ...sideways, os: 'android' })).toBe(false);
  });
});

describe('a sheet keeps its field in sight while typing, and on an iPhone on its side with the keys down (sc-9442)', () => {
  const sideways = { os: 'ios', phone: true, width: 667, height: 375, keysUp: true };

  it('with the keys up', () => {
    expect(fieldKeptInSight({ ...sideways, width: 375, height: 667 })).toBe(true);
    expect(fieldKeptInSight({ ...sideways, os: 'android', width: 360, height: 640 })).toBe(true);
  });

  it('on an iPhone on its side with the keys down', () => {
    expect(fieldKeptInSight({ ...sideways, keysUp: false })).toBe(true);
  });

  it('not with the keys down upright', () => {
    expect(fieldKeptInSight({ ...sideways, width: 375, height: 667, keysUp: false })).toBe(false);
  });

  it('not with the keys down on an iPad', () => {
    expect(
      fieldKeptInSight({ ...sideways, phone: false, width: 1180, height: 820, keysUp: false }),
    ).toBe(false);
  });

  it('not with the keys down on an Android phone on its side', () => {
    expect(fieldKeptInSight({ ...sideways, os: 'android', keysUp: false })).toBe(false);
  });
});

describe('an iPhone on its side rests the sheet body at its top once the keys go down (sc-9442)', () => {
  // An SE on its side, keys down: a 170 body under the fixed title; the 40 intro, the 16 gap, then the 76 name field, or a 40 notice and a 16 gap before it.
  const body = { scrollTop: 0, keyboardTop: 170, margin: 16 };
  const field = { contentY: 56, height: 76 };

  it('with the intro whole above the field while the field fits', () => {
    expect(offsetToFocus({ ...body, ...field }, field)).toBe(0);
  });

  it('with the notice and the field whole when a notice above it leaves no room for the intro', () => {
    const group = { ...body, contentY: 56, height: 132 };
    const noticed = { contentY: 112, height: 76 };
    const offset = offsetToFocus(group, noticed);

    expect(offset).toBe(34);
    expect(group.contentY - offset).toBeGreaterThanOrEqual(0);
    expect(noticed.contentY + noticed.height - offset + body.margin).toBeLessThanOrEqual(
      body.keyboardTop,
    );
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

describe('a field held through a submit', () => {
  const shown = (field: FieldText) => {
    const text = fieldText(field);

    return text.value ?? text.defaultValue;
  };
  const step = (field: FieldText, held: boolean): FieldText => {
    const next = { ...field, held };

    return { ...next, pinned: nextPin(next, 1, 1).pinned };
  };
  const typed: FieldText = {
    held: false,
    value: undefined,
    defaultValue: undefined,
    typed: 'hunter22',
    pinned: undefined,
  };

  it('still carries the submitted text once released, when uncontrolled', () => {
    const held = step(typed, true);
    const released = step(held, false);

    expect(shown(held)).toBe('hunter22');
    expect(shown(released)).toBe('hunter22');
  });

  it('carries what was typed after a release into the next hold', () => {
    const released = step(step(typed, true), false);
    const heldAgain = step({ ...released, typed: 'hunter23' }, true);

    expect(shown(heldAgain)).toBe('hunter23');
    expect(shown(step(heldAgain, false))).toBe('hunter23');
  });

  it('shows its value throughout, when controlled', () => {
    const controlled = { ...typed, value: 'Acme', typed: 'Acme' };

    expect(fieldText(step(controlled, true))).toEqual({ value: 'Acme' });
    expect(fieldText(step(step(controlled, true), false))).toEqual({ value: 'Acme' });
  });

  it('starts from its default value until it is first held', () => {
    expect(fieldText({ ...typed, defaultValue: 'ada@example.com' })).toEqual({
      defaultValue: 'ada@example.com',
    });
  });
});

describe('a field through a text-size change', () => {
  const rescale = (field: FieldText): FieldText => ({
    ...field,
    pinned: nextPin(field, 1.3, 1).pinned,
  });
  const given: FieldText = {
    held: false,
    value: undefined,
    defaultValue: 'ada@example.com',
    typed: 'ada@example.com',
    pinned: undefined,
  };

  it('is given what was typed after the text it was given', () => {
    expect(fieldText(rescale({ ...given, typed: 'grace@example.com' }))).toEqual({
      defaultValue: 'grace@example.com',
    });
  });

  it('is given what was typed after the text it was submitted with', () => {
    const released = { ...given, pinned: 'hunter22', typed: 'hunter223' };

    expect(fieldText(rescale(released))).toEqual({ defaultValue: 'hunter223' });
  });

  it('stays empty once emptied by hand', () => {
    expect(fieldText(rescale({ ...given, typed: '' }))).toEqual({ defaultValue: '' });
  });

  it('keeps the text it was given when nothing was typed', () => {
    expect(fieldText(rescale(given))).toEqual({ defaultValue: 'ada@example.com' });
  });

  it('shows its value, when controlled', () => {
    const controlled = { ...given, value: 'Acme', typed: 'Acme' };

    expect(fieldText(rescale(controlled))).toEqual({ value: 'Acme' });
  });

  it('takes the new scale, so the next render is not a change', () => {
    const typedAfter = { ...given, typed: 'grace@example.com' };

    expect(nextPin(typedAfter, 1.3, 1)).toEqual({ pinned: 'grace@example.com', scale: 1.3 });
    expect(nextPin(typedAfter, 1.3, 1.3)).toEqual({ pinned: undefined, scale: 1.3 });
  });
});

describe('a field on Android is named by what it shows, so TalkBack reads what it holds (sc-17333)', () => {
  it('is named by the label its Field shows', () => {
    expect(fieldName('android', 'Event name', { labelID: 'r1' })).toEqual({
      accessibilityLabel: undefined,
      accessibilityLabelledBy: 'r1',
    });
  });

  it('is named by an unseen copy of its placeholder once it holds text', () => {
    expect(
      fieldName('android', 'Search countries', {
        placeholder: 'Search countries',
        filled: { held: true, nameID: 'r2' },
      }),
    ).toEqual({ accessibilityLabel: undefined, accessibilityLabelledBy: 'r2' });
  });

  it('is named by its placeholder alone while empty, so the name is said once', () => {
    expect(
      fieldName('android', 'Search countries', {
        placeholder: 'Search countries',
        filled: { held: false, nameID: 'r2' },
      }),
    ).toEqual({ accessibilityLabel: undefined });
  });

  it('keeps its content description when it shows no name at all', () => {
    expect(fieldName('android', 'Code', { placeholder: '' })).toEqual({
      accessibilityLabel: 'Code',
    });
  });

  it('keeps its label on iOS, where VoiceOver reads the value beside it', () => {
    expect(fieldName('ios', 'Event name', { labelID: 'r1' })).toEqual({
      accessibilityLabel: 'Event name',
    });
  });
});

describe('a key typed on Android leaves the field its text, so TalkBack says only the key (sc-18648)', () => {
  const opened: Typing = { typed: 'Gal', pinned: 'Gal', given: undefined };
  const handed = (value: string, typing: Typing) => {
    const next = nextGiven('android', value, typing);
    const field = {
      held: false,
      value: valueHanded('android', value, next.given),
      defaultValue: undefined,
      typed: next.typed,
      pinned: next.pinned,
    };

    return fieldText(field);
  };

  it('hands back no text for a key, its value being what was typed', () => {
    const typedX = { ...opened, typed: 'Galx' };

    expect(nextGiven('android', 'Galx', typedX)).toBe(typedX);
    expect(handed('Galx', typedX)).toEqual({ defaultValue: 'Gal' });
  });

  it('opens holding the value the screen filled it with', () => {
    expect(handed('Gal', opened)).toEqual({ defaultValue: 'Gal' });
  });

  it('is handed a value that is not what was typed, so an added domain empties the field', () => {
    const typed = { typed: 'example.com', pinned: '', given: undefined };

    expect(nextGiven('android', '', typed)).toEqual({ typed: '', pinned: '', given: '' });
    expect(handed('', typed)).toEqual({ value: '' });
  });

  it('is uncontrolled again after the key that follows a value it was handed', () => {
    const emptied = nextGiven('android', '', {
      typed: 'example.com',
      pinned: '',
      given: undefined,
    });
    const next = keyTyped(emptied, 'e');

    expect(next.given).toBeUndefined();
    expect(valueHanded('android', 'e', next.given)).toBeUndefined();
    expect(nextGiven('android', 'e', next)).toBe(next);
  });

  it('keeps what was typed through a text-size change', () => {
    const next = nextGiven('android', 'Galx', { ...opened, typed: 'Galx' });
    const field = {
      held: false,
      value: valueHanded('android', 'Galx', next.given),
      defaultValue: undefined,
      typed: next.typed,
      pinned: next.pinned,
    };

    expect(nextPin(field, 1.3, 1).pinned).toBe('Galx');
  });

  it('is handed its value on every render on iOS, where VoiceOver says only the key', () => {
    expect(nextGiven('ios', 'Gal', { ...opened, typed: 'Ga' })).toEqual({ ...opened, typed: 'Ga' });
    expect(valueHanded('ios', 'Galx', undefined)).toBe('Galx');
  });
});

describe('a closing step puts the keys down through Gboard swapping them (sc-18588)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function keyboard(up: boolean) {
    const keys = {
      isUp: up,
      hides: 0,
      heard: new Set<() => void>(),
      up: () => keys.isUp,
      hide: () => {
        keys.hides += 1;
      },
      onHidden: (hidden: () => void) => {
        keys.heard.add(hidden);

        return () => keys.heard.delete(hidden);
      },
      said(up: boolean) {
        keys.isUp = up;
        if (!up) keys.heard.forEach((hidden) => hidden());
      },
    };

    return keys;
  }

  it('goes on once the keys have stayed down for the settle', () => {
    const keys = keyboard(true);
    const then = vi.fn();
    keysDownThen(keys, then, 500);

    vi.advanceTimersByTime(200);
    keys.said(false);
    vi.advanceTimersByTime(499);
    expect(then).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(then).toHaveBeenCalledOnce();
    expect(keys.hides).toBe(1);
  });

  it('hides the keys again when the swap says they went down and they came back up', () => {
    const keys = keyboard(true);
    const then = vi.fn();
    keysDownThen(keys, then, 500);

    vi.advanceTimersByTime(80);
    keys.said(false);
    vi.advanceTimersByTime(20);
    keys.said(true);
    vi.advanceTimersByTime(500);
    expect(keys.hides).toBe(2);
    expect(then).not.toHaveBeenCalled();

    keys.said(false);
    vi.advanceTimersByTime(500);
    expect(then).toHaveBeenCalledOnce();
  });

  it('does not hold the close for keys that never go down', () => {
    const keys = keyboard(true);
    const then = vi.fn();
    keysDownThen(keys, then, 500);

    vi.advanceTimersByTime(1000);
    expect(keys.hides).toBe(2);
    expect(then).toHaveBeenCalledOnce();
    expect(keys.heard.size).toBe(0);
  });

  it('goes on after the settle with the keys already down', () => {
    const keys = keyboard(false);
    const then = vi.fn();
    keysDownThen(keys, then, 500);

    expect(keys.hides).toBe(1);
    vi.advanceTimersByTime(499);
    expect(then).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(then).toHaveBeenCalledOnce();
    expect(keys.hides).toBe(1);
  });

  it('hides the keys again when they were down at the call and the swap brought them back up', () => {
    const keys = keyboard(false);
    const then = vi.fn();
    keysDownThen(keys, then, 500);

    vi.advanceTimersByTime(100);
    keys.said(true);
    vi.advanceTimersByTime(400);
    expect(keys.hides).toBe(2);
    expect(then).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    keys.said(false);
    vi.advanceTimersByTime(499);
    expect(then).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(then).toHaveBeenCalledOnce();
  });

  it('calls nothing once cancelled', () => {
    const keys = keyboard(true);
    const then = vi.fn();
    keysDownThen(keys, then, 500)();

    vi.advanceTimersByTime(2000);
    expect(then).not.toHaveBeenCalled();
    expect(keys.heard.size).toBe(0);
  });
});
