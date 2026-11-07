import { describe, expect, it } from 'vitest';

import {
  type Item,
  SEATING_PAGES,
  SEATING_STATES,
  SW,
  bounds,
  chairsOf,
  extent,
  feet,
  filled,
  fitOf,
  inside,
  keepSeats,
  leastUsed,
  metres,
  nearestFree,
  nextName,
  overlap,
  percentOf,
  planCounts,
  readFeet,
  readMetres,
  readRoom,
  readingOrder,
  reshaped,
  sampleItems,
  samplePlan,
  sampleTray,
  peopleIn,
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

  it('names each section with its colour and its counts', () => {
    const plan = samplePlan();

    expect(sectionLine(plan, 'stage')).toBe('Plum · 5 tables · 50 seats');
    expect(sectionLine(plan, 'garden')).toBe('Teal · 5 tables · 48 seats');
    expect(sectionLine(plan, 'bar')).toBe('Olive · 2 tables · 8 seats');
    expect(sectionLine(plan, null)).toBe('1 table · 1 row · 2 single seats · 16 seats');
    expect(planCounts(plan)).toBe('13 tables, 1 row, and 84 seated guests');
  });
});

describe('the room to scale (sc-4007)', () => {
  it('fits the 24 × 18 m room at 57% in the desk’s 718 × 719 room, with 84 above and below', () => {
    const fit = fitOf(718, 719, samplePlan().room!);

    expect(percentOf(fit.s)).toBe(57);
    expect(fit.ox).toBe(16);
  });

  it('draws outlines under 50%, chairs from 50%, and 44 targets from 150%', () => {
    expect(detailOf(0.2)).toBe('out');
    expect(detailOf(0.25)).toBe('fit');
    expect(detailOf(0.5)).toBe('fit');
    expect(detailOf(0.75)).toBe('near');
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
});

describe('the states (§6)', () => {
  it('links every state from the demo’s home, in seven groups', () => {
    const links = SEATING_PAGES.flatMap((page) => page.states);

    expect(SEATING_PAGES).toHaveLength(7);
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
