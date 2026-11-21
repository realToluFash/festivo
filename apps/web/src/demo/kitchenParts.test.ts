import { describe, expect, it } from 'vitest';

import { BASE, allergic, dietCounts } from './kitchenChanges.ts';
import {
  type Guest,
  type PartsCourse,
  type Room,
  PARTS_FIGURES,
  PARTS_SAMPLES,
  PW,
  byTable,
  counted,
  courseRows,
  courseSheet,
  mainCourse,
  mainRoom,
  platedAtPass,
  pw,
  wayWord,
} from './kitchenParts.ts';

function sheet(name: keyof typeof PARTS_SAMPLES) {
  const { course, room } = PARTS_SAMPLES[name]();

  return courseSheet(course, room);
}

function row(name: keyof typeof PARTS_SAMPLES, dish: string) {
  return sheet(name).rows.find((one) => one.name === dish);
}

describe('the Main’s sample room', () => {
  it('seats 96, as the sheet’s card says, with an allergy or a diet for 40', () => {
    const room = mainRoom();
    const dietOnly = Object.values(PARTS_FIGURES.otherDiets).reduce((a, b) => a + b, 0);

    expect(room.guests).toHaveLength(PARTS_FIGURES.coming);
    expect(room.guests.filter((guest) => guest.allergies.length > 0)).toHaveLength(
      allergic(PARTS_FIGURES).length,
    );
    expect(
      room.guests.filter((guest) => guest.allergies.length === 0 && guest.diets.length > 0),
    ).toHaveLength(dietOnly);
  });

  it('keeps the Diets block’s counts with one allergic guest also Halal', () => {
    expect(dietCounts(PARTS_FIGURES)).toEqual(dietCounts(BASE));
  });
});

describe('part totals on an In parts course (sc-34244)', () => {
  it('lists each dish’s parts under it in the menu’s order, a choice by option, None for me on no line', () => {
    expect(row('inParts', 'Jollof rice')).toMatchObject({
      count: 43,
      parts: ['Rice · 43', 'Chicken · 43', 'Plantain 24 · Salad 11 · Moi moi 6'],
    });
  });

  it('sums a dish’s variants into its parts', () => {
    const fish = row('inParts', 'Grilled fish');
    const variants = sheet('inParts').rows.filter((one) => one.kind === 'variant');

    expect(variants.map((one) => one.count).reduce((a, b) => a + b, 0)).toBe(fish?.count);
    expect(fish?.parts).toEqual(['Fish · 33', 'Pepper sauce · 33', 'Yam chips · 33']);
  });

  it('keeps a dish with no parts as sc-3911’s row alone', () => {
    expect(row('inParts', 'Mushroom risotto')).toMatchObject({ count: 13, parts: [] });
  });

  it('keeps sc-3911’s rows with no dish, each only when not zero', () => {
    const tails = sheet('inParts').rows.filter((one) => one.kind === 'tail');

    expect(tails.map((one) => [one.name, one.count])).toEqual([
      [PW.kitchensChoice, 2],
      [PW.needsHost, 1],
      [PW.notChosen, 4],
    ]);
  });

  it('gives Served with this course everyone counted, and Plated at the pass each guest once', () => {
    expect(sheet('inParts').servedWith).toEqual(['Drink · 96']);
    expect(sheet('inParts').plated).toBe('Plated at the pass · 45');
  });

  it('counts a guest with an allergy record and a diet record as one plate', () => {
    const course = mainCourse('in_parts');
    const jollof = { dish: course.dishes[0]?.id ?? '', variant: null, answers: {} };
    const both: Guest = {
      id: 'g-amaka',
      table: 't1',
      allergies: ['peanut', 'sesame'],
      diets: ['halal'],
      pick: jollof,
    };
    const none: Guest = { id: 'g-ada', table: 't1', allergies: [], diets: [], pick: jollof };
    const room: Room = { tables: [], guests: [both, none] };

    expect(courseSheet(course, room).plated).toBe('Plated at the pass · 1');
  });

  it('names the way on the course, and nothing on a Plated or Buffet one', () => {
    expect(wayWord(mainCourse('in_parts'))).toBe(PW.inParts);
    expect(wayWord(mainCourse('family_style'))).toBe(PW.familyStyle);
    expect(wayWord(mainCourse('plated'))).toBeNull();
    expect(wayWord(mainCourse('buffet'))).toBeNull();
  });
});

describe('a guest who skipped the course', () => {
  it('is counted nowhere in this story: parts, Served with and the plated drop together', () => {
    const was = sheet('inParts');
    const now = sheet('skipped');

    expect(now.rows.find((one) => one.name === PW.skipped)?.count).toBe(2);
    expect(now.rows.find((one) => one.name === 'Jollof rice')?.parts).toEqual([
      'Rice · 41',
      'Chicken · 41',
      'Plantain 22 · Salad 11 · Moi moi 6',
    ]);
    expect(now.servedWith).toEqual(['Drink · 94']);
    expect(was.plated).toBe('Plated at the pass · 45');
    expect(now.plated).toBe('Plated at the pass · 44');
  });
});

describe('By table on a Family style course (sc-34244)', () => {
  const { course, room } = PARTS_SAMPLES.familyStyle();
  const tables = byTable(course, room);

  it('lists tables in natural order, leaves out a Plated at and a fully plated table, No table last', () => {
    expect(tables.map((one) => one.name)).toEqual([
      'Table 1',
      'Table 2',
      'Table 3',
      'Table 4',
      'Table 5',
      'Table 6',
      'Table 8',
      'Table 9',
      'Table 10',
      PW.noTable,
    ]);
  });

  it('groups a table’s parts under their dish, and None for me is no count', () => {
    expect(tables.find((one) => one.name === 'Table 1')?.lines).toEqual([
      'Jollof rice: Rice 4 · Chicken 4 · Plantain 2 · Salad 1',
      'Grilled fish: Fish 1 · Pepper sauce 1 · Yam chips 1',
    ]);
  });

  it('never adds two dishes’ parts of one name together', () => {
    const rice = { kind: 'fixed', name: 'Rice' } as const;
    const two: PartsCourse = {
      ...course,
      platedAt: [],
      dishes: [
        {
          id: 'a',
          name: 'Jollof rice',
          variants: [],
          parts: [rice, { kind: 'fixed', name: 'Chicken' }],
        },
        {
          id: 'b',
          name: 'Fried rice',
          variants: [],
          parts: [rice, { kind: 'fixed', name: 'Beef' }],
        },
      ],
    };
    const eats = (id: string, dish: string): Guest => ({
      id,
      table: 't1',
      allergies: [],
      diets: [],
      pick: { dish, variant: null, answers: {} },
    });
    const one: Room = {
      tables: [{ id: 't1', name: 'Table 1' }],
      guests: [eats('g1', 'a'), eats('g2', 'a'), eats('g3', 'b')],
    };

    expect(byTable(two, one)[0]?.lines).toEqual([
      'Jollof rice: Rice 2 · Chicken 2',
      'Fried rice: Rice 1 · Beef 1',
    ]);
  });

  it('adds Kitchen’s choice, Needs the host and not chosen yet after the dishes, each when not zero', () => {
    expect(tables.find((one) => one.name === 'Table 3')?.lines.at(-1)).toBe('Kitchen’s choice 1');
    expect(tables.find((one) => one.name === 'Table 6')?.lines.at(-1)).toBe('Needs the host 1');
    expect(tables.find((one) => one.name === PW.noTable)?.lines).toEqual([
      'Jollof rice: Rice 2 · Chicken 2 · Plantain 1 · Salad 1',
      'Grilled fish: Fish 1 · Pepper sauce 1 · Yam chips 1',
      'Not chosen yet 1',
    ]);
  });

  it('plates the Top table at the pass, so the plated count grows by its platter guests', () => {
    expect(courseSheet(course, room).plated).toBe('Plated at the pass · 51');
  });

  it('keeps Served with this course a course total, on no table’s line', () => {
    expect(tables.flatMap((one) => one.lines).some((line) => line.includes('Drink'))).toBe(false);
    expect(courseSheet(course, room).servedWith).toEqual(['Drink · 96']);
  });

  it('shows no By table when every guest is plated at the pass', () => {
    const all = PARTS_SAMPLES.allPlated();

    expect(byTable(all.course, all.room)).toEqual([]);
    expect(courseSheet(all.course, all.room).plated).toBe('Plated at the pass · 96');
  });

  it('puts every platter guest on one line: the table lines add up to the counted guests not plated', () => {
    const platter = counted(room).filter((guest) => !platedAtPass(course, guest));
    const onLines = tables
      .flatMap((one) => one.lines)
      .map((line) => {
        const [, first] = /^[^:]+: \D+(\d+)/u.exec(line) ?? [];
        const [, tail] = /(\d+)$/u.exec(line) ?? [];

        return Number(first ?? tail);
      })
      .reduce((a, b) => a + b, 0);

    expect(onLines).toBe(platter.length);
  });
});

describe('a Plated or Buffet course, exactly as sc-3911', () => {
  it('gives the rows alone: no parts, no Served with, no plated count, no By table', () => {
    for (const way of ['plated', 'buffet'] as const) {
      const course: PartsCourse = { ...mainCourse(way), platedAt: ['top'] };
      const made = courseSheet(course, mainRoom());

      expect(made.rows.every((one) => one.parts.length === 0)).toBe(true);
      expect(made).toMatchObject({ servedWith: [], plated: null, byTable: [] });
    }
  });

  it('counts the same dishes and rows whichever way the course is served', () => {
    const plated = courseRows(mainCourse('plated'), mainRoom());
    const parts = courseRows(mainCourse('family_style'), mainRoom());

    expect(parts.map(({ name, count }) => [name, count])).toEqual(
      plated.map(({ name, count }) => [name, count]),
    );
  });
});

describe('the words', () => {
  it('fills a dish’s platter line from its parts', () => {
    expect(pw(PW.dishParts, { dish: 'Jollof rice', parts: 'Rice 9' })).toBe('Jollof rice: Rice 9');
  });
});
