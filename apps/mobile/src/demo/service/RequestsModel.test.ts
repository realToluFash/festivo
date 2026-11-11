import { describe, expect, it } from 'vitest';

import {
  EMPTY_FORM,
  ME,
  STAFFED,
  THE_LEAD,
  TRAYS,
  actions,
  check,
  dishOptions,
  noSeatCanChange,
  nextOrder,
  otherLine,
  ownerLine,
  refusal,
  requests,
  routeLine,
  seatWhy,
  table12,
  table7,
  table9,
} from './RequestsModel.ts';

const byId = (id: string) => {
  const r = requests().find((q) => q.id === id);
  if (r == null) throw new Error(id);
  return r;
};

describe('who has which buttons', () => {
  it('offers an open request to anyone, and its taker or service.manage closes it', () => {
    expect(actions(byId('chair'), ME)).toEqual(['take', 'decline']);
    expect(actions(byId('stew'), ME)).toEqual(['done', 'decline']);
    expect(actions(byId('blind'), ME)).toEqual([]);
    expect(actions(byId('blind'), THE_LEAD)).toEqual(['done', 'decline']);
    expect(actions(byId('bread'), THE_LEAD)).toEqual([]);
  });

  it('leaves a moment to the floor lead', () => {
    expect(actions(byId('song'), ME)).toEqual([]);
    expect(actions(byId('song'), THE_LEAD)).toEqual(['done', 'decline']);
    expect(ownerLine(byId('song'), ME)).toBe('With Ifeoma Nduka, floor lead · open 16 min');
  });

  it('names who is on it, with how long it has been open', () => {
    expect(ownerLine(byId('chair'), ME)).toBe('Nobody on it · open 12 min');
    expect(ownerLine(byId('stew'), ME)).toBe('You’re on it · open 8 min');
    expect(ownerLine(byId('blind'), ME)).toBe('Grace Udo is on it · open 6 min');
  });
});

describe('Next', () => {
  it('puts the tray in hand and a given tray first, then your requests oldest first, then the next tray', () => {
    const order = nextOrder(TRAYS, requests(), ME, STAFFED).map((i) =>
      i.kind === 'request' ? i.request.id : i.kind,
    );
    expect(order).toEqual(['inHand', 'given', 'napkin', 'chair', 'stew', 'bill', 'nextTray']);
  });

  it('never shows a moment, somebody else’s request or a closed one', () => {
    const ids = nextOrder(TRAYS, requests(), ME, STAFFED).flatMap((i) =>
      i.kind === 'request' ? [i.request.id] : [],
    );
    expect(ids).not.toContain('song');
    expect(ids).not.toContain('blind');
    expect(ids).not.toContain('bread');
    expect(ids).not.toContain('water');
  });

  it('gives the floor lead an untaken request at a station with nobody on it', () => {
    const lone = { ...byId('chair'), id: 'c', table: 'Table 12', section: 'C' };
    const ids = (v: typeof ME) =>
      nextOrder({ inHand: null, given: null, next: null }, [lone], v, STAFFED).length;
    expect(ids(THE_LEAD)).toBe(1);
    expect(ids(ME)).toBe(0);
  });
});

describe('Change a plate', () => {
  it('offers a course not yet fired, and a fired one only while the seat’s order is To serve', () => {
    const t = table9();
    const courses = (n: number) => dishOptions(t, t.seats[n - 1]!).map((c) => c.course.name);
    expect(courses(1)).toEqual(['Mains', 'Dessert']);
    expect(courses(2)).toEqual(['Dessert']);
    expect(courses(6)).toEqual(['Mains', 'Dessert']);
  });

  it('leaves out what the guest has now, and lists each variant', () => {
    const t = table9();
    const mains = dishOptions(t, t.seats[0]!)[0]!.dishes.map((d) => d.dish.name);
    expect(mains).not.toContain('Grilled fish · pepper sauce');
    expect(mains).toContain('Grilled fish · groundnut sauce');
  });

  it('refuses an allergen by name, by seat where no name is returned, and allergens not stated', () => {
    const t = table9();
    const dish = (n: string) =>
      dishOptions(t, t.seats[0]!)
        .flatMap((c) => c.dishes)
        .find((d) => d.dish.name === n);
    expect(dish('Grilled fish · groundnut sauce')?.refused).toBe(
      'Not for Mrs. Funke Adeyemi · Peanut allergy',
    );
    expect(dish('Goat curry')?.refused).toBe('Not for Mrs. Funke Adeyemi · allergens not stated');
    const puff = dishOptions(t, t.seats[4]!)
      .flatMap((c) => c.dishes)
      .find((d) => d.dish.name === 'Puff-puff');
    expect(puff?.refused).toBe('Not for seat 5 · Sesame allergy');
  });

  it('refuses nothing for a diet, and says an Other allergy isn’t checked', () => {
    const t = table9();
    expect(
      dishOptions(t, t.seats[1]!)
        .flatMap((c) => c.dishes)
        .every((d) => d.refused == null),
    ).toBe(true);
    expect(
      refusal(t.seats[3]!, { name: 'Goat curry', course: 'mains', contains: null, suitable: [] }),
    ).toBeNull();
    expect(otherLine(t.seats[3]!)).toBe(
      'Adaora Eze’s other allergy, kiwi, isn’t checked against the menu.',
    );
  });

  it('says why a seat can’t be chosen, and when no seat can', () => {
    const t = table7();
    expect(seatWhy(t, t.seats[0]!)).toBe(
      'Seat 1 · nothing can change: Mains is Served, Dessert is Served.',
    );
    expect(seatWhy(t, t.seats[1]!)).toBeNull();
    expect(noSeatCanChange(t)).toBe(false);
    expect(noSeatCanChange(table7(true))).toBe(true);
  });
});

describe('Add request checks before it sends', () => {
  it('marks every blank in the form’s order', () => {
    expect(check(EMPTY_FORM, table9())).toEqual(['kind', 'words']);
    expect(check({ ...EMPTY_FORM, kind: 'plate' }, table9())).toEqual(['seat', 'words']);
    expect(check({ ...EMPTY_FORM, kind: 'plate', who: 1 }, table9())).toEqual(['dish', 'words']);
  });

  it('refuses a dish the guest can’t have, and passes a full form', () => {
    const plate = { kind: 'plate' as const, who: 1, words: 'The stew instead.' };
    expect(check({ ...plate, dish: 'Goat curry' }, table9())).toEqual(['dish']);
    expect(check({ ...plate, dish: 'Vegetable stew' }, table9())).toEqual([]);
    expect(check({ ...EMPTY_FORM, kind: 'table', words: 'A high chair.' }, table9())).toEqual([]);
  });

  it('says where the request goes', () => {
    expect(routeLine({ ...EMPTY_FORM, kind: 'table' }, table9())).toBe(
      'Goes to Section B: you and Grace Udo. Whoever takes it first has it.',
    );
    expect(routeLine({ ...EMPTY_FORM, kind: 'table' }, table12())).toBe(
      'Goes to Ifeoma Nduka, floor lead. Nobody is on Section C.',
    );
    expect(routeLine({ ...EMPTY_FORM, kind: 'moment' }, table9())).toBe(
      'Goes to Ifeoma Nduka, floor lead, and onto the run of show.',
    );
  });
});
