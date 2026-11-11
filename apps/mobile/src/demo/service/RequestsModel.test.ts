import { describe, expect, it } from 'vitest';

import {
  EMPTY_FORM,
  HOST,
  ME,
  OFFLINE_ACTION,
  OFFLINE_ADD,
  STAFFED,
  THE_LEAD,
  TRAYS,
  actions,
  add,
  check,
  decline,
  dishOptions,
  done,
  noSeatCanChange,
  nextOrder,
  offered,
  openDecline,
  otherLine,
  ownerLine,
  refusal,
  requestSeed,
  requests,
  routeLine,
  seatWhy,
  servingName,
  table12,
  table7,
  table9,
  take,
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

  it('gives service.manage without the floor lead no moment, but lets it close a taken request', () => {
    expect(actions(byId('song'), HOST)).toEqual([]);
    expect(actions(byId('blind'), HOST)).toEqual(['done', 'decline']);
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
    expect(ids(HOST)).toBe(0);
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

describe('what each action does to a request', () => {
  it('refuses every action offline and leaves the list as it was', () => {
    const off = requestSeed('offline');
    for (const next of [
      take(off, 'chair'),
      done(off, 'stew'),
      openDecline(off, 'stew'),
      decline({ ...off, declining: 'stew', reason: 'Out of stew.' }),
    ]) {
      expect(next.list).toEqual(off.list);
      expect(next.refused).toBe(OFFLINE_ACTION);
    }
    const adding = { ...off, form: { ...EMPTY_FORM, kind: 'table' as const, words: 'Water.' } };
    const added = add(adding).d;
    expect(added.list).toEqual(off.list);
    expect(added.refused).toBe(OFFLINE_ADD);
  });

  it('takes, closes and declines with who and when', () => {
    const d = take(requestSeed('untaken'), 'chair');
    expect(d.list.find((r) => r.id === 'chair')?.owner).toBe(ME.name);
    const closed = done(d, 'chair').list.find((r) => r.id === 'chair')?.closed;
    expect(closed).toEqual({ outcome: 'Done', by: ME.name, at: '20:24' });
    const declined = decline({ ...openDecline(d, 'chair'), reason: '  None left.  ' });
    expect(declined.list.find((r) => r.id === 'chair')?.closed).toEqual({
      outcome: 'Declined',
      by: ME.name,
      at: '20:24',
      reason: 'None left.',
    });
  });

  it('refuses a blank reason and keeps the request open', () => {
    const d = { ...openDecline(requestSeed('yours'), 'chair'), reason: '   ' };
    const next = decline(d);
    expect(next.reasonWrong).toBe(true);
    expect(next.declining).toBe('chair');
    expect(next.list.find((r) => r.id === 'chair')?.closed).toBeUndefined();
  });

  it('records the other person’s close when they closed it first', () => {
    const d = requestSeed('closedFirst');
    expect(d.list.find((r) => r.id === 'chair')?.closed).toEqual({
      outcome: 'Done',
      by: 'Grace Udo',
      at: '20:23',
    });
    expect(d.notice.chair).toBe('Not closed. Grace Udo closed this request at 20:23.');
  });

  it('withholds Done after a refusal, keeps Decline, and names the course from the menu', () => {
    for (const state of ['refusedStage', 'refusedFlag'] as const) {
      const d = requestSeed(state);
      const stew = d.list.find((r) => r.id === 'stew')!;
      expect(stew.closed).toBeUndefined();
      expect(offered(stew, d)).toEqual(['decline']);
    }
    expect(requestSeed('refusedStage').notice.stew).toBe(
      'Not changed. Seat 1’s Mains became Dishing before Done, so it can’t change now. The request is still open.',
    );
  });

  it('adds a request open to the section, and keeps a form with blanks', () => {
    const d = { ...requestSeed('add') };
    expect(add(d).d.list).toEqual(d.list);
    const full = { ...d, form: { ...EMPTY_FORM, kind: 'table' as const, words: ' Water. ' } };
    const added = add(full).d;
    expect(added.form).toBeNull();
    expect(added.list.at(-1)).toMatchObject({
      table: 'Table 9',
      kind: 'table',
      words: 'Water.',
      owner: null,
    });
  });

  it('heads the screen with the course in service, by its menu name', () => {
    expect(servingName(table9().courses)).toBe('Mains');
    expect(servingName(table7().courses)).toBe('Dessert');
  });
});
