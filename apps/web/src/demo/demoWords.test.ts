import { describe, expect, it } from 'vitest';

import { demoWords } from './demoWords.ts';

const WORDS = {
  seats_one: '{{count}} seat',
  seats_other: '{{count}} seats',
  moved: '{{name}} moved {{n}} chairs.',
  reached: 'Reached · {{count, number}}',
} as const;

describe('the demos’ words', () => {
  it('fills slots, numbers in the locale’s digits, and leaves an unknown slot as it is', () => {
    const { filled } = demoWords(WORDS);

    expect(filled(WORDS.moved, { name: 'Priya Shah', n: 1200 })).toBe(
      'Priya Shah moved 1,200 chairs.',
    );
    expect(filled(WORDS.reached, { count: 96 })).toBe('Reached · 96');
    expect(filled(WORDS.moved, {})).toBe('{{name}} moved {{n}} chairs.');
  });

  it('picks the plural family’s form', () => {
    const { many } = demoWords(WORDS);

    expect(many('seats', 1)).toBe('1 seat');
    expect(many('seats', 122)).toBe('122 seats');
  });

  it('joins English the British way, with no serial comma, and other languages with their own word', () => {
    expect(demoWords(WORDS).listed(['Table 6', 'Table 7', 'Table 8'])).toBe(
      'Table 6, Table 7 and Table 8',
    );
    expect(demoWords(WORDS, { locale: 'fr' }).listed(['Table 6', 'Table 7'])).toBe(
      'Table 6 et Table 7',
    );
  });
});
