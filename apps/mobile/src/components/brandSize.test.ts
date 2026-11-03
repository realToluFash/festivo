import { describe, expect, it } from 'vitest';

import { brandSize } from './brandSize.ts';

describe('brandSize', () => {
  it('sizes the lockup by its height, as dusk-lockup is drawn 302.9 by 96', () => {
    const { width, height } = brandSize(true, { height: 36 });

    expect(height).toBe(36);
    expect(width).toBeCloseTo((36 * 302.9) / 96, 6);
  });

  it('still sizes the wordmark by its width, as dusk-wordmark is drawn 3181 by 1025', () => {
    const { width, height } = brandSize(false, { width: 119 });

    expect(width).toBe(119);
    expect(height).toBeCloseTo((119 * 1025) / 3181, 6);
  });

  it('keeps the proportions whichever side is given', () => {
    const byWidth = brandSize(true, { width: 200 });

    expect(brandSize(true, { height: byWidth.height }).width).toBeCloseTo(200, 6);
  });
});
