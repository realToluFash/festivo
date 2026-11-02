import { describe, expect, test } from 'vitest';

import { typedNameMatches } from './typedName.ts';

describe('the name typed to confirm a deletion', () => {
  test.each([
    ['exact', "Amara & Tobi's wedding", "Amara & Tobi's wedding"],
    ['spaces around it', "  Amara & Tobi's wedding ", "Amara & Tobi's wedding"],
    ['curly typed for straight', 'Amara & Tobi’s wedding', "Amara & Tobi's wedding"],
    ['straight typed for curly', "Amara & Tobi's wedding", 'Amara & Tobi’s wedding'],
    ['curly double quotes', 'The “Big” night', 'The "Big" night'],
    ['decomposed accents', 'Ìrè Events', 'Ìrè Events'],
  ])('matches: %s', (_, typed, name) => {
    expect(typedNameMatches(typed, name)).toBe(true);
  });

  test.each([
    ['another case', "amara & tobi's wedding", "Amara & Tobi's wedding"],
    ['an apostrophe for a quote', "Tobi's", 'Tobi"s'],
    ['a backtick', 'Tobi`s', "Tobi's"],
    ['a dash', 'Ìrè – Events', 'Ìrè - Events'],
    ['blank', '   ', 'Ìrè Events'],
  ])('refuses: %s', (_, typed, name) => {
    expect(typedNameMatches(typed, name)).toBe(false);
  });
});
