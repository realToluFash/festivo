import { describe, expect, it } from 'vitest';

import { initials } from './initials.ts';

describe('initials', () => {
  it('takes the first letter of the first two words, keeping their accents', () => {
    expect(initials('Ìrè Events')).toBe('ÌE');
    expect(initials('Okafor Family Trust')).toBe('OF');
  });

  it('keeps an accent typed as a separate mark with its letter', () => {
    expect(initials('Ìrè Events')).toBe('ÌE');
  });

  it('skips punctuation to the first letter, and copes with one word or none', () => {
    expect(initials('"Studio" Lumen')).toBe('SL');
    expect(initials('Lumen')).toBe('L');
    expect(initials('   ')).toBe('');
  });
});
