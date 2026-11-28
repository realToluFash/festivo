import { describe, expect, it } from 'vitest';

import { samplePlan, sampleTray } from './seating.ts';
import {
  NW,
  adding,
  brokenByTable,
  brokenNotes,
  matching,
  movedInto,
  nextId,
  noteTags,
  offered,
  removing,
  replacing,
  sampleNotes,
  stateOf,
  unnamedOf,
} from './seatingNotes.ts';
import type { Plan } from './seating.ts';

function seatAt(plan: Plan, id: string, name: string): Plan {
  return movedInto(plan, name, id);
}

describe('when a note is broken (sc-1364)', () => {
  it('breaks Apart at one table and Together across two, and waits on a guest without a seat', () => {
    const plan = samplePlan();
    const [apart, together, kept, waiting] = sampleNotes();

    expect(stateOf(plan, apart!).state).toBe('broken');
    expect(stateOf(plan, together!).state).toBe('broken');
    expect(stateOf(plan, kept!).state).toBe('kept');
    expect(stateOf(plan, waiting!).state).toBe('waiting');
  });

  it('says the break in words, naming the guests and the tables', () => {
    const words = brokenNotes(samplePlan(), sampleNotes()).map((one) => one.words);

    expect(words).toEqual([
      'Apart: Lina Haddad and Imran Khan are both at Table 6.',
      'Together: Leila Haddad is at Table 8 and Lina Haddad is at Table 6.',
    ]);
  });

  it('puts an Apart on its table and a Together on both, the tag counting more than one', () => {
    const plan = samplePlan();
    const byTable = brokenByTable(plan, sampleNotes());
    const tags = noteTags(plan, sampleNotes());

    expect(byTable.get('t6')).toHaveLength(2);
    expect(byTable.get('t8')).toHaveLength(1);
    expect(tags.get('t6')?.tag).toBe('2 notes');
    expect(tags.get('t8')?.tag).toBe('Together');
    expect(tags.has('t7')).toBe(false);
  });

  it('mends a Together when a move brings the two to one table', () => {
    const plan = seatAt(samplePlan(), 't6', 'Leila Haddad');

    expect(brokenNotes(plan, sampleNotes()).map((one) => one.note.id)).toEqual(['n1']);
  });

  it('counts a row and a single seat as a table', () => {
    const plan = seatAt(samplePlan(), 'rowA', 'Imran Khan');
    const note = { id: 'x', kind: 'apart' as const, a: 'Imran Khan', b: 'Emeka Obi' };

    expect(stateOf(plan, note)).toMatchObject({ state: 'broken' });
    expect(stateOf(plan, note).tables[0]?.id).toBe('rowA');
  });

  it('never counts a seat held for a companion', () => {
    const plan = samplePlan();
    const note = { id: 'x', kind: 'together' as const, a: 'Tola Bakare', b: 'Kwame Mensah' };

    expect(
      plan.items.find((item) => item.id === 't7')?.chairs.some((c) => c.state === 'held'),
    ).toBe(true);
    expect(stateOf(plan, note).state).toBe('waiting');
  });

  it('leaves every note unbroken when nobody is seated', () => {
    const plan = samplePlan();
    const empty: Plan = {
      ...plan,
      items: plan.items.map((item) => ({
        ...item,
        chairs: item.chairs.map(() => ({ state: 'empty' as const })),
      })),
    };

    expect(brokenNotes(empty, sampleNotes())).toEqual([]);
  });
});

describe('recording a note (sc-1364)', () => {
  it('offers every guest and named companion, never the guest nor an unnamed place', () => {
    const names = offered(samplePlan(), sampleTray(), 'Lina Haddad', unnamedOf);

    expect(names).toContain('Imran Khan');
    expect(names).toContain('Rui Duarte');
    expect(names).toContain('Hugo Lambert');
    expect(names).not.toContain('Lina Haddad');
    expect(names.some((name) => name.startsWith('Guest of'))).toBe(false);
  });

  it('finds a guest without their accents, and says nothing matches when nobody does', () => {
    const names = offered(samplePlan(), sampleTray(), 'Lina Haddad', unnamedOf);

    expect(matching(names, 'ines')).toEqual(['Inês Costa', 'Inês Duarte']);
    expect(matching(names, 'Femi Adebayo')).toEqual([]);
  });

  it('refuses the same note again, and asks before the other kind replaces one', () => {
    const list = sampleNotes();

    expect(adding(list, 'Imran Khan', 'Lina Haddad', 'apart', 'n5').kind).toBe('same');
    expect(adding(list, 'Imran Khan', 'Lina Haddad', 'together', 'n5')).toEqual({
      kind: 'replace',
      old: list[0],
    });
    expect(NW.same).toContain('already has this note');
  });

  it('adds a note that shows on both guests, and removes it from either', () => {
    const result = adding(sampleNotes(), 'Marta Silva', 'Hugo Lambert', 'together', 'n5');

    expect(result.kind).toBe('added');
    if (result.kind !== 'added') return;
    expect(result.list.filter((note) => [note.a, note.b].includes('Hugo Lambert'))).toHaveLength(1);
    expect(removing(result.list, 'n5')).toEqual(sampleNotes());
  });

  it('replaces the note in place, keeping one note for the two', () => {
    const list = sampleNotes();
    const next = replacing(list, list[0]!, 'together', 'Imran Khan');

    expect(next).toHaveLength(4);
    expect(next[0]).toEqual({ id: 'n1', kind: 'together', a: 'Imran Khan', b: 'Lina Haddad' });
    expect(nextId(next)).toBe('n5');
  });
});
