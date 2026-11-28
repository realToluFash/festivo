import { describe, expect, it } from 'vitest';

import {
  PICKED,
  SAMPLE_PLAN,
  SAMPLE_SEATS,
  SEATING_STATES,
  assignTable,
  byTable,
  cellOf,
  colleagueRemoves,
  colleagueSeats,
  colleagueTakes,
  goingOf,
  optionsOf,
  previewOf,
  resultTone,
  resultWords,
  seatingGuests,
  seatingStart,
  undoAssign,
  unseatedOf,
} from './guestsSeating.ts';

const list = seatingGuests();

function assigned(order: readonly string[], seats = SAMPLE_SEATS, free: number | null = 6) {
  const after = assignTable(list, SAMPLE_PLAN, seats, order, 't-4', free);

  if (after.kind !== 'done') throw new Error('Table 4 is on the sample plan.');

  return after;
}

describe('the list reads the plan (sc-4025)', () => {
  it('names a table, a row seat, or No seat', () => {
    expect(cellOf(SAMPLE_PLAN, SAMPLE_SEATS.ngozi)).toBe('Table 9');
    expect(cellOf(SAMPLE_PLAN, SAMPLE_SEATS.kwame)).toBe('Row C, seat 4');
    expect(cellOf(SAMPLE_PLAN, undefined)).toBe('No seat');
  });

  it('counts Unseated as the tray does: Coming guests and their companions, as people', () => {
    expect(unseatedOf(list, SAMPLE_SEATS).sort()).toEqual(
      [
        'adaeze',
        'adaeze-1',
        'ifeanyi',
        'ifeanyi-1',
        'ifeanyi-2',
        'ifeanyi-3',
        'ines',
        'ines-1',
      ].sort(),
    );
  });

  it('sorts by table in natural order, then chair, with no seat last', () => {
    const names = [...list].sort(byTable(SAMPLE_PLAN, SAMPLE_SEATS)).map((one) => one.id);

    expect(names.slice(0, 6)).toEqual(['tunde', 'marta', 'ngozi', 'yusuf', 'amaka', 'kwame']);
    expect(names.indexOf('amaka')).toBeLessThan(names.indexOf('kwame'));
    expect(names.indexOf('kwame')).toBeLessThan(names.indexOf('adaeze'));
  });
});

describe('the chooser', () => {
  it('lists only tables with a free seat, in natural order, each with its free count', () => {
    expect(optionsOf(SAMPLE_PLAN, SAMPLE_SEATS, '').map((one) => one.name)).toEqual([
      'Table 2',
      'Table 4',
      'Table 9',
      'Table 10',
      'Table 14',
    ]);
  });

  it('matches the section, accents and case aside', () => {
    expect(optionsOf(SAMPLE_PLAN, SAMPLE_SEATS, 'GÁRDEN').map((one) => one.name)).toEqual([
      'Table 14',
    ]);
  });

  it('says who is going and who would move', () => {
    const going = goingOf(list, PICKED);

    expect([going.guests, going.companions, going.need]).toEqual([5, 5, 10]);
    expect(previewOf(list, SAMPLE_PLAN, SAMPLE_SEATS, PICKED, 't-4')).toEqual({
      moving: ['Ngozi Eze', 'Yusuf Danjuma'],
      need: 10,
      free: 6,
    });
    expect(previewOf(list, SAMPLE_PLAN, SAMPLE_SEATS, ['tunde'], 't-4').moving).toEqual([
      'Tunde Bakare’s party (2)',
    ]);
  });

  it('drops a table taken off the plan, and a full one, from the list', () => {
    const gone = colleagueRemoves(SAMPLE_PLAN, SAMPLE_SEATS);

    expect(optionsOf(gone.plan, gone.seats, '').map((one) => one.id)).not.toContain('t-4');
    expect(optionsOf(SAMPLE_PLAN, SAMPLE_SEATS, '').map((one) => one.id)).not.toContain('t-12');
  });
});

describe('Assign table', () => {
  it('skips a party that does not fit and seats a smaller one after it', () => {
    expect(resultWords(assigned(PICKED).result)).toEqual([
      'Seated 6 at Table 4.',
      'Moved 2 from Table 9: Ngozi Eze and Yusuf Danjuma.',
      'Not seated: Ifeanyi Okafor’s party (4), not enough room.',
    ]);
  });

  it('never splits a party, and seats Held companions with their guest', () => {
    const after = assigned(PICKED);

    expect(after.seats.adaeze).toBeDefined();
    expect(after.seats['adaeze-1']).toBeDefined();
    expect(after.seats.ifeanyi).toBeUndefined();
    expect(after.seats['ifeanyi-1']).toBeUndefined();
  });

  it('reports a guest who is not coming and gives them no chair', () => {
    const after = assigned(['ngozi', 'camille']);

    expect(resultWords(after.result)).toContain('Not seated: Camille Dubois, not coming.');
    expect(after.seats.camille).toBeUndefined();
  });

  it('says the table filled up when a colleague seated someone since it was chosen', () => {
    const after = assigned(
      ['ngozi', 'yusuf', 'adaeze', 'ifeanyi', 'emeka'],
      colleagueSeats(SAMPLE_SEATS, SAMPLE_PLAN),
    );

    expect(resultWords(after.result)).toEqual([
      'Seated 4 at Table 4.',
      'Moved 2 from Table 9: Ngozi Eze and Yusuf Danjuma.',
      'Not seated: Ifeanyi Okafor’s party (4) and Dr Emeka Nwosu’s party (2), not enough room.',
      'Table 4 filled up while you were choosing.',
    ]);
    expect(resultTone(after.result)).toBe('held');
  });

  it('is refused with nothing changed when the table has left the plan', () => {
    const gone = colleagueRemoves(SAMPLE_PLAN, SAMPLE_SEATS);

    expect(assignTable(list, gone.plan, gone.seats, PICKED, 't-4', 6)).toEqual({
      kind: 'gone',
      table: 'Table 4',
    });
  });

  it('shows the green dot when everyone went in', () => {
    expect(resultTone(assigned(['ngozi', 'yusuf', 'ines']).result)).toBe('done');
  });
});

describe('Undo', () => {
  it('puts everyone back where they were', () => {
    const after = assigned(PICKED);
    const back = undoAssign(SAMPLE_PLAN, after.seats, after.changes);

    expect(back.seats).toEqual(SAMPLE_SEATS);
    expect(resultWords(back.result)).toEqual(['Undone. 6 people are back where they were.']);
  });

  it('leaves someone whose old chair was taken since, and names them', () => {
    const after = assigned(PICKED);
    const back = undoAssign(SAMPLE_PLAN, colleagueTakes(after.seats), after.changes);

    expect(back.seats.yusuf).toEqual(after.seats.yusuf);
    expect(resultWords(back.result)).toEqual([
      'Undone. 5 people are back where they were.',
      'Yusuf Danjuma stays at Table 4. Someone has taken the chair at Table 9 since.',
    ]);
  });
});

describe('the states', () => {
  it('opens every state', () => {
    for (const one of SEATING_STATES) expect(seatingStart(one.key).list.length).toBeGreaterThan(0);
  });
});
