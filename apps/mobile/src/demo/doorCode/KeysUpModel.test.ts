import { describe, expect, it } from 'vitest';

import { tokens } from '../../theme/tokens.ts';
import { type EventFields, keptInView, offsetAboveSend } from './KeysUpModel.ts';

const MARGIN = tokens.spaceLg;
// The tile and the heading take 0 to 180, the refusal 196 to 240, then the two fields spaceLg apart, as `styles.fields` gaps them.
const REFUSAL = { contentY: 196, height: 44 };
const NAME = { contentY: 252, height: 84 };
const NUMBER = { contentY: 348, height: 84 };
const PLAIN: EventFields = { refusal: null, name: NAME, number: NUMBER, focus: 'name' };
const REFUSED: EventFields = { ...PLAIN, refusal: REFUSAL, name: NAME, number: NUMBER };

describe('what the keys leave above Send code on the event step (sc-97734)', () => {
  it('keeps Your name and the number row together whenever both fit', () => {
    expect(keptInView(PLAIN, 204, MARGIN)).toEqual({ contentY: 252, height: 180 });
    expect(keptInView({ ...PLAIN, focus: 'number' }, 204, MARGIN)).toEqual({
      contentY: 252,
      height: 180,
    });
  });

  it('keeps only the focused field when the two do not fit', () => {
    expect(keptInView(PLAIN, 203, MARGIN)).toEqual(NAME);
    expect(keptInView({ ...PLAIN, focus: 'number' }, 203, MARGIN)).toEqual(NUMBER);
  });

  it('counts a showing refusal in the group, then the refusal and the field, then the field', () => {
    expect(keptInView(REFUSED, 260, MARGIN)).toEqual({ contentY: 196, height: 236 });
    expect(keptInView(REFUSED, 259, MARGIN)).toEqual({ contentY: 196, height: 140 });
    expect(keptInView(REFUSED, 163, MARGIN)).toEqual(NAME);
  });

  it('falls straight to Mobile number, as the refusal and it span Your name too', () => {
    expect(keptInView({ ...REFUSED, focus: 'number' }, 259, MARGIN)).toEqual(NUMBER);
  });

  it('keeps a field taller than the room, whose top then shows', () => {
    expect(keptInView(PLAIN, 100, MARGIN)).toEqual(NAME);
    expect(offsetAboveSend({ ...PLAIN, room: 100, offset: 0, margin: MARGIN })).toBe(240);
  });
});

describe('where the scroll rests with the keys up (sc-97734)', () => {
  it('scrolls the tile and the heading under the top bar until the number row clears Send code', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 300, offset: 0, margin: MARGIN })).toBe(144);
  });

  it('stays put when both already show, as on a tall screen', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 520, offset: 0, margin: MARGIN })).toBeNull();
    expect(
      offsetAboveSend({ ...PLAIN, focus: 'number', room: 300, offset: 144, margin: MARGIN }),
    ).toBeNull();
  });

  it('rests Your name on Send code where only it fits, so the number row is wholly below', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 200, offset: 0, margin: MARGIN })).toBe(148);
    expect(NUMBER.contentY).toBeGreaterThanOrEqual(148 + 200);
  });

  it('leaves Mobile number where it already shows when only it fits', () => {
    expect(
      offsetAboveSend({
        ...PLAIN,
        focus: 'number',
        room: 200,
        offset: NAME.contentY,
        margin: MARGIN,
      }),
    ).toBeNull();
    expect(
      offsetAboveSend({ ...PLAIN, focus: 'number', room: 200, offset: 0, margin: MARGIN }),
    ).toBe(244);
  });

  it('brings the refusal back with the fields after a refused Send code', () => {
    expect(offsetAboveSend({ ...REFUSED, room: 300, offset: 0, margin: MARGIN })).toBe(144);
    expect(offsetAboveSend({ ...REFUSED, room: 280, offset: 300, margin: MARGIN })).toBe(164);
  });

  it('never scrolls above the top, and leaves both alone wherever they already show', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 600, offset: 300, margin: MARGIN })).toBe(0);
    expect(offsetAboveSend({ ...PLAIN, room: 440, offset: 40, margin: MARGIN })).toBeNull();
  });
});
