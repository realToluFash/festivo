import { describe, expect, it } from 'vitest';

import { phonePillAlone } from './frameBand.ts';

describe('phonePillAlone', () => {
  it('stands alone on Home with no primary, and leaves it to the primary row otherwise', () => {
    expect(phonePillAlone(true, false, false)).toBe(true);
    expect(phonePillAlone(true, true, false)).toBe(false);
    expect(phonePillAlone(false, true, false)).toBe(false);
    expect(phonePillAlone(false, false, false)).toBe(false);
  });

  it('keeps the pill while a screen stands in, where the screen had a primary or on Home', () => {
    expect(phonePillAlone(false, true, true)).toBe(true);
    expect(phonePillAlone(true, true, true)).toBe(true);
    expect(phonePillAlone(true, false, true)).toBe(true);
    expect(phonePillAlone(false, false, true)).toBe(false);
  });
});
