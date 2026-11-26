import { describe, expect, it } from 'vitest';

import { type EventFields, keptInView, offsetAboveSend } from './KeysUpModel.ts';

const MARGIN = 16;
// The tile and the heading take 0 to 180, the refusal 196 to 240, then the two fields 16 apart.
const REFUSAL = { contentY: 196, height: 44 };
const NAME = { contentY: 256, height: 84 };
const NUMBER = { contentY: 356, height: 84 };
const PLAIN: EventFields = { refusal: null, name: NAME, number: NUMBER, focus: 'name' };
const REFUSED: EventFields = { ...PLAIN, refusal: REFUSAL, name: NAME, number: NUMBER };

describe('what the keys leave above Send code on the event step (sc-97734)', () => {
  it('keeps Your name and the number row together whenever both fit', () => {
    expect(keptInView(PLAIN, 220, MARGIN)).toEqual({ contentY: 256, height: 184 });
    expect(keptInView({ ...PLAIN, focus: 'number' }, 216, MARGIN)).toEqual({
      contentY: 256,
      height: 184,
    });
  });

  it('keeps only the focused field when the two do not fit', () => {
    expect(keptInView(PLAIN, 215, MARGIN)).toEqual(NAME);
    expect(keptInView({ ...PLAIN, focus: 'number' }, 215, MARGIN)).toEqual(NUMBER);
  });

  it('counts a showing refusal in the group, then the refusal and the field, then the field', () => {
    expect(keptInView(REFUSED, 276, MARGIN)).toEqual({ contentY: 196, height: 244 });
    expect(keptInView(REFUSED, 275, MARGIN)).toEqual({ contentY: 196, height: 144 });
    expect(keptInView(REFUSED, 175, MARGIN)).toEqual(NAME);
  });

  it('falls straight to Mobile number, as the refusal and it span Your name too', () => {
    expect(keptInView({ ...REFUSED, focus: 'number' }, 275, MARGIN)).toEqual(NUMBER);
  });

  it('keeps a field taller than the room, whose top then shows', () => {
    expect(keptInView(PLAIN, 100, MARGIN)).toEqual(NAME);
    expect(offsetAboveSend({ ...PLAIN, room: 100, offset: 0, margin: MARGIN })).toBe(240);
  });
});

describe('where the scroll rests with the keys up (sc-97734)', () => {
  it('scrolls the tile and the heading under the top bar until the number row clears Send code', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 300, offset: 0, margin: MARGIN })).toBe(156);
  });

  it('stays put when both already show, as on a tall screen', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 520, offset: 0, margin: MARGIN })).toBeNull();
    expect(
      offsetAboveSend({ ...PLAIN, focus: 'number', room: 300, offset: 156, margin: MARGIN }),
    ).toBeNull();
  });

  it('rests Your name on Send code where only it fits, so the number row is wholly below', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 200, offset: 0, margin: MARGIN })).toBe(156);
    expect(NUMBER.contentY).toBeGreaterThanOrEqual(156 + 200);
  });

  it('leaves Mobile number where it already shows when only it fits', () => {
    expect(
      offsetAboveSend({ ...PLAIN, focus: 'number', room: 200, offset: 256, margin: MARGIN }),
    ).toBeNull();
    expect(
      offsetAboveSend({ ...PLAIN, focus: 'number', room: 200, offset: 0, margin: MARGIN }),
    ).toBe(256);
  });

  it('brings the refusal back with the fields after a refused Send code', () => {
    expect(offsetAboveSend({ ...REFUSED, room: 300, offset: 0, margin: MARGIN })).toBe(156);
    expect(offsetAboveSend({ ...REFUSED, room: 280, offset: 300, margin: MARGIN })).toBe(176);
  });

  it('never scrolls above the top, and leaves both alone wherever they already show', () => {
    expect(offsetAboveSend({ ...PLAIN, room: 600, offset: 300, margin: MARGIN })).toBe(0);
    expect(offsetAboveSend({ ...PLAIN, room: 440, offset: 40, margin: MARGIN })).toBeNull();
  });
});
