import { describe, expect, it } from 'vitest';

import { brand } from '../theme/brand.ts';
import { tokens } from '../theme/tokens.ts';
import { besideGlyph, besideGlyphInPill, CONTROL_TEXT_SIZE } from '../layout/textSize.ts';
import { APPLE_IOS_CHROME, APPLE_IOS_PAD, appleIosGlyph, appleIosSize } from './appleIosSize.ts';

describe('appleIosSize', () => {
  it('gives the words the size asked for', () => {
    expect(appleIosSize(16).text).toBe(16);
  });

  it('keeps the logo and its gap in the proportion iOS draws them to the words', () => {
    const native = tokens.sizeHitPhonePrimary * brand.appleTitleToHeight;
    const size = appleIosSize(16);

    expect(size.logoHeight / size.text).toBeCloseTo(brand.appleLogoHeight / native);
    expect(size.gap / size.text).toBeCloseTo(brand.appleLogoGap / native);
  });

  it('draws iOS own button unchanged at its own size', () => {
    const native = tokens.sizeHitPhonePrimary * brand.appleTitleToHeight;

    expect(appleIosSize(native)).toEqual({
      text: native,
      logoHeight: brand.appleLogoHeight,
      gap: brand.appleLogoGap,
    });
  });
});

describe('appleIosGlyph', () => {
  const room = 375 - 2 * tokens.spaceXxl - APPLE_IOS_CHROME;
  const continuer = 5;
  const words = (scale: number) =>
    besideGlyph(
      CONTROL_TEXT_SIZE,
      CONTROL_TEXT_SIZE * scale,
      continuer * CONTROL_TEXT_SIZE * scale,
      appleIosGlyph(),
      room,
    );

  it('steps a Continuer-wide word down at the largest text size on a 375 pt screen', () => {
    expect(words(3.12)).toBeLessThan(CONTROL_TEXT_SIZE * 3.12);
  });

  it('leaves a Continuer-wide word at its size at Accessibility Large', () => {
    expect(words(2.14)).toBe(CONTROL_TEXT_SIZE * 2.14);
  });

  it("steps Continuer avec Apple down inside the pill's round ends at the largest text size, though the straight room would hold it (QA #87772)", () => {
    const start = CONTROL_TEXT_SIZE * 3.12;
    const widths = [4.5, 2.14, 2.64].map((em) => em * start);
    const inPill = besideGlyphInPill({
      size: CONTROL_TEXT_SIZE,
      start,
      widths,
      glyph: appleIosGlyph(),
      beside: 0,
      width: 375 - 2 * tokens.spaceXxl,
      sides: APPLE_IOS_CHROME / 2,
      pad: APPLE_IOS_PAD,
      ring: 1,
    });

    expect(besideGlyph(CONTROL_TEXT_SIZE, start, widths[0] ?? 0, appleIosGlyph(), room)).toBe(
      start,
    );
    expect(inPill).toBeLessThan(start);
    expect(inPill).toBeGreaterThan(CONTROL_TEXT_SIZE * 2.14);
  });
});
