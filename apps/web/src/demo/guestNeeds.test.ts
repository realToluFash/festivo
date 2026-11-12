import { describe, expect, it } from 'vitest';

import { NO_NEEDS, dietary, needsChips, needsLines, needsOf, savedNeeds } from './guestNeeds.ts';
import { WEDDING, linesOf, sampleGuests, valuesOf, viewOf } from './guests.ts';

describe('needs recorded as facts (sc-3777)', () => {
  it('refuses an Other ticked with no words, or over 100 after trimming', () => {
    expect(needsLines(needsOf({ allergies: ['other'] }))).toEqual({ otherAllergy: 'Say which' });
    expect(needsLines(needsOf({ diet: ['other'], otherDiet: '   ' }))).toEqual({
      otherDiet: 'Say which',
    });
    expect(needsLines(needsOf({ access: ['other'], otherAccess: ` ${'a'.repeat(100)} ` }))).toEqual(
      {},
    );
    expect(needsLines(needsOf({ access: ['other'], otherAccess: 'a'.repeat(101) }))).toEqual({
      otherAccess: 'Shorten it to 100 characters or fewer.',
    });
    expect(needsLines(needsOf({ otherAllergy: 'words with Other unticked' }))).toEqual({});
  });

  it('refuses a private note over 500', () => {
    expect(needsLines(needsOf({ note: 'n'.repeat(500) }))).toEqual({});
    expect(needsLines(needsOf({ note: 'n'.repeat(501) }))).toEqual({
      note: 'Shorten the note to 500 characters or fewer.',
    });
  });

  it('closes to chips, allergies first, the note never shown', () => {
    expect(
      needsChips(
        needsOf({
          allergies: ['peanuts', 'other'],
          otherAllergy: ' Kiwi ',
          diet: ['halal'],
          access: ['step_free'],
          note: 'Carries a pen.',
        }),
      ).map((chip) => chip.word),
    ).toEqual(['Allergy · Peanuts', 'Allergy · Kiwi', 'Halal', 'Step-free access', 'Private note']);
    expect(needsChips(NO_NEEDS)).toEqual([]);
  });

  it('saves trimmed, dropping the words of an Other unticked', () => {
    expect(savedNeeds(needsOf({ otherDiet: 'Raw food', note: ' Hi ' }))).toEqual(
      needsOf({ note: 'Hi' }),
    );
  });

  it('counts a guest under Dietary notes for an allergy or a diet, never access alone', () => {
    expect(dietary(needsOf({ allergies: ['milk'] }))).toBe(true);
    expect(dietary(needsOf({ diet: ['vegan'] }))).toBe(true);
    expect(dietary(needsOf({ access: ['step_free'] }))).toBe(false);
  });

  it('refuses a companion’s Needs on its own, keyed to them', () => {
    const list = sampleGuests(WEDDING);
    const ines = list.find((one) => one.id === 'ines') ?? null;
    const values = valuesOf(ines);

    expect(
      linesOf({
        ...values,
        companions: values.companions.map((one) => ({
          ...one,
          needs: needsOf({ allergies: ['other'] }),
        })),
      }).needs,
    ).toEqual({ c0: { otherAllergy: 'Say which' } });
  });

  it('filters to the guests and companions with dietary notes, tagged only for who manages', () => {
    const list = sampleGuests(WEDDING);
    const { view, shown } = viewOf(list, 'all', '', new Set(), null, true, true);

    if (view.kind !== 'rows') throw new Error('rows');
    expect(view.rows.map((row) => [row.person.name, row.allergy, row.dietary])).toEqual([
      ['Alhaji Musa Bello', false, true],
      ['Dr Emeka Nwosu', true, true],
      ['Inês Duarte', false, true],
      ['Rui Duarte', true, true],
    ]);
    expect(shown).toBe(4);
    expect(view.rows[1]?.label).toBe(
      'Dr Emeka Nwosu, No reply · 1 companion, Allergy, Dietary notes',
    );

    const viewer = viewOf(list, 'all', 'nwosu', new Set(), null, false, true);

    if (viewer.view.kind !== 'rows') throw new Error('rows');
    expect(viewer.view.rows.every((row) => !row.allergy && !row.dietary)).toBe(true);
  });
});
