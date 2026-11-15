import { describe, expect, it } from 'vitest';

import {
  cardTileShown,
  LABEL_LINE,
  languageOf,
  LONG_ORGANISATION,
  scaleFor,
  TAB_GLYPH,
  TAB_GLYPH_GAP,
  TAB_HEIGHT,
  TAB_LABEL_MOST,
  tabLabelSize,
  textSizeOf,
} from './textSizeRules.ts';

// Instrument Sans SemiBold at 24, from the app's own font files.
const AT_24 = { fr: 142.7, es: 124.2, en: 103.6 } as const;
const ANDROID_TAB = 76.5;
const IPHONE_TAB = 87;

function widest(language: keyof typeof AT_24, scale: number): number {
  return (AT_24[language] * 12 * scale) / 24;
}

describe('the bar’s one label size', () => {
  it.each([
    ['fr', 2, ANDROID_TAB, 12],
    ['es', 2, ANDROID_TAB, 14],
    ['en', 2, ANDROID_TAB, 17],
    ['fr', 2.14, IPHONE_TAB, 14],
    ['es', 2.14, IPHONE_TAB, 16],
    ['en', 2.14, IPHONE_TAB, 20],
  ] as const)('in %s at %f in a %f tab is %i', (language, scale, slot, size) => {
    expect(tabLabelSize(scale, widest(language, scale), slot)).toBe(size);
  });

  it('leaves the default size at 12 in every language', () => {
    for (const language of ['fr', 'es', 'en'] as const) {
      expect(tabLabelSize(1, widest(language, 1), ANDROID_TAB)).toBe(12);
    }
  });

  it('keeps the widest word whole at the size it gives', () => {
    const size = tabLabelSize(2, widest('es', 2), ANDROID_TAB);

    expect((AT_24.es * size) / 24).toBeLessThanOrEqual(ANDROID_TAB);
  });

  it('never grows past 20, even when every word fits', () => {
    expect(tabLabelSize(3, 30, 200)).toBe(TAB_LABEL_MOST);
  });

  it('never steps under 12', () => {
    expect(tabLabelSize(2, 400, ANDROID_TAB)).toBe(12);
  });

  it('fits the largest label’s line under the glyph in the tab', () => {
    expect(TAB_GLYPH + TAB_GLYPH_GAP + TAB_LABEL_MOST * LABEL_LINE).toBeLessThanOrEqual(TAB_HEIGHT);
  });
});

describe('the card’s tile', () => {
  it('shows up to the accessibility sizes', () => {
    expect(cardTileShown(1)).toBe(true);
    expect(cardTileShown(1.5)).toBe(true);
  });

  it('gives way at 200 percent and at the ninth step', () => {
    expect(cardTileShown(2)).toBe(false);
    expect(cardTileShown(2.14)).toBe(false);
  });
});

describe('the board’s choices', () => {
  it('opens on this phone’s own size and English', () => {
    expect(textSizeOf(undefined)).toBe('phone');
    expect(languageOf('de')).toBe('en');
  });

  it('draws the named sizes at their own scale', () => {
    expect(scaleFor('android', 1)).toBe(2);
    expect(scaleFor('iphone', 1)).toBe(2.14);
    expect(scaleFor('phone', 1.3)).toBe(1.3);
  });

  it('uses sc-13280’s 100-character organisation', () => {
    expect(LONG_ORGANISATION).toHaveLength(100);
  });
});
