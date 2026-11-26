import { describe, expect, it } from 'vitest';
import {
  type FloorRead,
  type ServiceCourseRead,
  type ServiceGuestRead,
  type ServiceOrderRead,
  type ServiceTableRead,
  floorGroups,
  floorTables,
  floorWord,
  inFloorOrder,
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
    seats: guests.length,
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
  return { courses, yours: [], floorLead: 'Ifeoma Nduka', manage: false, ...extra };
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
        { kind: 'seats' as const, name: 'Seats 1–10' },
        { kind: 'table' as const, name: 'Table 10' },
        { kind: 'row' as const, name: 'Row B' },
        { kind: 'table' as const, name: 'Table 2' },
        { kind: 'row' as const, name: 'Row A' },
      ],
      'en',
    ).map((one) => one.name);

    expect(names).toEqual(['Table 2', 'Table 10', 'Row A', 'Row B', 'Seats 1–10']);
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
      flagged: 0,
    });
    expect(two).toMatchObject({
      word: 'onATray',
      earlierCourse: 'Starter',
      served: 1,
      ordered: 2,
      flagged: 1,
    });
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
