import { describe, expect, it } from 'vitest';

import {
  chairsTakePointer,
  type Item,
  type Point,
  keepsClear,
  newItem,
  EVENT_DAY,
  MADE_AT,
  asOf,
  eventDay,
  SEATING_PAGES,
  CRUMB_WORDS,
  LONG_NAME,
  crumbOf,
  SEATING_STATES,
  SW,
  bounds,
  chairsOf,
  deletePlanWords,
  extent,
  feet,
  filled,
  fitOf,
  focusReach,
  intoView,
  inside,
  keepSeats,
  marksOf,
  leastUsed,
  many,
  seatChosenWords,
  metres,
  nearestFree,
  nextName,
  overlap,
  percentOf,
  percentWritten,
  planCounts,
  planFitOf,
  readFeet,
  readItemSize,
  readEnds,
  readTableSeats,
  readTableSize,
  readMetres,
  readRoom,
  readingOrder,
  reshaped,
  sampleItems,
  samplePlan,
  sampleTray,
  unsureLeft,
  peopleIn,
  sectionDeleteWords,
  sectionLine,
  sideBySide,
  squeezed,
  usable,
  detailOf,
  endsLine,
} from './seating.ts';
import { seedOf } from './seatingSeed.ts';

function byId(id: string): Item {
  return sampleItems().find((item) => item.id === id)!;
}

describe('the sample (seating-a-spec §8)', () => {
  it('counts the wedding as Messaging B does: 96 coming, 84 seated and 12 without a seat', () => {
    const items = sampleItems();
    const seats = items.reduce((sum, item) => sum + item.chairs.length, 0);
    const taken = items.reduce(
      (sum, item) => sum + item.chairs.filter((chair) => chair.state === 'taken').length,
      0,
    );
    const coming = sampleTray().filter((party) => party.reply === 'coming');

    expect(seats).toBe(122);
    expect(taken).toBe(84);
    expect(coming.reduce((sum, party) => sum + peopleIn(party), 0)).toBe(12);
    expect(taken + 12).toBe(96);
    expect(items.filter((item) => item.kind !== 'row' && item.kind !== 'single')).toHaveLength(13);
  });

  it('has one unusable chair, one held, and 36 seats free', () => {
    const items = sampleItems();
    const free = items.reduce(
      (sum, item) => sum + item.chairs.filter((chair) => chair.state === 'empty').length,
      0,
    );

    expect(byId('t3').chairs[6]?.state).toBe('unusable');
    expect(byId('t7').chairs[7]?.state).toBe('held');
    expect(free).toBe(36);
    expect(`${filled(byId('t3'))} of ${usable(byId('t3'))}`).toBe('8 of 9');
  });

  it('seats nobody twice', () => {
    const named = sampleItems().flatMap((item) =>
      item.chairs.flatMap((chair) => (chair.who == null ? [] : [chair.who])),
    );
    const waiting = sampleTray().flatMap((party) => [
      party.name,
      ...party.companions.filter((one) => !one.startsWith('Guest of')),
    ]);

    expect(new Set(named).size).toBe(named.length);
    expect(waiting.filter((name) => named.includes(name))).toEqual([]);
    expect(
      byId('rowA')
        .chairs.slice(0, 4)
        .map((chair) => chair.who),
    ).toEqual(['Priyanka Nair', 'Yuki Tanaka', 'Emeka Obi', 'Lars Johansson']);
  });

  it('counts 31 not sure yet or with no reply, the tray listing two of them', () => {
    expect(unsureLeft(sampleTray())).toBe(31);
    expect(sampleTray().filter((party) => party.reply !== 'coming')).toHaveLength(2);
  });

  it('names each section with its colour and its counts', () => {
    const plan = samplePlan();

    expect(sectionLine(plan, 'stage')).toBe('Plum · 5 tables · 50 seats');
    expect(sectionLine(plan, 'garden')).toBe('Teal · 5 tables · 48 seats');
    expect(sectionLine(plan, 'bar')).toBe('Olive · 2 tables · 8 seats');
    expect(sectionLine(plan, null)).toBe('1 table · 1 row · 2 single seats · 16 seats');
    expect(planCounts(plan)).toBe('3 sections, 13 tables, 1 row and 2 single seats');
    expect(readRoom('5', 'width', 'us')).toEqual({ refused: 'Use 7 to 1,640 ft.' });
    expect(readRoom('80 ft', 'width', 'us')).toEqual({ cm: 2438 });
  });
});

describe('deleting a section names what loses it (sc-54060)', () => {
  const into = (ids: readonly string[]) =>
    samplePlan().items.map((item) => ({ ...item, sec: ids.includes(item.id) ? 'quiet' : null }));
  const firstTables = (n: number) =>
    samplePlan()
      .items.filter((item) => item.kind !== 'row' && item.kind !== 'single')
      .slice(0, n)
      .map((item) => item.id);

  it('names each kind alone, the verb from the total', () => {
    expect(sectionDeleteWords(into(firstTables(3)), 'quiet')).toBe(
      'Its 3 tables stay where they are, with no section.',
    );
    expect(sectionDeleteWords(into(firstTables(1)), 'quiet')).toBe(
      'Its 1 table stays where it is, with no section.',
    );
    expect(sectionDeleteWords(into(['rowA']), 'quiet')).toBe(
      'Its 1 row stays where it is, with no section.',
    );
    expect(sectionDeleteWords(into(['door']), 'quiet')).toBe(
      'Its 1 single seat stays where it is, with no section.',
    );
    expect(sectionDeleteWords(into(['door', 'interp']), 'quiet')).toBe(
      'Its 2 single seats stay where they are, with no section.',
    );
  });

  it('joins the kinds it has, zeros left out, and counts a row once', () => {
    expect(sectionDeleteWords(into([...firstTables(3), 'rowA', 'door']), 'quiet')).toBe(
      'Its 3 tables, 1 row and 1 single seat stay where they are, with no section.',
    );
    expect(sectionDeleteWords(into([...firstTables(1), 'rowA']), 'quiet')).toBe(
      'Its 1 table and 1 row stay where they are, with no section.',
    );
    expect(sectionDeleteWords(into(['rowA', 'door']), 'quiet')).toBe(
      'Its 1 row and 1 single seat stay where they are, with no section.',
    );
  });

  it('says nothing for an empty section', () => {
    expect(sectionDeleteWords(into([]), 'quiet')).toBe('');
  });
});

describe('the room to scale (sc-4007)', () => {
  it('says it for one item outside the room and them for more, as the product does (sc-4000)', () => {
    const sizes = { width: '20 m', length: '18 m' };

    expect(many('shrinkRefused', 1, sizes)).toBe('1 item sits outside 20 m × 18 m. Move it first.');
    expect(many('shrinkRefused', 3, sizes)).toBe(
      '3 items sit outside 20 m × 18 m. Move them first.',
    );
  });

  it('fits the 24 × 18 m room at 57% in the desk’s 718 × 719 room, with 84 above and below', () => {
    const fit = fitOf(718, 719, samplePlan().room!);

    expect(percentOf(fit.s)).toBe(57);
    expect(fit.ox).toBe(16);
  });

  it('fits a 100 × 80 m room at 25%, its centre at the centre of the floor (sc-57678)', () => {
    const fit = planFitOf(718, 719, { name: '', w: 10000, l: 8000 });

    expect(percentOf(fit.s)).toBe(25);
    expect(fit.ox + (10000 * fit.s) / 2).toBe(359);
    expect(fit.oy + (8000 * fit.s) / 2).toBe(359.5);
  });

  it('fits a 2 × 2 m room at 400%, whole and centred (sc-57678)', () => {
    const fit = planFitOf(718, 719, { name: '', w: 200, l: 200 });

    expect(percentOf(fit.s)).toBe(400);
    expect(fit.ox + (200 * fit.s) / 2).toBe(359);
    expect(fit.oy + (200 * fit.s) / 2).toBe(359.5);
  });

  it('fits a room between 25% and 400% as the whole-room fit does (sc-57678)', () => {
    const room = samplePlan().room!;

    expect(planFitOf(718, 719, room)).toEqual(fitOf(718, 719, room));
  });

  it.each([
    ['en', /^150%$/],
    ['es', /^150\s%$/],
    ['fr', /^150\s%$/],
    ['pt', /^150%$/],
  ])('writes the zoom percent the way %s does, as the product does (#2559)', (locale, shown) => {
    expect(percentWritten(150, locale)).toMatch(shown);
  });

  it('slides the picture just enough to show a focused item clear of the bars, and not at all when it shows', () => {
    expect(intoView({ x0: 200, y0: 300, x1: 300, y1: 400 }, 718, 719)).toEqual([0, 0]);
    expect(intoView({ x0: 800, y0: 300, x1: 900, y1: 400 }, 718, 719)).toEqual([-206, 0]);
    expect(intoView({ x0: -400, y0: -50, x1: -300, y1: 50 }, 718, 719)).toEqual([424, 142]);
    expect(intoView({ x0: 100, y0: 600, x1: 200, y1: 700 }, 718, 719)).toEqual([0, -73]);
    expect(intoView({ x0: -900, y0: 300, x1: 900, y1: 400 }, 718, 719)).toEqual([924, 0]);
  });

  it('slides a focused item out from under the small map by the shorter way that stays in view', () => {
    const smallMap = { x0: 530, y0: 507, x1: 702, y1: 639 };

    expect(intoView({ x0: 600, y0: 540, x1: 660, y1: 600 }, 718, 719, [smallMap])).toEqual([
      0, -101,
    ]);
    expect(intoView({ x0: 300, y0: 540, x1: 360, y1: 600 }, 718, 719, [smallMap])).toEqual([0, 0]);
  });

  it('slides a row wider than the view up from under the small map, keeping its left edge, as the product does (sc-57361)', () => {
    const smallMap = { x0: 534, y0: 499, x1: 706, y1: 639 };

    expect(intoView({ x0: -900, y0: 550, x1: 900, y1: 600 }, 718, 719, [smallMap])).toEqual([
      924, -109,
    ]);
  });

  it('slides a box taller than the view sideways clear of a bar, keeping its top edge (sc-57361)', () => {
    const bar = { x0: 24, y0: 200, x1: 80, y1: 500 };

    expect(intoView({ x0: 50, y0: 500, x1: 100, y1: 1400 }, 718, 719, [bar])).toEqual([38, -408]);
  });

  it('lines a wide row up with its top edge when no pan up or down clears the bar (sc-57361)', () => {
    const bar = { x0: 534, y0: 100, x1: 706, y1: 600 };

    expect(intoView({ x0: -900, y0: 300, x1: 900, y1: 400 }, 718, 719, [bar])).toEqual([924, -208]);
  });

  it('reaches 20 px past a focused item for its ring and halo, further once it is turned (sc-57361)', () => {
    const row = { ...newItem('row', [], [0, 0]), rot: 0 };

    expect(focusReach(row)).toBe(20);
    expect(focusReach({ ...row, rot: 90 })).toBeCloseTo(20);
    expect(focusReach({ ...row, rot: 45 })).toBeCloseTo(20 * Math.SQRT2);
  });

  it('draws outlines under 50%, chairs from 50%, and their numbers from 150%', () => {
    expect(detailOf(0.2)).toBe('out');
    expect(detailOf(0.25)).toBe('fit');
    expect(detailOf(0.5)).toBe('fit');
    expect(detailOf(0.75)).toBe('near');
  });

  it('gives a chair the pointer only once it is a 44 target, table by table', () => {
    expect(chairsTakePointer(byId('t1'), 0.5)).toBe(false);
    expect(chairsTakePointer(byId('t1'), 0.75)).toBe(true);
    expect(chairsTakePointer(byId('rowA'), 0.75)).toBe(false);
    expect(chairsTakePointer(byId('rowA'), 1)).toBe(true);
  });

  it('puts seat 1 at the top of a round table and goes clockwise', () => {
    const [first, second] = chairsOf(byId('t1'));

    expect(Math.round(first![0])).toBe(0);
    expect(Math.round(first![1])).toBe(-118);
    expect(second![0]).toBeGreaterThan(0);
  });

  it('splits a long table’s seats down its sides and onto its ends, in words', () => {
    expect(chairsOf(byId('t9'))).toHaveLength(8);
    expect(endsLine(byId('t9'))).toBe('1 on the left end, 1 on the right, 3 and 3 down the sides.');
    expect(endsLine(byId('top'))).toBe('6 along the side facing the room.');
  });

  it('reads the room top to bottom, then left to right', () => {
    const order = readingOrder(sampleItems()).map((item) => item.id);

    expect(order.slice(0, 3)).toEqual(['top', 'interp', 't1']);
    expect(order.indexOf('t4')).toBe(5);
  });
});

describe('moving and overlapping (sc-5028)', () => {
  it('finds an overlap between chairs, and none on the sample', () => {
    const items = sampleItems();

    items.forEach((a, i) => items.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(overlap({ ...byId('t9'), x: 1440, rot: 15 }, byId('t8'))).toBe(true);
  });

  it('keeps everything inside the walls', () => {
    const room = samplePlan().room!;

    expect(inside(byId('t5'), room)).toBe(true);
    expect(inside({ ...byId('t5'), x: 2350 }, room)).toBe(false);
    expect(bounds(byId('t1')).x0).toBe(420 - extent(byId('t1'))[0]);
  });

  it('places something new in the nearest free space', () => {
    const plan = samplePlan();
    const [x, y] = nearestFree(
      { ...byId('t1'), id: 'new', chairs: byId('t1').chairs },
      plan.items,
      plan.room!,
      [1200, 620],
    );
    const placed = { ...byId('t1'), id: 'new', x, y };

    expect(plan.items.some((item) => overlap(placed, item))).toBe(false);
    expect(inside(placed, plan.room!)).toBe(true);
  });

  it('keeps rows 90 cm apart and a single seat clear of the last one and its name', () => {
    const room = { name: 'Hall', w: 2400, l: 1800 };
    const centre: Point = [1200, 900];
    const rowA = { ...newItem('row', [], centre), x: 1200, y: 900 };
    const rowB = newItem('row', [rowA], centre);
    const [, by] = nearestFree(rowB, [rowA], room, centre);

    expect(by - rowA.y).toBe(90);

    const one = { ...newItem('single', [], centre), x: 1200, y: 900 };
    const two = newItem('single', [one], centre);
    const [tx, ty] = nearestFree(two, [one], room, centre);
    const placed = { ...two, x: tx, y: ty };

    expect([tx, ty]).toEqual([1200, 990]);
    expect(keepsClear(placed, [one])).toBe(true);
    expect(keepsClear({ ...placed, x: 1260, y: 900 }, [one])).toBe(false);
  });

  it('falls back to no overlap when nothing keeps the clearance', () => {
    const room = { name: 'Box', w: 140, l: 60 };
    const one = { ...newItem('single', [], [30, 30]), x: 30, y: 30 };
    const [x, y] = nearestFree(newItem('single', [one], [30, 30]), [one], room, [30, 30]);
    const placed = { ...newItem('single', [one], [30, 30]), x, y };

    expect(overlap(placed, one)).toBe(false);
    expect(inside(placed, room)).toBe(true);
  });

  it('places every new row and seat quickly, even once the hall is full', () => {
    const room = { name: 'Hall', w: 2400, l: 1800 };
    const centre: Point = [1200, 900];
    const items: Item[] = [];
    let slowest = 0;

    for (let n = 0; n < 120; n += 1) {
      const draft = newItem(n % 3 === 2 ? 'single' : 'row', items, centre);
      const began = performance.now();
      const [x, y] = nearestFree(draft, items, room, centre);

      slowest = Math.max(slowest, performance.now() - began);
      items.push({ ...draft, x, y });
    }

    expect(items.some((item) => !keepsClear(item, items))).toBe(true);
    expect(items.every((item) => inside(item, room))).toBe(true);
    expect(slowest).toBeLessThan(500);
  }, 30_000);

  it('names the next table, row and seat by the first free number or letter', () => {
    const items = sampleItems();

    expect(nextName(items, 'round').name).toBe('Table 11');
    expect(nextName(items, 'row')).toEqual({ name: 'Row B', label: 'B' });
    expect(nextName(items, 'single').name).toBe('Seat 1');
  });
});

describe('a table’s rules (sc-4000, sc-4003)', () => {
  it('warns below 55 cm a chair, never on a cocktail table', () => {
    expect(squeezed(byId('t1'))).toBe(false);
    expect(squeezed({ ...byId('t10'), d: 150 })).toBe(true);
    expect(squeezed(byId('bar1'))).toBe(false);
    expect(squeezed(reshaped(byId('t10'), 'rect').item)).toBe(true);
  });

  it('resets the size and keeps the seats when the shape changes', () => {
    const { item, note } = reshaped(byId('t10'), 'rect');

    expect(item.w).toBe(180);
    expect(item.l).toBe(76);
    expect(item.chairs).toHaveLength(10);
    expect(note).toBe('Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.');
  });

  it('keeps the seats somebody sits in', () => {
    expect(keepSeats(byId('t4'))).toBe(8);
    expect(keepSeats(byId('rowA'))).toBe(4);
    expect(keepSeats(byId('t10'))).toBe(0);
  });

  it('starts a new section on the least-used colour, first in palette order', () => {
    expect(leastUsed(samplePlan().sections)).toBe('Blue');
    expect(leastUsed([])).toBe('Blue');
  });

  it('seats a party side by side where it can', () => {
    expect(sideBySide(byId('t8'), 2)).toEqual([5, 6]);
    expect(sideBySide(byId('t1'), 1)).toBeNull();
  });
});

describe('sizes in the organisation’s units', () => {
  it('writes metres to the centimetre, and feet and inches to the inch', () => {
    expect(metres(2400)).toBe('24 m');
    expect(metres(1590)).toBe('15.90 m');
    expect(feet(2400)).toBe('78 ft 9 in');
    expect(feet(180)).toBe('5 ft 11 in');
  });

  it('reads feet and inches as the hint says', () => {
    const inches = (cm: number | null) => Math.round((cm ?? 0) / 2.54);

    expect(inches(readFeet('12′ 4″'))).toBe(148);
    expect(inches(readFeet('12 ft 4 in'))).toBe(148);
    expect(inches(readFeet('12.5 ft'))).toBe(150);
    expect(inches(readFeet('148 in'))).toBe(148);
    expect(readFeet('twelve')).toBeNull();
  });

  it('reads Across in metres or centimetres, and refuses a room out of range', () => {
    expect(readMetres('15.9')).toBe(1590);
    expect(readMetres('15.90 m')).toBe(1590);
    expect(readMetres('1590 cm')).toBe(1590);
    expect(readRoom('', 'length')).toEqual({ refused: SW.enterLength });
    expect(readRoom('1.5', 'width')).toEqual({ refused: SW.roomRange });
    expect(readRoom('24', 'width')).toEqual({ cm: 2400 });
  });

  it('refuses a table’s size it can’t read or under 30 cm or 1 ft, beside its field', () => {
    expect(readItemSize('180', 'metric')).toEqual({ cm: 180 });
    expect(readItemSize('29', 'metric')).toEqual({ refused: 'Use 30 cm or more.' });
    expect(readItemSize('wide', 'metric')).toEqual({ refused: 'Use 30 cm or more.' });
    expect(readItemSize('1 ft', 'us')).toEqual({ cm: 30.48 });
    expect(readItemSize('11 in', 'us')).toEqual({ refused: 'Use 1 ft or more.' });
    expect(readItemSize('wide', 'us')).toEqual({
      refused: 'Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.',
    });
  });
});

describe('a table’s limits (sc-4000)', () => {
  it('takes 1 to 30 seats or places, refusing blank, words and out of range', () => {
    expect(readTableSeats('30', false)).toEqual({ n: 30 });
    expect(readTableSeats('31', false)).toEqual({ refused: SW.seatsRange });
    expect(readTableSeats('0', false)).toEqual({ refused: SW.seatsRange });
    expect(readTableSeats('', false)).toEqual({ refused: SW.seatsRange });
    expect(readTableSeats('ten', true)).toEqual({ refused: SW.placesRange });
  });

  it('takes a size from 40 cm to 10 m, or 1 ft 4 in to 32 ft 9 in', () => {
    expect(readTableSize('40', 'metric')).toEqual({ cm: 40 });
    expect(readTableSize('1000', 'metric')).toEqual({ cm: 1000 });
    expect(readTableSize('39', 'metric')).toEqual({ refused: 'Enter a size from 40 cm to 10 m.' });
    expect(readTableSize('1001', 'metric')).toEqual({
      refused: 'Enter a size from 40 cm to 10 m.',
    });
    expect(readTableSize('', 'metric')).toEqual({ refused: 'Enter a size from 40 cm to 10 m.' });
    expect(readTableSize('16 in', 'us')).toEqual({ cm: 40.64 });
    expect(readTableSize('15 in', 'us')).toEqual({
      refused: 'Enter a size from 1 ft 4 in to 32 ft 9 in.',
    });
    expect(readTableSize('33 ft', 'us')).toEqual({
      refused: 'Enter a size from 1 ft 4 in to 32 ft 9 in.',
    });
    expect(readTableSize('wide', 'us')).toEqual({ refused: SW.usHint });
  });

  it('takes 0 to the table’s seats on the ends', () => {
    expect(readEnds('0', 8)).toEqual({ n: 0 });
    expect(readEnds('8', 8)).toEqual({ n: 8 });
    expect(readEnds('9', 8)).toEqual({
      refused: 'Enter 0 to 8, no more than the table has seats.',
    });
    expect(readEnds('', 8)).toEqual({ refused: 'Enter 0 to 8, no more than the table has seats.' });
  });
});

describe('Delete the plan’s ask (pm, 8 Nov 2026)', () => {
  it('names what it deletes, sections counted, then who loses a seat, a held chair too', () => {
    const plan = samplePlan();

    expect(deletePlanWords(plan)).toBe(
      'This also deletes 3 sections, 13 tables, 1 row and 2 single seats. 85 seated guests move to Without a seat; the guest list does not change.',
    );
    expect(deletePlanWords({ ...plan, items: [byId('t7')], sections: [] })).toBe(
      'This also deletes 1 table. 8 seated guests move to Without a seat; the guest list does not change.',
    );
    const heldOnly = {
      ...byId('t7'),
      chairs: byId('t7').chairs.map((chair) =>
        chair.state === 'held' ? chair : { state: 'empty' as const },
      ),
    };

    expect(deletePlanWords({ ...plan, items: [heldOnly], sections: [] })).toBe(
      'This also deletes 1 table. 1 seated guest moves to Without a seat; the guest list does not change.',
    );
    expect(deletePlanWords({ ...plan, items: plan.items.slice(0, 1) })).toBe(
      'This also deletes 3 sections and 1 table. 6 seated guests move to Without a seat; the guest list does not change.',
    );
  });

  it('leaves out a sentence with nothing to say', () => {
    const plan = samplePlan();
    const nobody = plan.items.map((item) => ({
      ...item,
      chairs: item.chairs.map(() => ({ state: 'empty' as const })),
    }));

    expect(deletePlanWords({ ...plan, items: nobody, sections: [] })).toBe(
      'This also deletes 13 tables, 1 row and 2 single seats. The guest list does not change.',
    );
    expect(deletePlanWords({ ...plan, items: [], sections: [] })).toBe(
      'The guest list does not change.',
    );
  });
});

describe('dates on paper (sc-4024)', () => {
  it('says when a document was made in the reader’s locale, on the 24-hour clock', () => {
    expect(asOf(MADE_AT, 'en-US')).toBe('Tuesday, Nov 3, 16:05');
    expect(asOf(MADE_AT, 'en-GB')).toBe('Tuesday 3 Nov, 16:05');
    expect(eventDay(EVENT_DAY, 'en-US')).toBe('Thursday, Nov 5, 2026');
  });
});

describe('the states (§6)', () => {
  it('links every state from the demo’s home, in nine groups', () => {
    const links = SEATING_PAGES.flatMap((page) => page.states);

    expect(SEATING_PAGES).toHaveLength(9);
    expect(links).toHaveLength(SEATING_STATES.length);
    expect(links[0]?.to).toBe('/demo/events/evt-wed-4/seating');
  });

  it('seeds every state without throwing', () => {
    for (const { key } of SEATING_STATES) expect(() => seedOf(key)).not.toThrow();
  });

  it('writes the boards’ words: no em dash, no Maybe, no AM or PM', () => {
    const words = Object.values(SW).join('\n');

    expect(words).not.toMatch(/—/u);
    expect(words).not.toMatch(/\bMaybe\b/u);
    expect(words).not.toMatch(/\b(AM|PM)\b/u);
  });
});

describe('the breadcrumb (sc-55300)', () => {
  it('names the event at the longest an event name may be', () => {
    expect([...LONG_NAME]).toHaveLength(120);
  });

  it('gives the long name and the French words only to their states', () => {
    expect(crumbOf('plan', 'Wedding')).toEqual({ name: 'Wedding', lang: 'en' });
    expect(crumbOf('longName', 'Wedding')).toEqual({ name: LONG_NAME, lang: 'en' });
    expect(crumbOf('longNameFr', 'Wedding')).toEqual({ name: LONG_NAME, lang: 'fr' });
    expect(CRUMB_WORDS.fr).toEqual({
      crumb: 'Fil d’Ariane',
      events: 'Événements',
      area: 'Plan de table',
    });
  });
});

describe('a colleague’s marks on Tables and the List (sc-60717)', () => {
  const ana = { name: 'Ana Souza', initials: 'AS', tone: 2, viewer: false };
  const sade = { name: 'Sade Bello', initials: 'SB', tone: 1, viewer: true };
  const rings = { t7: [{ who: sade }, { who: ana, seat: 2 }] };

  it('never marks a viewer’s choice, and marks nothing while reconnecting', () => {
    expect(marksOf(rings, 'chips', 't7').map((one) => one.who.name)).toEqual(['Ana Souza']);
    expect(marksOf(rings, 'reconnecting', 't7')).toEqual([]);
    expect(marksOf(rings, 'chips', 'nothing')).toEqual([]);
  });

  it('names who chose a chair, and nobody on another', () => {
    const marks = marksOf(rings, 'chips', 't7');

    expect(seatChosenWords(marks, 2)).toBe(', chosen by Ana Souza');
    expect(seatChosenWords(marks, 0)).toBe('');
  });
});
