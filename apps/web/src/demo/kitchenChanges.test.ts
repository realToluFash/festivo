import { describe, expect, it } from 'vitest';

import {
  BASE,
  type Figures,
  type Item,
  LONG_NAMES,
  SAMPLES,
  type SampleName,
  allergyCounts,
  changesSince,
  dietCounts,
  linesFor,
} from './kitchenChanges.ts';

const NAMES = { names: true, erased: new Set<string>() };
const COUNTS = { names: false, erased: new Set<string>() };

function texts(copy: Figures, now: Figures, reading = NAMES): string[] {
  return changesSince(copy, now, reading).map((line) => line.text);
}

function withItems(items: readonly Item[]): Figures {
  return { ...BASE, items };
}

describe('Changes since: each sample in the sheet’s order (sc-30692)', () => {
  it('names the person with guests.manage, allergies first, then diets, coming and each course', () => {
    expect(linesFor('named', false, true).map((line) => line.text)).toEqual([
      'New allergy: Sesame (Yusuf Ibrahim)',
      'New diet: Halal (Ngozi Eze)',
      '2 more coming',
      'Pepper soup 50 to 52',
      'Jollof rice with chicken 45 to 48',
      'Grilled sea bass 31 to 30',
      'Chocolate tart 51 to 53',
    ]);
  });

  it('gives a count per code and no name without guests.manage', () => {
    expect(linesFor('named', false, false).map((line) => line.text)).toEqual([
      'New allergy: Sesame (1 guest)',
      'New diet: Halal (1 guest)',
      '2 more coming',
      'Pepper soup 50 to 52',
      'Jollof rice with chicken 45 to 48',
      'Grilled sea bass 31 to 30',
      'Chocolate tart 51 to 53',
    ]);
  });

  it('says a new, a removed and a renamed dish, the rename before its count, the removed after its course’s dishes', () => {
    expect(linesFor('menu', false, true).map((line) => line.text)).toEqual([
      'Burrata with peaches 41 to 35',
      'Added: Moi moi, 6',
      'Renamed: Grilled sea bass, now Pan-seared sea bass',
      'Pan-seared sea bass 30 to 32',
      'Removed: Mushroom risotto, was 15',
      'Not chosen yet 3 to 16',
    ]);
  });

  it('names a variant and a side after their dish, and Renamed names the dish once', () => {
    expect(linesFor('variantSide', false, true).map((line) => line.text)).toEqual([
      'Jollof rice · Chicken 28 to 30',
      'Renamed: Jollof rice · Fish, now Sea bass',
      'Jollof rice · Sea bass 20 to 18',
      'Jollof rice · Plantain 33 to 35',
    ]);
  });

  it('takes a leaver’s allergy and diet and brings a newcomer’s, under the names rule', () => {
    expect(linesFor('person', false, true).map((line) => line.text)).toEqual([
      'New allergy: Sesame (Ngozi Eze)',
      'Allergy removed: Peanuts (Inês Duarte)',
      'New diet: Vegetarian (Ngozi Eze)',
      'Diet removed: Halal (Inês Duarte)',
      'Jollof rice with chicken 47 to 48',
      'Grilled sea bass 31 to 30',
      'Chocolate tart 54 to 53',
      'Fruit plate 39 to 40',
    ]);
    expect(
      linesFor('person', false, false)
        .slice(0, 4)
        .map((line) => line.text),
    ).toEqual([
      'New allergy: Sesame (1 guest)',
      'Allergy removed: Peanuts (1 guest)',
      'New diet: Vegetarian (1 guest)',
      'Diet removed: Halal (1 guest)',
    ]);
  });

  it('never nets a count: one guest’s Peanuts removed and another’s recorded is two lines', () => {
    expect(linesFor('swap', false, false).map((line) => line.text)).toEqual([
      'New allergy: Peanuts (1 guest)',
      'Allergy removed: Peanuts (1 guest)',
    ]);
    expect(linesFor('swap', false, true).map((line) => line.text)).toEqual([
      'Allergy removed: Peanuts (Amaka Eze)',
      'New allergy: Peanuts (Sophie Laurent)',
    ]);
  });

  it('says an allergy changed from one code to another as two lines', () => {
    const now = {
      ...BASE,
      needs: BASE.needs.map((one) =>
        one.guest === 'g-amaka' ? { ...one, allergies: ['sesame'] } : one,
      ),
    };

    expect(texts(BASE, now)).toEqual([
      'New allergy: Sesame (Amaka Eze)',
      'Allergy removed: Peanuts (Amaka Eze)',
    ]);
    expect(texts(BASE, now, COUNTS)).toEqual([
      'New allergy: Sesame (1 guest)',
      'Allergy removed: Peanuts (1 guest)',
    ]);
  });

  it('puts a count of more than 1 in the plural, on guest only', () => {
    const now = {
      ...BASE,
      needs: BASE.needs.map((one) =>
        one.allergies.includes('peanut') ? { ...one, allergies: [] } : one,
      ),
      otherDiets: { ...BASE.otherDiets, halal: 20 },
    };

    expect(texts(BASE, now, COUNTS)).toEqual([
      'Allergy removed: Peanuts (3 guests)',
      'New diet: Halal (2 guests)',
    ]);
  });

  it('counts an erased guest for every reader, beside a named change', () => {
    expect(linesFor('erased', false, true).map((line) => line.text)).toEqual([
      'New allergy: Sesame (Yusuf Ibrahim)',
      'Allergy removed: Shellfish (1 guest)',
      '1 fewer coming',
      'Burrata with peaches 42 to 41',
      'Mushroom risotto 16 to 15',
      'Chocolate tart 54 to 53',
    ]);
    expect(linesFor('erased', false, true).some((line) => line.text.includes('Kwame'))).toBe(false);
  });

  it('has no line once the copy holds every change', () => {
    for (const sample of Object.keys(SAMPLES) as SampleName[])
      expect(linesFor(sample, true, true)).toEqual([]);
  });
});

describe('Changes since: what counts as a change', () => {
  const tart = BASE.items.find((one) => one.id === 'd-tart') as Item;

  it('is no change when a figure moved and moved back, or a dish was renamed and back', () => {
    expect(texts(BASE, { ...BASE })).toEqual([]);
  });

  it('says a count of 1 and of more than 1, up and down', () => {
    expect(texts({ ...BASE, coming: 95 }, BASE, COUNTS)).toEqual(['1 more coming']);
    expect(texts({ ...BASE, coming: 99 }, BASE, COUNTS)).toEqual(['3 fewer coming']);
  });

  it('reads a dish added then renamed since the copy as Added, with its name now', () => {
    const now = withItems([...BASE.items, { ...tart, id: 'd-new', name: 'Puff puff', count: 4 }]);

    expect(texts(BASE, now)).toEqual(['Added: Puff puff, 4']);
  });

  it('is no change for a dish at 0 on both sides, and no line for one removed at 0', () => {
    const zero = { ...tart, id: 'd-zero', name: 'Ice cream', count: 0 };

    expect(texts(BASE, withItems([...BASE.items, zero]))).toEqual([]);
    expect(texts(withItems([...BASE.items, zero]), BASE)).toEqual([]);
  });

  it('matches by record, never by name: a new dish with an old dish’s name is Added', () => {
    const copy = withItems(BASE.items.filter((one) => one.id !== 'd-fruit'));
    const now = withItems(
      BASE.items.map((one) => (one.id === 'd-fruit' ? { ...one, name: 'Chocolate tart' } : one)),
    );

    expect(texts(copy, now)).toEqual(['Added: Chocolate tart, 40']);
  });

  it('puts a whole course gone after the courses still there, as the copy named it', () => {
    const now = {
      ...BASE,
      courses: BASE.courses.filter((course) => course.id !== 's'),
      items: BASE.items
        .filter((one) => one.course !== 's')
        .map((one) => (one.id === 'd-tart' ? { ...one, count: 54 } : one)),
    };

    expect(texts(BASE, now)).toEqual([
      'Chocolate tart 53 to 54',
      'Removed: Pepper soup, was 52',
      'Removed: Burrata with peaches, was 41',
    ]);
  });

  it('counts a diet among the guests with no allergy, who are never named', () => {
    const copy = { ...BASE, otherDiets: { ...BASE.otherDiets, halal: 17, vegan: 5 } };

    expect(texts(copy, BASE)).toEqual([
      'New diet: Halal (1 guest)',
      'Diet removed: Vegan (1 guest)',
    ]);
    expect(texts(copy, BASE, COUNTS)).toEqual([
      'New diet: Halal (1 guest)',
      'Diet removed: Vegan (1 guest)',
    ]);
  });

  it('keeps a 120-character dish and a 60-character variant whole when renamed', () => {
    expect(LONG_NAMES.dish).toHaveLength(119);
    expect(LONG_NAMES.dishWas).toHaveLength(120);
    expect(LONG_NAMES.side).toHaveLength(60);
    expect(linesFor('long', false, true).map((line) => line.text)).toEqual([
      `Renamed: ${LONG_NAMES.dishWas}, now ${LONG_NAMES.dish}`,
      `Renamed: ${LONG_NAMES.dish} · ${LONG_NAMES.sideWas}, now ${LONG_NAMES.side}`,
    ]);
  });

  it('never counts a course’s name or order as a change', () => {
    const now = {
      ...BASE,
      courses: [...BASE.courses]
        .reverse()
        .map((course) => ({ ...course, name: `${course.name}s` })),
    };

    expect(texts(BASE, now)).toEqual([]);
  });

  it('names a variant after its dish’s name now, in Removed too', () => {
    const copy = withItems([
      ...BASE.items,
      { ...tart, id: 'd-tart-v', kind: 'variant', parent: 'd-tart', name: 'Vegan', count: 5 },
    ]);
    const now = withItems(
      BASE.items.map((one) =>
        one.id === 'd-tart' ? { ...one, name: 'Dark chocolate tart' } : one,
      ),
    );

    expect(texts(copy, now)).toEqual([
      'Renamed: Chocolate tart, now Dark chocolate tart',
      'Removed: Dark chocolate tart · Vegan, was 5',
    ]);
  });
});

describe('Changes since: every line agrees with the sheet under it', () => {
  function courseSums(figures: Figures): number[] {
    return figures.courses.map((course) =>
      figures.items
        .filter((one) => one.course === course.id && one.kind !== 'variant' && one.kind !== 'side')
        .reduce((sum, one) => sum + one.count, 0),
    );
  }

  it('adds each course up to the number coming, on the copy and now', () => {
    for (const sample of Object.values(SAMPLES)) {
      expect(courseSums(sample.copy).every((sum) => sum === sample.copy.coming)).toBe(true);
      expect(courseSums(sample.now).every((sum) => sum === sample.now.coming)).toBe(true);
    }
  });

  it('keeps the sheet’s figures: 96 coming, Halal 18, seven or six with allergies', () => {
    expect(SAMPLES.named.now.coming).toBe(96);
    expect(dietCounts(SAMPLES.named.now)).toContainEqual(['halal', 18]);
    expect(dietCounts(SAMPLES.named.copy)).toContainEqual(['halal', 17]);
    expect(allergyCounts(SAMPLES.named.now)).toContainEqual(['sesame', 1]);
    expect(dietCounts(SAMPLES.person.now)).toContainEqual(['vegetarian', 12]);
    expect(allergyCounts(SAMPLES.erased.now).reduce((sum, [, n]) => sum + n, 0)).toBe(6);
  });
});
