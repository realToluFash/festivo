import { describe, expect, it } from 'vitest';

import { LABEL_LINE } from '../../layout/textSize.ts';
import {
  cardTileShown,
  languageOf,
  LONG_ORGANISATION,
  partOf,
  phoneCountryOverNumber,
  phoneRefusal,
  scaleFor,
  TAB_GLYPH,
  TAB_GLYPH_GAP,
  TAB_HEIGHT,
  TAB_LABEL_MOST,
  tabLabelSize,
  textSizeOf,
  weekStateOf,
  weekStripShown,
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

describe('Home’s This week at a text size (sc-13281)', () => {
  it('keeps the strip at the default sizes', () => {
    expect(weekStripShown(scaleFor('default', 1))).toBe(true);
    expect(weekStripShown(1.35)).toBe(true);
  });

  it('gives the strip up from iOS’s eighth step (1.79), the first accessibility size', () => {
    expect(weekStripShown(1.79)).toBe(false);
    expect(weekStripShown(scaleFor('android', 1))).toBe(false);
    expect(weekStripShown(scaleFor('iphone', 1))).toBe(false);
    expect(weekStripShown(scaleFor('twelfth', 1))).toBe(false);
  });

  it('draws the twelfth step at 3.57', () => {
    expect(textSizeOf('twelfth')).toBe('twelfth');
    expect(scaleFor('twelfth', 1)).toBe(3.57);
  });

  it('reads the board’s part and week from the address', () => {
    expect(partOf('week')).toBe('week');
    expect(partOf('phone')).toBe('phone');
    expect(partOf(undefined)).toBe('card');
    expect(weekStateOf('nothing')).toBe('nothing');
    expect(weekStateOf('other')).toBe('events');
  });
});

describe('a phone number’s two boxes at a text size (qa3, #78429)', () => {
  it('keeps the country beside the number at the default sizes', () => {
    expect(phoneCountryOverNumber(1)).toBe(false);
    expect(phoneCountryOverNumber(1.35)).toBe(false);
  });

  it('puts the country over the number from the accessibility sizes on', () => {
    expect(phoneCountryOverNumber(1.79)).toBe(true);
    expect(phoneCountryOverNumber(scaleFor('android', 1))).toBe(true);
    expect(phoneCountryOverNumber(scaleFor('iphone', 1))).toBe(true);
    expect(phoneCountryOverNumber(scaleFor('twelfth', 1))).toBe(true);
  });
});

describe('a phone number refused in the demo (sc-78438)', () => {
  it('refuses a blank number and one too short to be a number', () => {
    expect(phoneRefusal('')).toBe('numberBlank');
    expect(phoneRefusal(' ')).toBe('numberBlank');
    expect(phoneRefusal('12')).toBe('tooShort');
  });

  it('takes a number long enough to be one', () => {
    expect(phoneRefusal('07700 900123')).toBeNull();
  });
});
