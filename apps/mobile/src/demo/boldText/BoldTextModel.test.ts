import { afterEach, describe, expect, it } from 'vitest';

import { faceFor, inputFaceStyle, facesLoaded } from '../../theme/faceFor.ts';
import {
  APPLE_ANDROID,
  appleIosWeight,
  drawFaces,
  drawnWeight,
  MAP_ROWS,
  plainFace,
} from './BoldTextModel.ts';

afterEach(() => drawFaces(false));

describe('the map, one step and capped at Bold', () => {
  it.each([
    [400, 600],
    [500, 600],
    [600, 700],
    [700, 700],
  ] as const)('with Bold text on, %i is drawn at %i', (asked, drawn) => {
    expect(drawnWeight(asked, true)).toBe(drawn);
  });

  it('leaves every weight where it is with Bold text off', () => {
    for (const asked of [400, 500, 600, 700] as const) {
      expect(drawnWeight(asked, false)).toBe(asked);
    }
  });

  it('keeps a line one step under its title', () => {
    expect(drawnWeight(500, true)).toBeLessThan(drawnWeight(600, true));
  });

  it('says headings are the only weight left where it was', () => {
    expect(MAP_ROWS.filter((row) => row.on.endsWith('unchanged')).map((row) => row.asked)).toEqual([
      700,
    ]);
  });
});

describe('the face table the screens read', () => {
  it('draws each weight in the face the map gives it, and back', () => {
    drawFaces(true);
    expect(faceFor(400)).toBe('InstrumentSans-SemiBold');
    expect(faceFor(500)).toBe('InstrumentSans-SemiBold');
    expect(faceFor(600)).toBe('InstrumentSans-Bold');
    expect(faceFor(700)).toBe('InstrumentSans-Bold');

    drawFaces(false);
    expect(faceFor(400)).toBe('InstrumentSans-Regular');
    expect(faceFor(500)).toBe('InstrumentSans-Medium');
    expect(faceFor(600)).toBe('InstrumentSans-SemiBold');
    expect(faceFor(700)).toBe('InstrumentSans-Bold');
  });

  it('does not move on a second turn the same way', () => {
    drawFaces(true);
    drawFaces(true);
    expect(faceFor(400)).toBe('InstrumentSans-SemiBold');
  });

  it('draws typed text in SemiBold on Android, however often it is drawn', () => {
    facesLoaded();
    drawFaces(true);

    for (let drawn = 0; drawn < 3; drawn += 1) {
      expect(inputFaceStyle({ fontSize: 16 }, 'sans', 'android').fontFamily).toBe(
        'InstrumentSans-SemiBold',
      );
    }
  });

  it("leaves Google's one face alone", () => {
    drawFaces(true);
    expect(faceFor(500, 'googleSans')).toBe('GoogleSans-Medium');
  });

  it('keeps the plain faces for the specimen while the table is moved', () => {
    drawFaces(true);
    expect(plainFace(400)).toBe('InstrumentSans-Regular');
    expect(plainFace(500)).toBe('InstrumentSans-Medium');
  });
});

describe("Apple's words", () => {
  it('go from Medium to Bold in the system font on the iPhone', () => {
    expect(appleIosWeight(false)).toBe('medium');
    expect(appleIosWeight(true)).toBe('bold');
  });

  it('take the map on Android, asked for at 500', () => {
    expect(APPLE_ANDROID.offWeight).toBe(500);
    expect(APPLE_ANDROID.onWeight).toBe(600);
  });
});
