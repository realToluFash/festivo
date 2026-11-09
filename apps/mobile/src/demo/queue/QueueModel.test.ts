import { describe, expect, it } from 'vitest';

import {
  QUEUE_STATES,
  buildWords,
  builtOrder,
  drawn,
  focusAfter,
  fresh,
  goOnline,
  move,
  pick,
  save,
  seed,
  startBuild,
  startOrder,
  startTray,
  tagsFor,
  waiterNext,
} from './QueueModel.ts';

describe('the starting order', () => {
  it('puts tables by number value, then rows, then seat blocks', () => {
    expect(fresh().queues.A).toEqual([
      'Table 2',
      'Table 4',
      'Table 5',
      'Table 10',
      'Row C',
      'Seats 1 to 10',
    ]);
    expect(startOrder([])).toEqual([]);
  });
});

describe('the controls', () => {
  it('draws none of the three on a one-table section', () => {
    expect(['front', 'up', 'down'].some((c) => drawn(c as 'up', 0, 1))).toBe(false);
  });

  it('draws no Bring forward or Move up first, and no Move down last', () => {
    expect([drawn('front', 0, 6), drawn('up', 0, 6), drawn('down', 0, 6)]).toEqual([
      false,
      false,
      true,
    ]);
    expect([drawn('front', 5, 6), drawn('up', 5, 6), drawn('down', 5, 6)]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('keeps focus on the moved table, or its next drawn control at an end', () => {
    expect(focusAfter('up', 2, 6)).toBe('up');
    expect(focusAfter('front', 0, 6)).toBe('down');
    expect(focusAfter('down', 5, 6)).toBe('up');
  });
});

describe('a move', () => {
  it('brings a table forward and says where it went', () => {
    const s = move(fresh(), 'A', 'Row C', 'front');
    expect(s.queues.A[0]).toBe('Row C');
    expect(s.say).toBe('Row C moved to 1 of 6');
    expect(s.focus).toEqual({ place: 'Row C', control: 'down' });
  });

  it('moves one place up and down', () => {
    expect(move(fresh(), 'A', 'Table 5', 'up').queues.A.slice(0, 3)).toEqual([
      'Table 2',
      'Table 5',
      'Table 4',
    ]);
    expect(move(fresh(), 'A', 'Table 5', 'down').queues.A[3]).toBe('Table 5');
  });

  it('changes nothing when another lead already made it', () => {
    const s = move({ ...fresh(), rivalFirst: true }, 'A', 'Row C', 'front');
    expect(s.queues.A[0]).toBe('Row C');
    expect(s.queues.A).toHaveLength(6);
    expect(s.notice).toBeNull();
  });

  it('is refused offline, and nothing changes', () => {
    const before = goOnline(fresh(), false);
    const s = move(before, 'A', 'Row C', 'front');
    expect(s.queues.A).toEqual(before.queues.A);
    expect(s.say).toBe('Changing the queue needs a connection.');
  });
});

describe('build the queue', () => {
  it('saves the placed tables first and the rest in their present order', () => {
    expect(builtOrder(['T1', 'T2', 'T3', 'T4'], ['T3', 'T1'])).toEqual(['T3', 'T1', 'T2', 'T4']);
    let s = startBuild({ ...fresh(), selected: 'D' }, 'D');
    s = pick(pick(s, 'Table 19'), 'Table 18');
    expect(save(s).queues.D).toEqual(['Table 19', 'Table 18', 'Table 15', 'Table 16', 'Table 17']);
  });

  it('takes a second tap out', () => {
    const s = pick(pick(startBuild(fresh(), 'D'), 'Table 19'), 'Table 19');
    expect(s.build?.picked).toEqual([]);
  });

  it('keeps Save off until one table is placed', () => {
    expect(buildWords(['T1', 'T2'], []).canSave).toBe(false);
    expect(buildWords(['T1', 'T2'], ['T2'])).toEqual({
      line: 'Then T1, as they are now.',
      saveLabel: 'Save the queue · T2 first',
      canSave: true,
    });
  });

  it('is refused with the other lead named when the queue changed since', () => {
    const s = save(pick(startBuild({ ...fresh(), rivalFirst: true }, 'D'), 'Table 19'));
    expect(s.notice).toEqual({ kind: 'conflict', by: 'Tobi Adeyemi', section: 'D' });
    expect(s.queues.D[0]).toBe('Table 19');
    expect(s.build).toBeNull();
  });
});

describe('the tags', () => {
  it('tags a table whose orders are all served Served, and keeps its place', () => {
    const s = fresh();
    expect(tagsFor(s, 'A', 'Table 2').map((t) => t.label)).toEqual(['Served']);
    expect(s.queues.A.indexOf('Table 2')).toBe(0);
  });

  it('names whose tray is out, and the next table', () => {
    const s = fresh();
    expect(tagsFor(s, 'A', 'Table 4')[0]?.label).toBe('Now · Kunle’s tray');
    expect(tagsFor(s, 'A', 'Table 5')[0]?.label).toBe('Up next');
  });
});

describe('the waiter’s Next', () => {
  it('offers an owed plate first', () => {
    expect(waiterNext(fresh())).toEqual({ place: 'Table 10', section: 'A', owed: true });
  });

  it('tells the waiter when a lead’s change moves their next table', () => {
    const s = seed('waiterNotice');
    expect(s.waiterToast).toBe('Ifeoma Nduka changed your queue · Table 5 is next');
    expect(s.moved).toEqual({ place: 'Table 5', by: 'Ifeoma Nduka' });
  });

  it('shows nothing when their next table stays', () => {
    expect(seed('waiterSame').waiterToast).toBe('');
  });

  it('drops Moved up by once its tray starts', () => {
    expect(startTray(seed('waiterNotice')).moved).toBeNull();
  });

  it('takes owed plates across both sections oldest first, then a tie to their own', () => {
    expect(waiterNext(seed('asWell'))?.place).toBe('Table 6');
    expect(waiterNext(seed('asWellTie'))).toEqual({ place: 'Table 5', section: 'A', owed: false });
  });
});

it('seeds every state', () => {
  for (const name of QUEUE_STATES) expect(seed(name).queues.A).toHaveLength(6);
});
