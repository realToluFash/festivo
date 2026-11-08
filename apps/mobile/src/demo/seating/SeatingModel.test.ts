import { describe, expect, it } from 'vitest';

import { type Action, reduce, tight, readRoom } from './SeatingActs.ts';
import {
  chairSides,
  inside,
  detailOf,
  feetInches,
  fit,
  free,
  heldInside,
  metres,
  nearestFree,
  overlapping,
  parseMetres,
  pct,
} from './SeatingGeometry.ts';
import {
  SEATING_STATES,
  type Seating,
  freeCount,
  itemOf,
  noSectionLine,
  roomLine,
  sectionRowLine,
  seatedCount,
  seatingStateOf,
  summaryLine,
  tableCount,
  trayCount,
  whatGoes,
  withSpace,
} from './SeatingModel.ts';
import { COMING, ROOM } from './SeatingSample.ts';
import { blank, startOf } from './SeatingStart.ts';
import { SEATING_BOARDS } from './SeatingBoards.ts';
import { W, say } from './SeatingWords.ts';

const run = (m: Seating, ...actions: Action[]) => actions.reduce(reduce, m);
const moved = (m: Seating, id: string, change: Partial<Seating['items'][number]>): Seating => ({
  ...m,
  items: m.items.map((it) => (it.id === id ? { ...it, ...change } : it)),
});
const pad = startOf(null, 'landscape');
const phone = startOf(null, 'phone');
const item = (m: Seating, id: string) => {
  const it = itemOf(m, id);
  if (it == null) throw new Error(id);
  return it;
};

describe('the states', () => {
  it('are seating-a-spec §6’s, by the names both demos use', () => {
    expect(SEATING_STATES).toHaveLength(100);
    expect(new Set(SEATING_STATES).size).toBe(SEATING_STATES.length);
    expect(SEATING_STATES.slice(0, 5)).toEqual([
      'plan',
      'noPlan',
      'startBlank',
      'startRange',
      'newPlan',
    ]);
    expect(SEATING_STATES.slice(-4)).toEqual([
      'printOffline',
      'refresh',
      'guestSeat',
      'guestNoSeat',
    ]);
    expect(seatingStateOf('corner')).toBe('corner');
    expect(seatingStateOf('Corner')).toBeNull();
  });

  it('each open on the iPad on its side, upright and the iPhone', () => {
    for (const state of SEATING_STATES)
      for (const layout of ['landscape', 'portrait', 'phone'] as const)
        expect(startOf(state, layout).layout, `${state} ${layout}`).toBe(layout);
  });

  it('a state the app does not have opens the plan in use', () => {
    for (const state of ['tabOrder', 'arrows', 'duplicateKey', 'screenReader', 'several'] as const)
      expect(startOf(state, 'landscape').items).toEqual(pad.items);
    expect(startOf('rect', 'phone').chosen).toBeNull();
    expect(startOf('refresh', 'landscape').refreshing).toBe(false);
  });

  it('are each a board on the demo home, deep-linked into the wedding', () => {
    expect(SEATING_BOARDS.map((board) => board.state)).toEqual([...SEATING_STATES]);
    expect(SEATING_BOARDS[0]?.href).toBe('/demo/events/evt-wed-4?area=seating&state=plan');
  });
});

describe('the sample agrees with Messaging B (142 invited, 96 coming)', () => {
  it('planning: 13 tables, 122 seats, 84 seated, 12 without a seat, 36 free', () => {
    expect(tableCount(pad.items)).toBe(13);
    expect(pad.items.reduce((n, it) => n + it.chairs.length, 0)).toBe(122);
    expect(seatedCount(pad.items)).toBe(84);
    expect(trayCount(pad.tray)).toBe(12);
    expect(seatedCount(pad.items) + trayCount(pad.tray)).toBe(COMING);
    expect(freeCount(pad.items)).toBe(36);
  });

  it('on the day: 93 seated, Joaquín Ruiz + 1 and Marta Silva without, 27 free', () => {
    expect(summaryLine(phone, COMING)).toBe('13 tables · 93 of 96 seated · 27 seats free');
    expect(phone.tray.map((p) => p.lead)).toEqual(['Joaquín Ruiz', 'Marta Silva']);
    expect(withSpace(phone.items).map((it) => it.name)).toEqual([
      'Table 4',
      'Table 8',
      'Table 9',
      'Table 10',
      'Bar 1',
      'Bar 2',
      'Row A',
      'Interpreter',
    ]);
  });

  it('seats nobody twice, and nobody seated is also without a seat', () => {
    for (const day of [false, true]) {
      const m = day ? phone : pad;
      const seated = m.items.flatMap((it) =>
        it.chairs.flatMap((c) => (c.state === 'taken' && c.who != null ? [c.who] : [])),
      );
      expect(new Set(seated).size, day ? 'on the day' : 'planning').toBe(seated.length);
      expect(seated.filter((who) => m.tray.some((p) => p.lead === who))).toEqual([]);
    }
  });

  it('names each section by its colour and counts, and what has none', () => {
    expect(sectionRowLine(pad, 'stage')).toBe('Plum · 5 tables · 50 seats');
    expect(noSectionLine(pad)).toBe('1 table · 1 row · 2 single seats · 16 seats');
    expect(roomLine(pad)).toBe('Main hall · 24 m × 18 m');
    expect(roomLine({ ...pad, units: 'us' })).toBe('Main hall · 78 ft 9 in × 59 ft 1 in');
  });
});

describe('the room to scale', () => {
  it('fits at 50% on its side and 46% upright, as the boards draw', () => {
    expect(pct(fit(632, 730, ROOM).s)).toBe(50);
    expect(pct(fit(786, 560, ROOM).s)).toBe(46);
  });

  it('draws outlines under 50% and each chair a target from 150%', () => {
    expect(detailOf(0.2)).toBe('out');
    expect(detailOf(0.25)).toBe('fit');
    expect(detailOf(0.75)).toBe('near');
  });

  it('writes sizes in the organisation’s units and reads them back', () => {
    expect(metres(1590)).toBe('15.90 m');
    expect(metres(2400)).toBe('24 m');
    expect(feetInches(1590)).toBe('52 ft 2 in');
    expect(parseMetres('15.9')).toBe(1590);
    expect(parseMetres('15,90 m')).toBe(1590);
    expect(parseMetres('far')).toBeNull();
  });

  it('keeps side by side on one side of a long table', () => {
    expect(chairSides(item(pad, 't9'))).toEqual([0, 0, 0, 1, 2, 2, 2, 3]);
  });

  it('stops a drag at the wall and places a new item in free space', () => {
    expect(heldInside({ ...item(pad, 't5'), x: 2600 }, ROOM).x).toBe(2260);
    const at = nearestFree(item(pad, 't10'), pad.items, ROOM, { x: 1200, y: 1020 });
    expect(overlapping({ ...item(pad, 't10'), ...at }, pad.items)).toEqual([]);
  });
});

describe('a tap', () => {
  it('with nobody picked chooses the table for Arrange', () => {
    const m = run({ ...pad, tab: 'Seat' }, { type: 'tapItem', id: 't4' });
    expect(m.chosen).toBe('t4');
    expect(m.tab).toBe('Arrange');
  });

  it('on the floor lets go', () => {
    expect(
      run(pad, { type: 'tapItem', id: 't4' }, { type: 'tapFloor', at: { x: 10, y: 10 } }).chosen,
    ).toBeNull();
  });
});

describe('seating a party', () => {
  const kwame = run(pad, { type: 'pick', id: 'kwame' });

  it('says what to do next, then seats them side by side with Undo', () => {
    expect(kwame.bar?.words).toBe('Now pick a table for Kwame Mensah and 1 guest.');
    const m = run(kwame, { type: 'tapItem', id: 't8' });
    expect(m.bar).toMatchObject({
      kind: 'white',
      words: 'Kwame Mensah and 1 guest are at Table 8.',
      undo: true,
    });
    expect(
      item(m, 't8')
        .chairs.slice(5, 7)
        .map((c) => c.who),
    ).toEqual(['Kwame Mensah', 'Guest of Kwame Mensah']);
    expect(trayCount(m.tray)).toBe(10);
    const undone = run(m, { type: 'undo' });
    expect(undone.items).toEqual(pad.items);
    expect(trayCount(undone.tray)).toBe(12);
  });

  it('never twice: a full table is refused and nothing changes', () => {
    const m = run(pad, { type: 'pick', id: 'lucia' }, { type: 'tapItem', id: 't1' });
    expect(m.bar?.words).toBe('Table 1 is full. Pick another table, or move someone off it first.');
    expect(m.items).toEqual(pad.items);
  });

  it('a short table offers Seat just {full name}', () => {
    const m = run(pad, { type: 'pick', id: 'amaka' }, { type: 'tapItem', id: 't4' });
    expect(m.pop).toEqual({ kind: 'short', id: 't4' });
    const just = run(m, { type: 'seatJust' });
    expect(just.bar?.words).toBe('Amaka Eze is at Table 4.');
    expect(just.tray.find((p) => p.lead === 'Guest of Amaka Eze')).toMatchObject({ plus: 1 });
  });

  it('a party seated apart says so', () => {
    expect(startOf('apart', 'landscape').bar?.words).toBe(
      'Inês Duarte and 1 guest are at Table 9, not all side by side.',
    );
  });

  it('swap sends the other guest back to Without a seat', () => {
    const m = run(pad, { type: 'pick', id: 'lucia' }, { type: 'swapDo', id: 't4', chair: 2 });
    expect(item(m, 't4').chairs[2]?.who).toBe('Lucía Ortega');
    expect(m.tray.some((p) => p.lead === 'Funmi Adeyemi')).toBe(true);
  });

  it('an Undo refused changes nothing back', () => {
    const m = run({ ...startOf('seated', 'landscape'), undoRefuses: true }, { type: 'undo' });
    expect(m.bar?.words).toBe('These seats changed since. Nothing was undone.');
  });

  it('on the iPhone: Seat here, Move to… and Mark unusable', () => {
    const seated = startOf('seated', 'phone');
    expect(seated.bar?.words).toBe('Joaquín Ruiz and 1 guest are at Table 8.');
    expect(summaryLine(seated, COMING)).toBe('13 tables · 95 of 96 seated · 25 seats free');
    const short = startOf('short', 'phone');
    expect(short.sheet).toEqual({ kind: 'short', id: 't9' });
    const moved = run(phone, { type: 'moveTo', id: 't8', chair: 1, to: 't10' });
    expect(moved.bar?.words).toBe('Moussa Diallo is at Table 10.');
    expect(startOf('unusableRefused', 'phone').fields.errors.chair).toBe(
      'Amara Diallo is in this seat. Move them first.',
    );
    expect(item(startOf('unusable', 'phone'), 't8').chairs[9]?.state).toBe('unusable');
  });

  it('unseating and moving say so, each with Undo', () => {
    const one = run(phone, { type: 'unseat', id: 't8', chair: 1 });
    expect(one.bar).toMatchObject({ words: 'Moussa Diallo has no seat now.', undo: true });
    expect(one.tray.some((p) => p.lead === 'Moussa Diallo')).toBe(true);
    expect(run(one, { type: 'undo' }).items).toEqual(phone.items);
    const empty = run(pad, { type: 'unseatAll', id: 't4' });
    expect(empty.bar).toMatchObject({ words: 'Table 4 is empty now.', undo: true });
    expect(trayCount(empty.tray)).toBe(20);
    const moved = run(pad, { type: 'moveAll', id: 't4', to: 't10' });
    expect(moved.bar).toMatchObject({ words: '8 guests moved to Table 10.', undo: true });
    expect(run(moved, { type: 'undo' }).items).toEqual(pad.items);
  });

  it('a step refused is one table, snapped to where the colleague put it', () => {
    const m = startOf('stepRefused', 'landscape');
    expect(m.bar?.words).toBe('Priya Shah just moved Table 8. Your change was not saved.');
    expect(m.chosen).toBe('t8');
    expect(item(m, 't8').y).toBe(980);
  });

  it('gives each guest sent back an id of their own, so seating one seats only that one', () => {
    const amaka = run(pad, { type: 'pick', id: 'amaka' }, { type: 'seatAt', id: 't10' });
    const back = run(amaka, { type: 'unseatAll', id: 't10' });
    const twins = back.tray.filter((p) => p.lead === 'Guest of Amaka Eze');
    expect(twins).toHaveLength(2);
    expect(new Set(back.tray.map((p) => p.id)).size).toBe(back.tray.length);
    const one = run(back, { type: 'pick', id: twins[0]?.id ?? '' }, { type: 'seatAt', id: 't8' });
    expect(one.tray.filter((p) => p.lead === 'Guest of Amaka Eze')).toHaveLength(1);
    expect(seatedCount(one.items) + trayCount(one.tray)).toBe(COMING);
  });

  it('Undo undoes the seating only until the next change', () => {
    const seated = run(pad, { type: 'pick', id: 'kwame' }, { type: 'seatAt', id: 't8' });
    const moved = run(seated, { type: 'moved', id: 't5', at: { x: 1980, y: 1380 } });
    expect(moved.undo).toBeNull();
    expect(moved.bar).toBeNull();
    const after = run(moved, { type: 'undo' });
    expect(item(after, 't5').y).toBe(1380);
    expect(item(after, 't8').chairs[5]?.who).toBe('Kwame Mensah');
    const undone = run(seated, { type: 'undo' });
    expect(undone.items).toEqual(pad.items);
    expect(undone.save).toBe('saving');
  });

  it('everyone seated empties the tray', () => {
    expect(startOf('everyoneSeated', 'landscape').tray).toEqual([]);
    expect(startOf('everyoneSeated', 'phone').tray).toEqual([]);
  });
});

describe('a table’s fields apply as each is entered', () => {
  const t4 = run(pad, { type: 'tapItem', id: 't4' });

  it('refuse a name already used, beside the field', () => {
    expect(startOf('nameTaken', 'landscape').fields.errors.Name).toBe(
      'This plan already has a table called Table 2.',
    );
  });

  it('refuse fewer seats than are seated', () => {
    expect(startOf('belowSeated', 'landscape').fields.errors.Seats).toBe(
      '8 guests are seated here. Move them first, or keep 8 seats.',
    );
  });

  it('refuse a place outside the room, and move to one inside', () => {
    expect(startOf('acrossRefused', 'landscape').fields.errors.Across).toBe(
      'Table 5 would sit outside the room.',
    );
    const m = run(
      t4,
      { type: 'draft', key: 'Across', text: '16.9' },
      { type: 'apply', key: 'Across' },
    );
    expect(item(m, 't4').x).toBe(1690);
    expect(m.save).toBe('saving');
  });

  it('warn a squeeze and save it all the same', () => {
    const m = startOf('squeeze', 'landscape');
    expect(m.fields.warn).toBe('10 seats will be tight at a 150 cm table.');
    expect(item(m, 't10').d).toBe(150);
    expect(tight(item(pad, 't9'))).toBe(false);
  });

  it('say a shape change resets the size and keeps the seats', () => {
    expect(startOf('shapeChanged', 'landscape').fields).toMatchObject({
      note: 'Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.',
      warn: '10 seats will be tight at a 180 × 76 cm table.',
    });
  });

  it('refuse a row label used and a row shortened past a guest', () => {
    expect(startOf('rowLabelTaken', 'landscape').fields.errors.Label).toBe(
      'This plan already has a row labelled A.',
    );
    expect(startOf('rowBelowSeated', 'landscape').fields.errors.Seats).toBe(
      'Lars Johansson is in seat 4. Move them first, or keep 4 seats.',
    );
    expect(startOf('seatNameTaken', 'landscape').fields.errors.Name).toBe(
      'This plan already has a seat called By the door.',
    );
  });

  it('take sizes in feet and inches where the organisation is US customary', () => {
    const us = { ...pad, units: 'us' as const };
    const t9 = run(
      us,
      { type: 'tapItem', id: 't9' },
      { type: 'draft', key: 'Width', text: '9 ft' },
      { type: 'apply', key: 'Width' },
    );
    expect(item(t9, 't9').w).toBe(274);
    const t4 = run(
      us,
      { type: 'tapItem', id: 't4' },
      { type: 'draft', key: 'Diameter', text: '6 ft' },
      { type: 'apply', key: 'Diameter' },
    );
    expect(item(t4, 't4').d).toBe(183);
  });

  it('show and take a row’s Spacing in feet and inches on a US plan', () => {
    const us = run(startOf('usCustomary', 'landscape'), { type: 'tapItem', id: 'rowA' });
    const m = run(
      us,
      { type: 'draft', key: 'Spacing', text: '2 ft' },
      { type: 'apply', key: 'Spacing' },
    );
    expect(item(m, 'rowA').spacing).toBe(61);
    expect(feetInches(item(m, 'rowA').spacing)).toBe('2 ft 0 in');
  });

  it('refuse a size it cannot read, or under 30 cm, beside the field', () => {
    const us = run(
      startOf('usCustomary', 'landscape'),
      { type: 'draft', key: 'Diameter', text: '6' },
      { type: 'apply', key: 'Diameter' },
    );
    expect(us.fields.errors.Diameter).toBe('Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.');
    expect(item(us, 't4').d).toBe(180);
    const small = run(
      pad,
      { type: 'tapItem', id: 't4' },
      { type: 'draft', key: 'Diameter', text: '20' },
      { type: 'apply', key: 'Diameter' },
    );
    expect(small.fields.errors.Diameter).toBe('Use 30 cm or more.');
    const unread = run(
      pad,
      { type: 'tapItem', id: 't4' },
      { type: 'draft', key: 'Diameter', text: 'wide' },
      { type: 'apply', key: 'Diameter' },
    );
    expect(unread.fields.errors.Diameter).toBe('Use 30 cm or more.');
  });

  it('keep a table chosen when what was typed is refused on leaving, then let go on a second tap', () => {
    const typed = run(
      pad,
      { type: 'tapItem', id: 't4' },
      { type: 'draft', key: 'Name', text: 'Table 5' },
    );
    const held = run(typed, { type: 'tapItem', id: 't6' });
    expect(held.chosen).toBe('t4');
    expect(held.fields.errors.Name).toBe('This plan already has a table called Table 5.');
    const left = run(held, { type: 'tapItem', id: 't6' });
    expect(left.chosen).toBe('t6');
    expect(item(left, 't4').name).toBe('Table 4');
  });

  it('apply what was typed when another table is chosen', () => {
    const m = run(
      pad,
      { type: 'tapItem', id: 't4' },
      { type: 'draft', key: 'Name', text: 'Family' },
      { type: 'tapItem', id: 't5' },
    );
    expect(item(m, 't4').name).toBe('Family');
    expect(m.chosen).toBe('t5');
    expect(m.fields.drafts).toEqual({});
  });

  it('refuse a taken chair marked unusable', () => {
    expect(startOf('unusableRefused', 'landscape').fields.errors.chair).toBe(
      'Chidi Obi is in this seat. Move them first.',
    );
  });
});

describe('adding, placing and deleting', () => {
  it('places a table at the centre in the nearest free space, its fields open', () => {
    const m = run(pad, { type: 'startPlacing', kind: 'round' }, { type: 'placeCentre' });
    expect(m.chosen).not.toBeNull();
    expect(m.fields.added).toBe('Table 11 added in the nearest free space.');
    expect(overlapping(item(m, m.chosen ?? ''), m.items)).toEqual([]);
  });

  it('adds a row with the next free letter', () => {
    expect(run(pad, { type: 'addRow' }).fields.added).toBe(
      'Row B added in the nearest free space, with 10 seats.',
    );
  });

  it('never gives two items one id, even after a delete', () => {
    const one = run(pad, { type: 'tapItem', id: 't1' }, { type: 'duplicate' });
    const gone = run(
      one,
      { type: 'tapItem', id: 't10' },
      { type: 'ask', ask: { kind: 'deleteItem', id: 't10' } },
      { type: 'confirm' },
    );
    const two = run(
      gone,
      { type: 'tapItem', id: 't3' },
      { type: 'duplicate' },
      { type: 'addRow' },
      { type: 'addSeat' },
    );
    expect(new Set(two.items.map((it) => it.id)).size).toBe(two.items.length);
    const sections = run(
      two,
      { type: 'arrange', shows: 'sectionAdd' },
      { type: 'sectionName', name: 'Terrace' },
      { type: 'sectionAdd' },
    );
    expect(new Set(sections.sections.map((s) => s.key)).size).toBe(4);
  });

  it('holds a resize and a turn inside the walls, and refuses a turn that cannot fit', () => {
    const wide = run(pad, { type: 'resized', id: 't5', d: 400 });
    expect(inside(item(wide, 't5'), ROOM)).toBe(true);
    const near = moved(pad, 'top', { y: 120 });
    const turned = run(near, { type: 'turned', id: 'top', rot: 90 });
    expect(inside(item(turned, 'top'), ROOM)).toBe(true);
    const field = run(
      { ...near, chosen: 'top' },
      { type: 'choose', field: 'Rotation', value: '90°' },
    );
    expect(field.fields.errors.Rotation).toBe('Top table would sit outside the room.');
    expect(item(field, 'top').rot).toBe(0);
  });

  it('deletes a table and sends its guests back to Without a seat', () => {
    const m = run(startOf('deleteTable', 'landscape'), { type: 'confirm' });
    expect(itemOf(m, 't4')).toBeNull();
    expect(trayCount(m.tray)).toBe(20);
  });
});

describe('sections', () => {
  it('pick the least-used colour, and refuse a blank or used name', () => {
    expect(startOf('sectionAdd', 'landscape').sectionForm.colour).toBe('Blue');
    expect(startOf('sectionTaken', 'landscape').sectionForm.error).toBe(
      'This plan already has a section called Stage side.',
    );
    expect(startOf('sectionBlank', 'landscape').sectionForm.error).toBe(
      'Enter a name for the section.',
    );
    expect(startOf('sectionLimit', 'landscape').arrange).toBe('sectionLimit');
  });

  it('refuse a name over 40 characters rather than cutting it off', () => {
    const long = 'The long table by the windows on the garden side';
    const m = run(
      startOf('sectionAdd', 'landscape'),
      { type: 'sectionName', name: long },
      { type: 'sectionAdd' },
    );
    expect(m.sectionForm.error).toBe('Use 40 characters or fewer.');
    expect(m.sections).toHaveLength(3);
  });

  it('delete one, its tables staying with no section', () => {
    const m = run(startOf('sectionDelete', 'landscape'), { type: 'confirm' });
    expect(m.sections.map((s) => s.key)).toEqual(['garden', 'bar']);
    expect(item(m, 't1').sec).toBeNull();
  });
});

describe('the room and the plan', () => {
  it('refuses a smaller room that leaves items outside', () => {
    const m = startOf('shrinkRefused', 'landscape');
    expect(m.roomDraft.error).toBe('3 items sit outside 20 m × 18 m. Move them first.');
    expect(m.outside).toEqual(['t5', 't10', 'bar2']);
  });

  it('asks before deleting the plan with what it deletes, then who loses a seat (pm, 8 Nov)', () => {
    const m = startOf('deletePlan', 'landscape');
    expect(say.deletePlanBody(whatGoes(m), seatedCount(m.items))).toBe(
      'This also deletes 3 sections, 13 tables, 1 row and 2 single seats. 84 seated guests move to Without a seat; the guest list does not change.',
    );
    expect(say.deletePlanBody('1 table', 1)).toBe(
      'This also deletes 1 table. 1 seated guest moves to Without a seat; the guest list does not change.',
    );
    expect(say.deletePlanBody(whatGoes({ ...m, sections: [], items: [] }), 0)).toBe(
      'The guest list does not change.',
    );
  });

  it('says why the sizes are in metres or feet, and the plan’s other settled words', () => {
    expect(say.startLine('The Landmark', 'London', 'Ire Events')).toBe(
      'At The Landmark, London. Sizes are in metres, as used in Ire Events’s country.',
    );
    expect(say.startLineFeet('The Landmark', 'London', 'Ire Events')).toBe(
      'At The Landmark, London. Sizes are in feet, as used in Ire Events’s country.',
    );
    expect(W.readOnly).toBe('You can view and print this plan, but not change it.');
    expect(W.failed).toBe('Could not load the seating plan.');
    expect(W.failedLine).toBe(
      'Check your connection and try again. Nothing on the plan has changed.',
    );
  });

  it('deletes the plan, everyone seated back to Without a seat', () => {
    const m = run(startOf('deletePlan', 'landscape'), { type: 'confirm' });
    expect(m.load).toBe('noPlan');
    expect(trayCount(m.tray)).toBe(COMING);
  });

  it('sizes the room in feet on a US plan, in Room settings and Start the plan', () => {
    const settings = run(startOf('usCustomary', 'landscape'), {
      type: 'arrange',
      shows: 'roomSettings',
    });
    expect(settings.roomDraft.width).toBe('78 ft 9 in');
    const wider = run(
      settings,
      { type: 'roomDraft', key: 'width', text: '80 ft' },
      { type: 'roomApply' },
    );
    expect(wider.room.w).toBe(2438);
    const tiny = run(
      settings,
      { type: 'roomDraft', key: 'width', text: '5' },
      { type: 'roomApply' },
    );
    expect(tiny.roomDraft.error).toBe('Use 7 to 1,640 ft.');
    const started = run(
      { ...blank('landscape'), units: 'us' },
      { type: 'openStart' },
      { type: 'startDraft', key: 'width', text: '80' },
      { type: 'startDraft', key: 'length', text: '60 ft' },
      { type: 'startPlan' },
    );
    expect(started.room).toMatchObject({ w: 2438, l: 1829 });
  });

  it('takes its own minimums in feet, and keeps an untouched room as it is', () => {
    const row = run(startOf('usCustomary', 'landscape'), { type: 'tapItem', id: 'rowA' });
    for (const text of ['1 ft', '12 in']) {
      const m = run(
        row,
        { type: 'draft', key: 'Spacing', text },
        { type: 'apply', key: 'Spacing' },
      );
      expect(m.fields.errors.Spacing).toBeUndefined();
      expect(item(m, 'rowA').spacing).toBe(30);
    }
    const settings = run(startOf('usCustomary', 'landscape'), {
      type: 'arrange',
      shows: 'roomSettings',
    });
    const seven = run(settings, { type: 'roomDraft', key: 'width', text: '7 ft' });
    expect(readRoom('7 ft', 'width', 'us')).toEqual({ cm: 213 });
    expect(readRoom('7', 'width', 'us')).toEqual({ cm: 213 });
    expect(seven.roomDraft.error).toBeNull();
    const untouched = run(settings, { type: 'roomApply' });
    expect(untouched.room.l).toBe(settings.room.l);
    expect(untouched.room.w).toBe(settings.room.w);
  });

  it('refuses a blank or out-of-range room, then starts the plan', () => {
    expect(startOf('startBlank', 'landscape').start.errors.length).toBe('Enter the room’s length.');
    expect(startOf('startRange', 'landscape').start.errors.length).toBe(
      'The room must be between 2 m and 500 m.',
    );
    const m = run(
      blank('landscape'),
      { type: 'openStart' },
      { type: 'startDraft', key: 'width', text: '24' },
      { type: 'startDraft', key: 'length', text: '18' },
      { type: 'startPlan' },
    );
    expect(m.load).toBe('ready');
    expect(m.items).toEqual([]);
    expect(m.bar?.words).toBe('Add your first table, row or seat from the bar below.');
  });
});

describe('print', () => {
  it('prepares a document, then says it opened in the share sheet', () => {
    const m = run(startOf('print', 'phone'), { type: 'printDoc', doc: 'Table lists' });
    expect(m.preparing).toBe('Table lists');
    expect(run(m, { type: 'printed' }).bar?.words).toBe(
      'Table lists is ready. It opened in the share sheet.',
    );
  });

  it('needs a connection', () => {
    expect(
      run(startOf('printOffline', 'phone'), { type: 'printDoc', doc: 'Floor plan' }).preparing,
    ).toBeNull();
  });
});

describe('free seats', () => {
  it('count usable chairs only', () => {
    expect(free(item(pad, 't3'))).toBe(1);
    expect(free(item(pad, 't7'))).toBe(2);
  });
});
