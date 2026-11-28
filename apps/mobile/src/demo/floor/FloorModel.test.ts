import { describe, expect, it } from 'vitest';

import {
  type Floor,
  type Place,
  READY_NOW,
  REASONS,
  WAIT_ALL,
  WORD_ORDER,
  canSendBack,
  canSendBackOwed,
  choicesFor,
  choose,
  dismissNotSent,
  floorSeed,
  floorStateOf,
  flaggedOpen,
  groupsOf,
  guestName,
  heldLine,
  inOrder,
  loseConnection,
  mayWrite,
  movedTo,
  onItLine,
  openSendBack,
  openTable,
  owedLine,
  pickReason,
  reconnect,
  refusalAt,
  rowSaid,
  samplePlaces,
  sendBack,
  servedElsewhere,
  servedLine,
  stripLine,
  trayLine,
  undo,
  undoUntil,
  wordOf,
  wordSaid,
} from './FloorModel.ts';

function at(f: Floor, name: string): Place {
  const p = f.places.find((x) => x.name === name);
  if (p == null) throw new Error(`no ${name}`);
  return p;
}

const names = (f: Floor) =>
  groupsOf(f).map((g) =>
    g.kind === 'none' ? g.line : `${g.title}: ${g.places.map((p) => p.name).join(', ')}`,
  );

describe('Floor’s groups (sc-4021)', () => {
  it('lists Yours for the one section, then every other table naming its section', () => {
    expect(names(floorSeed('yours'))).toEqual([
      'Yours · Section B: Table 2, Table 4, Table 6, Table 10, Row C, Seats 1 to 10',
      'Other tables: Table 1, Table 3, Table 5, Table 7, Table 8, Table 9',
    ]);
  });

  it('gives a waiter on two sections a Yours group for each', () => {
    expect(names(floorSeed('asWell'))).toEqual([
      'Yours · Section B: Table 2, Table 4, Table 6, Table 10, Row C, Seats 1 to 10',
      'Yours · Section D: Table 8, Table 9',
      'Other tables: Table 1, Table 3, Table 5, Table 7',
    ]);
  });

  it('puts the lead’s line in place of Yours for a waiter on no section', () => {
    const g = names(floorSeed('noSection'));
    expect(g[0]).toBe('No tables yet. Ifeoma Nduka will put you on a section.');
    expect(g[1]).toContain('Other tables: Table 1, Table 2, Table 3');
  });

  it('draws only Other tables, every table, for service.manage with no section', () => {
    const g = groupsOf(floorSeed('manage'));
    expect(g).toHaveLength(1);
    expect(g[0]?.kind === 'other' ? g[0].places : []).toHaveLength(12);
  });

  it('keeps Yours for service.manage on a section', () => {
    const f = floorSeed('yours');
    expect(names({ ...f, manage: true })).toEqual(names(f));
  });
});

describe('the order', () => {
  it('compares numbers by value, then rows, then blocks of single seats, whatever order the API sent', () => {
    expect(samplePlaces()[0]?.name).toBe('Table 10');
    expect(inOrder(samplePlaces()).map((p) => p.name)).toEqual([
      'Table 1',
      'Table 2',
      'Table 3',
      'Table 4',
      'Table 5',
      'Table 6',
      'Table 7',
      'Table 8',
      'Table 9',
      'Table 10',
      'Row C',
      'Seats 1 to 10',
    ]);
  });

  it('keeps a row where it is when its word changes', () => {
    const f = floorSeed('yours');
    const before = names(f);
    const after = servedElsewhere(f);
    expect(wordOf(at(f, 'Table 4'))).toBe('On a tray');
    expect(wordOf(at(after, 'Table 4'))).toBe('Served');
    expect(names(after)).toEqual(before);
  });
});

describe('each row’s word', () => {
  it('reads every word, in its order, down Section B', () => {
    const f = floorSeed('yours');
    const g = groupsOf(f)[0];
    expect(g?.kind === 'yours' ? g.places.map(wordOf) : []).toEqual([...WORD_ORDER]);
  });

  it('names an earlier course first', () => {
    expect(wordSaid(at(floorSeed('yours'), 'Table 5'))).toBe('Starter · Served');
    expect(wordSaid(at(floorSeed('yours'), 'Table 1'))).toBe('Served');
  });

  it('reads Not here yet only while nobody at the table has arrived', () => {
    const t9 = at(floorSeed('yours'), 'Table 9');
    const all = (stage: Place['seats'][number]['stage']): Place => ({
      ...t9,
      seats: t9.seats.map((g) => ({ ...g, stage })),
    });
    expect(wordOf(all('Not here yet'))).toBe('Not here yet');
    expect(wordOf(all('Left'))).toBe('Served');
    expect(wordOf(all('Nothing for this course'))).toBe('Served');
  });

  it('reads Waiting on the kitchen when the only guest left is held', () => {
    expect(wordOf(at(floorSeed('yours'), 'Table 6'))).toBe('Waiting on the kitchen');
  });

  it('counts the served guests of the course, and a table with none fired against the room’s', () => {
    const f = floorSeed('yours');
    expect(servedLine(at(f, 'Table 2'))).toBe('2 of 9 served');
    expect(servedLine(at(f, 'Table 10'))).toBe('0 of 10 served');
    expect(servedLine(at(f, 'Row C'))).toBe('0 of 10 served');
  });

  it('counts flagged guests whose order or owed plate is not Served', () => {
    const f = floorSeed('yours');
    expect(flaggedOpen(at(f, 'Table 2')).map((g) => g.name)).toEqual(['Adaeze Okafor', 'Ada Obi']);
    expect(flaggedOpen(at(floorSeed('notSent'), 'Table 2'))).toHaveLength(1);
  });

  it('reads a row as one button, the flagged count spoken because the icon is not', () => {
    const f = floorSeed('yours');
    expect(rowSaid(at(f, 'Table 2'), false)).toBe(
      'Table 2, To serve, 2 of 9 served, 10 covers, 2 flagged guests still to serve',
    );
    expect(rowSaid(at(f, 'Table 3'), true)).toBe(
      'Table 3, To serve, 2 of 8 served, 8 covers, 1 flagged guest still to serve, Section A',
    );
  });
});

describe('a table’s view', () => {
  const f = floorSeed('table');
  const t2 = at(f, 'Table 2');

  it('reads each started tray, Paused on a paused one', () => {
    expect(t2.trays.map(trayLine)).toEqual([
      'Bisi Lawal · 2 plates · Dishing',
      'Tomi Ade · 2 plates · Checked',
    ]);
    expect(t2.trays.map((t) => t.paused)).toEqual([false, true]);
  });

  it('reads a held guest’s items and time, and each owed plate with its reason', () => {
    const ada = t2.seats[4];
    expect(ada?.held == null ? '' : heldLine(ada.held)).toBe('Grilled fish · Ready in about 5 min');
    expect(t2.seats.flatMap((g) => g.owed.map((o) => owedLine(t2, o)))).toEqual([
      'To follow · Plantain',
      'Sent back · Allergy concern · Grilled fish · pepper sauce',
      'Starter · Bring after · Small chops',
    ]);
  });

  it('says who is on it, or that nobody is', () => {
    expect(onItLine(f, t2)).toBe('On it · Section B · Tomi Ade, Bisi Lawal');
    expect(onItLine(f, at(f, 'Table 7'))).toBe('On it · Section C · Nobody on it');
  });

  it('names guests only where sc-4005 returns them', () => {
    const t3 = at(f, 'Table 3');
    const g = t3.seats[3];
    if (g == null) throw new Error('seat 4');
    expect(guestName(f, t3, g)).toBe('Seat 4');
    expect(guestName(f, at(f, 'Table 7'), at(f, 'Table 7').seats[0] ?? g)).toBe('Hassan Bello');
    expect(guestName(floorSeed('manage'), t3, g)).toBe('Bimpe Ojo');
  });
});

describe('a held guest’s choice', () => {
  it('is made and changed, the last one standing, with Undo naming it', () => {
    const f = choose(floorSeed('table'), 'Table 2', 5, READY_NOW);
    expect(at(f, 'Table 2').seats[4]?.held?.choice).toBe(READY_NOW);
    expect(f.undo?.line).toBe('Ada Obi: What’s ready, now');
    const back = choose(f, 'Table 2', 5, WAIT_ALL);
    expect(at(back, 'Table 2').seats[4]?.held?.choice).toBe(WAIT_ALL);
  });

  it('puts the choice before it back on Undo', () => {
    const f = choose(floorSeed('table'), 'Table 2', 5, READY_NOW);
    expect(at(undo(f), 'Table 2').seats[4]?.held?.choice).toBe(WAIT_ALL);
  });

  it('offers no What’s ready, now while nothing is Ready', () => {
    const femi = at(floorSeed('nothingReady'), 'Table 6').seats[2];
    expect(femi?.held == null ? [] : choicesFor(femi.held)).toEqual([WAIT_ALL]);
    const f = choose(floorSeed('nothingReady'), 'Table 6', 3, READY_NOW);
    expect(at(f, 'Table 6').seats[2]?.held?.choice).toBeNull();
  });
});

describe('Send back', () => {
  it('offers the four reasons and sends nothing until one is chosen', () => {
    expect(REASONS).toEqual(['Wrong dish', 'Not right', 'Dropped', 'Allergy concern']);
    const open = openSendBack(floorSeed('table'), 'Table 2', 8, null);
    expect(sendBack(open)).toBe(open);
  });

  it('puts the order back to To serve, owed under its guest with its reason, and offers Undo for 2 minutes', () => {
    for (const reason of REASONS) {
      const f = sendBack(pickReason(openSendBack(floorSeed('table'), 'Table 2', 8, null), reason));
      const kemi = at(f, 'Table 2').seats[7];
      expect(kemi?.stage).toBe('To serve');
      expect(kemi?.owed[0]).toMatchObject({
        items: 'Goat curry',
        why: 'Sent back',
        reason,
        stage: 'To serve',
      });
      expect(servedLine(at(f, 'Table 2'))).toBe('1 of 9 served');
      expect(f.undo?.line).toBe(`Sent back: Kemi Oke’s Goat curry · ${reason}`);
      expect(f.undo?.until).toBe('21:06');
      expect(kemi == null ? true : canSendBack(f, at(f, 'Table 2'), kemi)).toBe(false);
    }
  });

  it('reverses only that step on Undo', () => {
    const f = sendBack(pickReason(openSendBack(floorSeed('table'), 'Table 2', 8, null), 'Dropped'));
    const back = undo(f);
    expect(at(back, 'Table 2').seats[7]?.stage).toBe('Served');
    expect(at(back, 'Table 2').seats[7]?.owed).toHaveLength(1);
    expect(back.undo).toBeNull();
    expect(back.heard).toBe('Undone: Sent back: Kemi Oke’s Goat curry · Dropped');
  });

  it('draws the undo board’s guest To serve, the sent-back order owed under them, until Undo', () => {
    const f = floorSeed('undo');
    const kemi = at(f, 'Table 2').seats[7];
    expect(kemi?.stage).toBe('To serve');
    expect(kemi?.owed.map((o) => owedLine(at(f, 'Table 2'), o))).toEqual([
      'Sent back · Not right · Goat curry',
      'Starter · Bring after · Small chops',
    ]);
    const back = at(undo(f), 'Table 2').seats[7];
    expect(back?.stage).toBe('Served');
    expect(back?.owed.map((o) => o.items)).toEqual(['Small chops']);
  });

  it('leaves another device’s change since the step as it is on Undo', () => {
    const sent = sendBack(
      pickReason(openSendBack(floorSeed('yours'), 'Table 4', 1, null), 'Dropped'),
    );
    const back = undo(servedElsewhere(sent));
    const t4 = at(back, 'Table 4');
    expect(t4.seats.map((g) => g.stage)).toEqual(Array(10).fill('Served'));
    expect(t4.trays).toEqual([]);
    expect(t4.seats[0]?.owed).toEqual([]);
    expect(t4.seats[0]?.sentBack).toBe(false);
  });

  it('sends back a Served owed plate as itself, and Undo makes it Served and sendable again', () => {
    const f = floorSeed('table');
    const kemi = at(f, 'Table 2').seats[7];
    const chops = kemi?.owed[0];
    if (chops == null) throw new Error('Kemi’s Small chops');
    expect(canSendBackOwed(f, at(f, 'Table 2'), chops)).toBe(true);
    const sent = sendBack(pickReason(openSendBack(f, 'Table 2', 8, 0), 'Wrong dish'));
    const after = at(sent, 'Table 2').seats[7];
    expect(after?.owed.map((o) => [o.items, o.why, o.reason, o.stage])).toEqual([
      ['Small chops', 'Sent back', 'Wrong dish', 'To serve'],
    ]);
    expect(after?.stage).toBe('Served');
    expect(after?.sentBack).toBe(false);
    const again = after?.owed[0];
    expect(again == null ? true : canSendBackOwed(sent, at(sent, 'Table 2'), again)).toBe(false);
    expect(sendBack(pickReason(openSendBack(sent, 'Table 2', 8, 0), 'Dropped'))).toMatchObject({
      steps: sent.steps,
    });
    const back = at(undo(sent), 'Table 2').seats[7];
    expect(back?.owed.map((o) => [o.items, o.why, o.stage, o.sentBack])).toEqual([
      ['Small chops', 'Bring after', 'Served', false],
    ]);
  });
});

describe('a table the person may not write at', () => {
  it('draws no action, and the API’s refusal is table_not_yours', () => {
    const f = openTable(floorSeed('yours'), 'Table 3');
    const t3 = at(f, 'Table 3');
    expect(mayWrite(f, t3)).toBe(false);
    expect(refusalAt(f, t3)).toBe('table_not_yours');
    expect(t3.seats.some((g) => canSendBack(f, t3, g))).toBe(false);
    expect(openSendBack(f, 'Table 3', 1, null)).toBe(f);
  });

  it('is open to anyone when nobody is on its section', () => {
    const f = floorSeed('nobody');
    expect(mayWrite(f, at(f, 'Table 7'))).toBe(true);
  });
});

describe('live and offline', () => {
  it('reads the strip’s two states at 24-hour times, with the taps waiting', () => {
    expect(stripLine(floorSeed('yours'))).toBe('Connected · up to date at 21:04');
    expect(stripLine(floorSeed('offline'))).toBe('No connection · as of 21:04 · 2 taps waiting');
  });

  it('marks each kept tap Waiting to send', () => {
    const f = floorSeed('offline');
    const t2 = at(f, 'Table 2');
    expect(t2.seats[4]?.held?.kept).toBe(true);
    expect(t2.seats[1]?.stage).toBe('To serve');
    expect(t2.seats[1]?.owed[0]).toMatchObject({ why: 'Sent back', reason: 'Dropped', kept: true });
    const more = choose(f, 'Table 2', 5, WAIT_ALL);
    expect(stripLine(more)).toBe('No connection · as of 21:04 · 3 taps waiting');
  });

  it('marks an order whose send-back was undone offline Waiting to send, until connecting again', () => {
    const off = loseConnection(floorSeed('table'));
    const back = undo(sendBack(pickReason(openSendBack(off, 'Table 2', 8, null), 'Dropped')));
    const kemi = at(back, 'Table 2').seats[7];
    expect(kemi?.stage).toBe('Served');
    expect(kemi?.kept).toBe(true);
    expect(stripLine(back)).toContain('2 taps waiting');
    expect(at(reconnect(back), 'Table 2').seats[7]?.kept).toBe(false);
    const twice = at(
      sendBack(pickReason(openSendBack(back, 'Table 2', 8, null), 'Wrong dish')),
      'Table 2',
    ).seats[7];
    expect(twice?.stage).toBe('To serve');
    expect(twice?.kept).toBe(false);
    expect(twice?.owed.map((o) => [o.reason, o.kept])).toEqual([
      ['Wrong dish', true],
      [null, false],
    ]);
    const online = floorSeed('table');
    const live = undo(sendBack(pickReason(openSendBack(online, 'Table 2', 8, null), 'Dropped')));
    expect(at(live, 'Table 2').seats[7]?.kept).toBe(false);
  });

  it('sends the kept taps on connecting again, so none still reads Waiting to send', () => {
    const f = reconnect(choose(floorSeed('offline'), 'Table 2', 5, WAIT_ALL));
    const t2 = at(f, 'Table 2');
    expect(stripLine(f)).toBe('Connected · up to date at 21:04');
    expect(f.kept).toBe(0);
    expect(f.undo?.kept).toBe(false);
    expect(t2.seats[4]?.held?.kept).toBe(false);
    expect(t2.seats[1]?.owed.some((o) => o.kept)).toBe(false);
    const off = choose(loseConnection(f), 'Table 2', 5, READY_NOW);
    expect(stripLine(off)).toBe('No connection · as of 21:04 · 1 tap waiting');
  });

  it('names who changed the guest first in the Not sent card, until dismissed', () => {
    const f = floorSeed('notSent');
    expect(f.notSent).toEqual([
      'Ada Obi is now Served, marked by Tomi Ade.',
      'Too late to undo: 2 minutes had passed.',
    ]);
    expect(dismissNotSent(f).notSent).toEqual([]);
  });

  it('adds 2 minutes for Undo across the hour and midnight', () => {
    expect(undoUntil('21:59')).toBe('22:01');
    expect(undoUntil('23:59')).toBe('00:01');
  });
});

describe('a section changing hands', () => {
  it('moves the tables between the groups, keeps them on Floor, and says where the person is', () => {
    const f = movedTo(floorSeed('yours'), 'D');
    expect(f.line).toBe('You’re on Section D now.');
    expect(names(f)[0]).toBe('Yours · Section D: Table 8, Table 9');
    expect(names(f)[1]).toContain('Table 2');
    expect(f.places).toHaveLength(12);
  });
});

it('opens on the state in the link, and on yours otherwise', () => {
  expect(floorStateOf('undo')).toBe('undo');
  expect(floorStateOf('nonsense')).toBe('yours');
  expect(floorStateOf(undefined)).toBe('yours');
});
