import { describe, expect, it } from 'vitest';
import {
  type FloorRead,
  type FloorReversed,
  type ServiceCourseRead,
  type ServiceGuestRead,
  type ServiceOrderRead,
  type ServiceTableRead,
  floorGroups,
  floorTables,
  floorWord,
  inFloorOrder,
  owesSentBack,
  sectionsMoved,
  stageLeftBy,
  withKeptTaps,
} from './serviceFloor.ts';
import type { PlateStage } from './serviceStages.ts';

const NO_FLAGS = { allergens: [], allergenOther: null, diet: [], dietOther: null };

function order(stage: PlateStage, extra: Partial<ServiceOrderRead> = {}): ServiceOrderRead {
  return {
    id: `p-${Math.random()}`,
    guestId: 'g',
    courseId: 'c',
    isOrder: true,
    stage,
    items: [],
    trayId: null,
    owedReason: null,
    sentBack: [],
    held: false,
    holding: [],
    choice: null,
    owed: [],
    ...extra,
  };
}

function guest(
  seat: number,
  at: ServiceOrderRead | null,
  extra: Partial<ServiceGuestRead> = {},
): ServiceGuestRead {
  return {
    id: `g${seat}`,
    seat,
    name: null,
    flags: NO_FLAGS,
    order: at,
    noOrder: at == null ? 'notHereYet' : null,
    ...extra,
  };
}

function table(
  name: string,
  guests: ServiceGuestRead[],
  extra: Partial<ServiceTableRead> = {},
): ServiceTableRead {
  return {
    key: name,
    kind: 'table',
    name,
    seats: [],
    section: { id: 'A', name: 'Section A' },
    people: [{ id: 's1', name: 'Bisi Lawal' }],
    firedAt: guests.some((g) => g.order != null) ? '2027-03-06T19:00:00Z' : null,
    guests,
    ...extra,
  };
}

function course(id: string, tables: ServiceTableRead[]): ServiceCourseRead {
  return { course: { id, name: id }, items: [], tables, trays: [] };
}

function floor(courses: ServiceCourseRead[], extra: Partial<FloorRead> = {}): FloorRead {
  return {
    event: 'Wedding',
    courses,
    yours: [],
    floorLead: 'Ifeoma Nduka',
    manage: false,
    ...extra,
  };
}

describe('floorWord', () => {
  const t = (...gs: ServiceGuestRead[]) => table('Table 1', gs);

  it('takes the first word that applies, in the plan’s order', () => {
    const held = order('toServe', { held: true });

    expect(floorWord([t(guest(1, order('toServe')), guest(2, order('dishing')))], t())).toBe(
      'toServe',
    );
    expect(floorWord([t(guest(1, held), guest(2, order('onItsWay')))], t())).toBe('onATray');
    expect(floorWord([t(guest(1, held), guest(2, order('served')))], t())).toBe(
      'waitingOnTheKitchen',
    );
    expect(floorWord([t(guest(1, order('served')))], t(guest(1, order('served'))))).toBe('served');
  });

  it('counts an owed plate as an order', () => {
    const sentBack = order('served', {
      owed: [{ ...order('toServe'), isOrder: false, owedReason: 'sentBack' }],
    });

    expect(floorWord([t(guest(1, sentBack))], t())).toBe('toServe');
  });

  it('says nobody has arrived before it says nothing is fired', () => {
    expect(floorWord([], t(guest(1, null)))).toBe('notHereYet');
    expect(floorWord([], t(guest(1, null, { noOrder: null })))).toBe('notFiredYet');
  });
});

describe('inFloorOrder', () => {
  it('puts Table 2 before Table 10, then rows, then single seats, whatever order they arrive in', () => {
    const names = inFloorOrder(
      [
        { kind: 'block' as const, name: null, seats: ['S10', 'S11'] },
        { kind: 'table' as const, name: 'Table 10', seats: [] },
        { kind: 'row' as const, name: 'Row B', seats: [] },
        { kind: 'block' as const, name: null, seats: ['S2', 'S9'] },
        { kind: 'table' as const, name: 'Table 2', seats: [] },
        { kind: 'row' as const, name: 'Row A', seats: [] },
      ],
      'en',
    ).map((one) => one.name ?? one.seats[0]);

    expect(names).toEqual(['Table 2', 'Table 10', 'Row A', 'Row B', 'S2', 'S10']);
  });
});

describe('floorTables', () => {
  it('names an earlier course and counts its served and its open flags', () => {
    const allergic = { ...NO_FLAGS, allergens: ['peanuts'] };
    const starter = course('Starter', [
      table('Table 1', [guest(1, order('served')), guest(2, order('served'))]),
      table('Table 2', [
        guest(1, order('served')),
        guest(2, order('onItsWay'), { flags: allergic }),
      ]),
    ]);
    const mains = course('Mains', [
      table('Table 1', [guest(1, order('served')), guest(2, order('toServe'))]),
      table(
        'Table 2',
        [guest(1, null, { noOrder: null }), guest(2, null, { noOrder: null, flags: allergic })],
        { firedAt: null },
      ),
    ]);
    const [one, two] = floorTables(floor([starter, mains]));

    expect(one).toMatchObject({
      word: 'toServe',
      earlierCourse: null,
      served: 1,
      ordered: 2,
      flagged: [],
    });
    expect(two).toMatchObject({
      word: 'onATray',
      earlierCourse: 'Starter',
      served: 1,
      ordered: 2,
    });
    expect(two!.flagged.map((g) => g.id)).toEqual(['g2']);
  });

  it('reads "0 of 10 served" before anything is fired, never "0 of 0"', () => {
    const guests = Array.from({ length: 10 }, (_, i) => guest(i + 1, null, { noOrder: null }));

    expect(floorTables(floor([course('Mains', [table('Table 1', guests)])]))[0]).toMatchObject({
      word: 'notFiredYet',
      served: 0,
      ordered: 10,
    });
  });
});

describe('an order sent back', () => {
  const at = (stage: PlateStage) =>
    floorTables(
      floor([
        course('Mains', [table('Table 1', [guest(1, order(stage, { owedReason: 'sentBack' }))])]),
      ]),
    )[0]!.guests[0]!.owed;

  it('is owed as itself until it is served again', () => {
    expect(at('toServe')).toMatchObject([{ isOrder: true, owedReason: 'sentBack' }]);
    expect(at('served')).toEqual([]);
  });
});

describe('floorGroups', () => {
  const mains = course('Mains', [
    table('Table 10', [], { section: { id: 'B', name: 'Section B' } }),
    table('Table 2', [], { section: { id: 'A', name: 'Section A' } }),
    table('Table 3', [], { section: { id: 'C', name: 'Section C' }, people: [] }),
  ]);
  const titles = (f: FloorRead) =>
    floorGroups(f, 'en').map((g) =>
      g.kind === 'noSection'
        ? `none:${g.lead}`
        : `${g.kind}:${g.tables.map((t) => t.name).join(',')}`,
    );

  it('draws a group per section you are on, then every other table', () => {
    expect(titles(floor([mains], { yours: [{ id: 'A', name: 'Section A' }] }))).toEqual([
      'yours:Table 2',
      'other:Table 3,Table 10',
    ]);
    expect(
      titles(
        floor([mains], {
          yours: [
            { id: 'A', name: 'Section A' },
            { id: 'B', name: 'Section B' },
          ],
        }),
      ),
    ).toEqual(['yours:Table 2', 'yours:Table 10', 'other:Table 3']);
  });

  it('names the lead to a person on no section, and draws neither to service.manage', () => {
    expect(titles(floor([mains]))).toEqual(['none:Ifeoma Nduka', 'other:Table 2,Table 3,Table 10']);
    expect(titles(floor([mains], { manage: true }))).toEqual(['other:Table 2,Table 3,Table 10']);
  });

  it('lets a waiter write at their section and at one nobody is on', () => {
    const write = floorTables(floor([mains], { yours: [{ id: 'A', name: 'Section A' }] })).map(
      (t) => [t.name, t.mayWrite],
    );

    expect(write).toEqual([
      ['Table 10', false],
      ['Table 2', true],
      ['Table 3', true],
    ]);
  });
});

describe('the table’s view across courses', () => {
  const allergic = { ...NO_FLAGS, allergens: ['peanuts'] };
  const plate = { ...order('toServe'), isOrder: false, courseId: 'Starter', trayId: 't1' };
  const sentBack = { ...plate, id: 'owed', owedReason: 'sentBack' as const };
  const starter = {
    ...course('Starter', [
      table('Table 4', [
        guest(1, order('served', { courseId: 'Starter', owed: [sentBack] }), { flags: allergic }),
      ]),
    ]),
    trays: [
      {
        id: 't1',
        courseId: 'Starter',
        table: 'Table 4',
        waiter: { id: 's1', name: 'Bisi Lawal' },
        plates: ['owed'],
        done: false,
      },
    ],
  };
  const mains = course('Mains', [
    table('Table 4', [guest(1, order('toServe', { courseId: 'Mains' }), { flags: allergic })]),
  ]);
  const [four] = floorTables(floor([starter, mains]));

  it('keeps an owed plate from an earlier course under its guest, with its tray', () => {
    expect(four!.guests[0]!.owed).toEqual([sentBack]);
    expect(four!.trays).toEqual([{ id: 't1', waiter: 'Bisi Lawal', plates: 1, stage: 'toServe' }]);
    // The mains order is not the plate that was sent back, so it can still be.
    expect(owesSentBack(four!.guests[0]!)).toBe(false);
  });

  it('counts a flagged guest open on two courses once', () => {
    expect(four!.flagged.map((g) => g.id)).toEqual(['g1']);
  });
});

describe('sectionsMoved', () => {
  const a = { id: 'A', name: 'Section A' };
  const b = { id: 'B', name: 'Section B' };

  it('names every section left or joined to, none when left on none, and nothing unchanged', () => {
    expect(sectionsMoved(['A', 'B'], [a])).toEqual(['Section A']);
    expect(sectionsMoved(['A'], [a, b])).toEqual(['Section A', 'Section B']);
    expect(sectionsMoved(['A'], [])).toEqual([]);
    expect(sectionsMoved(['B', 'A'], [a, b])).toBeNull();
  });
});

describe('withKeptTaps', () => {
  const held = order('toServe', { id: 'p1', held: true });
  const read = floor([course('Mains', [table('Table 1', [guest(1, held)])])]);
  const tap = (kind: string, path: string, body: object) => ({
    key: `${kind}-key`,
    kind,
    path,
    body,
    tappedAt: '2027-03-06T19:00:00Z',
  });
  const choice = tap('choice', '/plates/p1/choice', { choice: 'waitForAll' });
  const back = tap('sendBack', '/plates/p1/sent-back', { reason: 'dropped' });
  const at = (f: FloorRead) => f.courses[0]!.tables[0]!.guests[0]!.order!;

  it('shows a kept choice, then the order itself sent back', () => {
    expect(at(withKeptTaps(read, [choice])).choice).toBe('waitForAll');
    expect(at(withKeptTaps(read, [choice, back]))).toMatchObject({
      id: 'p1',
      stage: 'toServe',
      choice: null,
      owedReason: 'sentBack',
      sentBack: [{ reason: 'dropped' }],
      owed: [],
    });
  });

  it('takes a kept step off again under a kept Undo', () => {
    const undone = at(withKeptTaps(read, [back, tap('undo', '/undo', { subject: 'p1' })]));

    expect(undone).toEqual(held);
  });

  it('shows a kept Undo of a step the server already has as made', () => {
    const owed = order('toServe', {
      id: 'p2',
      owedReason: 'sentBack',
      sentBack: [{ reason: 'dropped', at: '2027-03-06T19:00:00Z', by: null }],
    });
    const sent = floor([
      course('Mains', [
        table('Table 1', [guest(1, { ...held, choice: 'waitForAll', owed: [owed] })]),
      ]),
    ]);
    const undo = (subject: string, reverses: FloorReversed) => ({
      ...tap('undo', '/undo', { subject }),
      reverses,
    });

    expect(
      at(withKeptTaps(sent, [undo('p2', { kind: 'sendBack', was: 'toFollow' })])).owed,
    ).toMatchObject([{ id: 'p2', stage: 'served', owedReason: 'toFollow', sentBack: [] }]);
    expect(at(withKeptTaps(sent, [undo('p1', { kind: 'choice', was: null })])).choice).toBeNull();
  });
});

describe('stageLeftBy', () => {
  it('is To serve after a send-back, and the unmoved stage after a choice', () => {
    expect(stageLeftBy(order('served'), { kind: 'sendBack', was: null })).toBe('toServe');
    expect(stageLeftBy(order('dishing'), { kind: 'choice', was: null })).toBe('dishing');
  });
});
