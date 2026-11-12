import { describe, expect, it } from 'vitest';

import {
  GN,
  KWAME_NEEDS,
  NO_NEEDS,
  OTHER_LONG,
  chipsOf,
  keptNeeds,
  needsLinesOf,
  needsRefused,
  toggled,
} from './guestNeeds.ts';

describe('sc-3777 needs, the rules', () => {
  it('refuses an Other ticked with no words, and one over 100 characters', () => {
    expect(needsLinesOf({ ...NO_NEEDS, other: { ...NO_NEEDS.other, diet: '   ' } })).toEqual({
      diet: GN.sayWhich,
    });
    expect(
      needsLinesOf({ ...NO_NEEDS, other: { ...NO_NEEDS.other, allergies: OTHER_LONG } }),
    ).toEqual({ allergies: 'Shorten it to 100 characters or fewer.' });
    expect(
      needsLinesOf({ ...NO_NEEDS, other: { ...NO_NEEDS.other, access: ` ${'a'.repeat(100)} ` } }),
    ).toEqual({});
  });

  it('refuses a Private note over 500 characters', () => {
    expect(needsLinesOf({ ...NO_NEEDS, note: 'a'.repeat(501) })).toEqual({
      note: 'Shorten the note to 500 characters or fewer.',
    });
    expect(needsLinesOf({ ...NO_NEEDS, note: 'a'.repeat(500) })).toEqual({});
  });

  it('keeps the lists in their order whatever order they are ticked in', () => {
    const ticked = toggled(toggled(NO_NEEDS, 'allergies', 'sesame'), 'allergies', 'gluten');

    expect(ticked.allergies).toEqual(['gluten', 'sesame']);
    expect(toggled(ticked, 'allergies', 'gluten').allergies).toEqual(['sesame']);
  });

  it('shows allergies first, each as an allergy, and the note by name only', () => {
    expect(chipsOf(KWAME_NEEDS).map((chip) => [chip.words, chip.allergy])).toEqual([
      ['Peanuts', true],
      ['Sesame', true],
      ['Halal', false],
      ['Step-free access', false],
      ['Private note', false],
    ]);
  });

  it('sends the focus to the first failing field, the guest before a companion', () => {
    const blank = { ...NO_NEEDS, other: { ...NO_NEEDS.other, access: '' } };
    const found = needsRefused([
      { who: 'needs', needs: NO_NEEDS },
      { who: 'needs-c0', needs: blank },
      { who: 'needs-c1', needs: { ...blank, note: 'a'.repeat(501) } },
    ]);

    expect(found.first).toBe('needs-c0-access');
    expect(found.count).toBe(3);
  });

  it('saves each Other trimmed, and an unticked or blank one as nothing', () => {
    expect(
      keptNeeds({ ...NO_NEEDS, other: { allergies: ' kiwi ', diet: '  ', access: null } }).other,
    ).toEqual({ allergies: 'kiwi', diet: null, access: null });
  });
});
