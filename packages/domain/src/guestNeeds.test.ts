import { describe, expect, it } from 'vitest';

import { NO_NEEDS, accessNames, dietNames, needsChips, needsWords } from './guestNeeds.ts';

const t = (key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key}${JSON.stringify(values)}`;

describe('the words of a guest’s needs (sc-3777, sc-5519)', () => {
  it('chips allergies first, then diet, access, and a note without its words', () => {
    const chips = needsChips(t, {
      ...NO_NEEDS,
      access: ['step_free'],
      diet: ['vegan'],
      allergies: ['peanuts', 'other'],
      otherAllergy: ' Kiwi ',
      note: 'Sits by the door',
    });

    expect(chips).toEqual([
      { kind: 'allergy', word: 'guestNeeds.allergyWith{"names":"guestNeeds.allergen.peanuts"}' },
      { kind: 'allergy', word: 'guestNeeds.allergyWith{"names":"Kiwi"}' },
      { kind: 'diet', word: 'guestNeeds.dietName.vegan' },
      { kind: 'access', word: 'guestNeeds.accessName.step_free' },
      { kind: 'note', word: 'guestNeeds.privateNote' },
    ]);
  });

  it('names no Other that was left blank or unticked', () => {
    expect(dietNames(t, { diet: ['other'], otherDiet: '  ' })).toEqual([]);
    expect(needsChips(t, { ...NO_NEEDS, otherAccess: 'Ramp' })).toEqual([]);
    expect(accessNames(t, { access: ['other'], otherAccess: 'Ramp' })).toEqual(['Ramp']);
  });

  it('says each problem with its limit', () => {
    expect(needsWords(t, undefined)).toBeUndefined();
    expect(needsWords(t, 'sayWhich')).toBe('guestNeeds.sayWhich');
    expect(needsWords(t, 'otherTooLong')).toBe('guestNeeds.otherTooLong{"most":100}');
    expect(needsWords(t, 'noteTooLong')).toBe('guestNeeds.noteTooLong{"most":500}');
  });
});
