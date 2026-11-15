import { describe, expect, it } from 'vitest';

import { brand } from '../theme/brand.ts';
import { tokens } from '../theme/tokens.ts';
import { appleIosSize } from './appleIosSize.ts';

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
