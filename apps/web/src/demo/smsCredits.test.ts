import { describe, expect, it } from 'vitest';

import { CREDITS_A_PART, textCredits, textsCredits } from './smsCredits.ts';

describe('what a text costs (sc-3946, sc-3928’s table as a sample)', () => {
  it('charges each part at its number’s country', () => {
    expect(CREDITS_A_PART).toEqual({
      US: 2,
      GB: 9,
      FR: 13,
      ES: 14,
      PT: 8,
      BR: 10,
      MX: 29,
      NG: 62,
    });
    expect(
      ['US', 'GB', 'FR', 'ES', 'PT', 'BR', 'MX', 'NG'].map((country) =>
        textCredits({ parts: 2, country }),
      ),
    ).toEqual([4, 18, 26, 28, 16, 20, 58, 124]);
    expect(textCredits({ parts: 1, country: 'GB' })).toBe(9);
  });

  it('sums the texts, and names a country it has no rate for rather than guessing', () => {
    expect(
      textsCredits([
        { parts: 2, country: 'NG' },
        { parts: 2, country: 'GB' },
        { parts: 2, country: 'US' },
      ]),
    ).toBe(146);
    expect(textsCredits([])).toBe(0);
    expect(() => textCredits({ parts: 1, country: 'DE' })).toThrow('No sample rate for DE');
  });
});
