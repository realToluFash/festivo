import {
  ApiError,
  type ServicePlate,
  type ServiceRead,
  type ServiceTray,
  keepServiceTap,
  keptServiceTap,
  memoryServiceTapStore,
  sendServiceTaps,
} from '@soirely/api-client';
import { readFileSync } from 'node:fs';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  NO_FLAGS,
  type StationMark,
  hereSince,
  notSentLine,
  openingStation,
  pickedKey,
  refusedAccess,
  rememberPick,
  stationTime,
  stationView,
  topicMessage,
  undoOpen,
  undoPlan,
  undoWords,
  withoutRefused,
} from './kitchenStation.ts';

const PASS = 'pass';
const GRILL = 'grill';
const COLD = 'cold';
const at = (minutes: number) => new Date(Date.UTC(2027, 2, 6, 19, minutes)).toISOString();
const now = new Date(at(10));

const stations = { [PASS]: 'Pass', [GRILL]: 'Grill', [COLD]: 'Cold room' };
const station = (id: keyof typeof stations) => ({ id, name: stations[id] });

function plate(
  id: string,
  guest: string,
  course: string,
  keys: string[],
  extra: Partial<ServicePlate> = {},
): ServicePlate {
  return {
    id,
    guestId: guest,
    courseId: course,
    isOrder: true,
    stage: 'toServe',
    items: keys.map((key) => ({
      key,
      name: key === 'chef' ? null : key[0]!.toUpperCase() + key.slice(1),
      state: 'ready',
    })),
    variant: null,
    toFollow: [],
    trayId: null,
    owedReason: null,
    owedAt: null,
    ...extra,
  };
}

interface Guest {
  id: string;
  seat: string;
  order: ServicePlate | null;
  owed?: ServicePlate[];
  allergens?: string[];
  held?: string[];
}

function read(
  course: { id: string; name: string },
  items: {
    key: string;
    at: keyof typeof stations;
    state?: 'ready' | 'preparing';
    readyIn?: number | null;
  }[],
  guests: Guest[],
  trays: ServiceTray[] = [],
): ServiceRead {
  return {
    course,
    items: items.map((one) => ({
      id: null,
      key: one.key,
      name: one.key[0]!.toUpperCase() + one.key.slice(1),
      station: station(one.at),
      state: one.state ?? 'ready',
      readyIn: one.readyIn ?? null,
      changedAt: one.state === 'preparing' ? at(0) : null,
      changedBy: null,
      preparingSince: one.state === 'preparing' ? at(0) : null,
    })),
    tables: [
      {
        key: 't4',
        kind: 'table',
        name: 'Table 4',
        firedAt: at(0),
        plates: [],
        guests: guests.map((guest) => ({
          id: guest.id,
          seat: guest.seat,
          flags: { ...NO_FLAGS, allergens: guest.allergens ?? [] },
          order:
            guest.order == null
              ? null
              : {
                  ...guest.order,
                  owed: guest.owed ?? [],
                  held: (guest.held ?? []).length > 0,
                  holding: guest.held ?? [],
                },
        })),
      },
    ],
    trays,
    phase: 'on',
  };
}

function tray(
  id: string,
  plates: string[],
  stops: {
    id: keyof typeof stations;
    marks: [string, string, ('on' | 'notOn' | null)?, number?][];
  }[],
  extra: Partial<ServiceTray> = {},
): ServiceTray {
  return {
    id,
    courseId: 'main',
    table: 't4',
    waiter: { id: 'w', name: 'Chidi Okafor' },
    plates,
    stops: stops.map((stop) => ({
      ...station(stop.id),
      marks: stop.marks.map(([plateId, item, mark, minute]) => ({
        plateId,
        item,
        mark: mark ?? null,
        at: mark == null ? null : at(minute ?? 0),
      })),
    })),
    steps: [{ step: 'start', at: at(1), by: 'w' }],
    done: false,
    ...extra,
  };
}

const MAIN = { id: 'main', name: 'Mains' };
const STARTER = { id: 'starter', name: 'Starter' };
const ITEMS = [
  { key: 'jollof', at: GRILL },
  { key: 'plantain', at: COLD },
  { key: 'chef', at: PASS },
] as const;

describe('stationView', () => {
  it('says nothing is fired before any course is', () => {
    expect(stationView(GRILL, [], now)).toEqual({
      fired: false,
      latest: null,
      left: [],
      heading: [],
      here: [],
    });
  });

  it('lists only its own items on Left to dish, and the Pass the items no station dishes and Chef’s choice', () => {
    const main = read(
      MAIN,
      [...ITEMS],
      [{ id: 'a', seat: '1', order: plate('p1', 'a', 'main', ['jollof', 'plantain']) }],
    );

    expect(stationView(GRILL, [main], now).left.map((one) => [one.key, one.toDish])).toEqual([
      ['jollof', 1],
    ]);
    expect(stationView(PASS, [main], now).left.map((one) => one.key)).toEqual(['chef']);
  });

  it('counts plates not yet On here, owed plates among them, and keeps an earlier course’s item only while a plate needs it', () => {
    const onTray = plate('p1', 'a', 'main', ['jollof'], { stage: 'dishing', trayId: 't1' });
    const notOn = plate('p2', 'b', 'main', ['jollof'], { stage: 'dishing', trayId: 't1' });
    const served = plate('p3', 'c', 'main', ['jollof'], { stage: 'served' });
    const owed = plate('p4', 'c', 'main', ['jollof'], { isOrder: false, owedReason: 'bringAfter' });
    const t1 = tray(
      't1',
      ['p1', 'p2'],
      [
        { id: PASS, marks: [] },
        {
          id: GRILL,
          marks: [
            ['p1', 'jollof', 'on'],
            ['p2', 'jollof', 'notOn'],
          ],
        },
      ],
    );
    const main = read(
      MAIN,
      [...ITEMS],
      [
        { id: 'a', seat: '1', order: onTray },
        { id: 'b', seat: '2', order: notOn },
        { id: 'c', seat: '3', order: served, owed: [owed] },
      ],
      [t1],
    );
    const starterNeeded = read(
      STARTER,
      [{ key: 'puff', at: GRILL }],
      [{ id: 'a', seat: '1', order: plate('s1', 'a', 'starter', ['puff']) }],
    );
    const starterDone = read(
      STARTER,
      [{ key: 'puff', at: GRILL }],
      [{ id: 'a', seat: '1', order: plate('s1', 'a', 'starter', ['puff'], { stage: 'served' }) }],
    );

    expect(
      stationView(GRILL, [starterNeeded, main], now).left.map((one) => [
        one.course,
        one.key,
        one.toDish,
      ]),
    ).toEqual([
      [null, 'jollof', 2],
      ['Starter', 'puff', 1],
    ]);
    expect(stationView(GRILL, [starterDone, main], now).left.map((one) => one.key)).toEqual([
      'jollof',
    ]);
  });

  it('counts the guests held on an item, and reads Held up by the shared rule', () => {
    const main = read(
      MAIN,
      [{ key: 'jollof', at: GRILL, state: 'preparing', readyIn: 5 }],
      [{ id: 'a', seat: '1', order: plate('p1', 'a', 'main', ['jollof']), held: ['jollof'] }],
    );
    const [line] = stationView(GRILL, [main], new Date(at(4))).left;

    expect([line?.waiting, line?.heldUp]).toEqual([1, null]);
    expect(stationView(GRILL, [main], new Date(at(5))).left[0]?.heldUp).toBe(5);

    const nobodyHeld = read(
      MAIN,
      [{ key: 'jollof', at: GRILL, state: 'preparing', readyIn: 5 }],
      [{ id: 'a', seat: '1', order: plate('p1', 'a', 'main', ['jollof']) }],
    );
    expect(stationView(GRILL, [nobodyHeld], new Date(at(9))).left[0]?.heldUp).toBeNull();
  });

  it('lists started trays heading here oldest first, with each item’s count and the flagged plates', () => {
    const p = (id: string, guest: string) =>
      plate(id, guest, 'main', ['jollof', 'plantain'], { stage: 'dishing', trayId: 'x' });
    const older = tray(
      'older',
      ['p1', 'p2'],
      [
        { id: PASS, marks: [] },
        {
          id: COLD,
          marks: [
            ['p1', 'plantain'],
            ['p2', 'plantain'],
          ],
        },
        {
          id: GRILL,
          marks: [
            ['p1', 'jollof'],
            ['p2', 'jollof'],
          ],
        },
      ],
    );
    const newer = tray(
      'newer',
      ['p3'],
      [
        { id: PASS, marks: [] },
        { id: COLD, marks: [['p3', 'plantain']] },
        { id: GRILL, marks: [['p3', 'jollof']] },
      ],
      { steps: [{ step: 'start', at: at(3), by: 'w' }], waiter: { id: 'f', name: 'Funmi Bakare' } },
    );
    const main = read(
      MAIN,
      [...ITEMS],
      [
        { id: 'a', seat: '1', order: p('p1', 'a'), allergens: ['peanuts'] },
        { id: 'b', seat: '2', order: p('p2', 'b') },
        { id: 'c', seat: '3', order: p('p3', 'c') },
      ],
      [newer, older],
    );
    const view = stationView(GRILL, [main], now);

    expect(view.here).toEqual([]);
    expect(
      view.heading.map((one) => [
        one.id,
        one.waiter,
        one.needs.map((need) => [need.name, need.count]),
        one.flagged,
      ]),
    ).toEqual([
      ['older', 'Chidi Okafor', [['Jollof', 2]], 1],
      ['newer', 'Funmi Bakare', [['Jollof', 1]], 0],
    ]);
  });

  it('has a tray here by its earlier stops, by a mark at this stop, and at the Pass as it starts', () => {
    const byEarlier = tray(
      't',
      ['p1'],
      [
        { id: PASS, marks: [['p1', 'chef', 'on', 2]] },
        { id: COLD, marks: [['p1', 'plantain', 'on', 4]] },
        { id: GRILL, marks: [['p1', 'jollof']] },
      ],
    );
    const byMarkHere = tray(
      't',
      ['p1'],
      [
        { id: PASS, marks: [['p1', 'chef']] },
        { id: COLD, marks: [['p1', 'plantain']] },
        {
          id: GRILL,
          marks: [
            ['p1', 'jollof', 'notOn', 6],
            ['p1', 'rice'],
          ],
        },
      ],
    );

    expect(hereSince(byEarlier, GRILL)).toBe(at(4));
    expect(hereSince(byMarkHere, GRILL)).toBe(at(6));
    expect(hereSince(byMarkHere, PASS)).toBe(at(1));
    expect(hereSince(byMarkHere, COLD)).toBeNull();
  });

  it('faces a tray from across the counter, an owed plate first on the tray last from the left, flags in place, the variant and the course', () => {
    const owed = plate('o1', 'c', 'starter', ['puff'], {
      isOrder: false,
      owedReason: 'toFollow',
      stage: 'dishing',
      trayId: 't',
    });
    const one = plate('p1', 'a', 'main', ['jollof'], {
      stage: 'dishing',
      trayId: 't',
      variant: 'Child’s portion',
    });
    const two = plate('p2', 'b', 'main', ['plantain'], { stage: 'dishing', trayId: 't' });
    const t = tray(
      't',
      ['o1', 'p1', 'p2'],
      [
        { id: PASS, marks: [] },
        {
          id: GRILL,
          marks: [
            ['o1', 'puff'],
            ['p1', 'jollof', 'on', 5],
          ],
        },
      ],
    );
    const main = read(
      MAIN,
      [
        { key: 'jollof', at: GRILL, state: 'preparing' },
        { key: 'plantain', at: COLD },
      ],
      [
        { id: 'a', seat: '1', order: one, allergens: ['peanuts'] },
        { id: 'b', seat: '2', order: two },
      ],
      [t],
    );
    const starter = read(
      STARTER,
      [{ key: 'puff', at: GRILL }],
      [{ id: 'c', seat: '3', order: null, owed: [] }],
    );
    starter.tables[0]!.plates.push(owed);
    const [here] = stationView(GRILL, [starter, main], now).here;

    expect(
      here?.faced.map((p) => [
        p.position,
        p.seat,
        p.variant,
        p.flagged,
        p.items.map((i) => [i.course, i.key, i.mark, i.preparing]),
      ]),
    ).toEqual([
      [1, '2', null, false, []],
      [2, '1', 'Child’s portion', true, [[null, 'jollof', 'on', true]]],
      [3, '3', null, false, [['Starter', 'puff', null, false]]],
    ]);
    expect(JSON.stringify(here)).not.toMatch(/name":"(?!Jollof|Puff|Chidi)/);
  });

  it('lets a tray go once every plate is marked here, once it is taken to the table, and once its last plate needing here is taken off', () => {
    const p1 = plate('p1', 'a', 'main', ['jollof'], { stage: 'dishing', trayId: 't' });
    const main = (t: ServiceTray) =>
      read(MAIN, [...ITEMS], [{ id: 'a', seat: '1', order: p1 }], [t]);
    const marked = tray(
      't',
      ['p1'],
      [
        { id: PASS, marks: [] },
        { id: GRILL, marks: [['p1', 'jollof', 'on', 3]] },
      ],
    );
    const taken = tray(
      't',
      ['p1'],
      [
        { id: PASS, marks: [] },
        { id: GRILL, marks: [['p1', 'jollof', null]] },
      ],
      {
        steps: [
          { step: 'start', at: at(1), by: 'w' },
          { step: 'takeToTable', at: at(4), by: 'w' },
        ],
      },
    );
    const takenOff = tray('t', [], [{ id: PASS, marks: [] }]);

    for (const t of [marked, taken, takenOff]) {
      const view = stationView(GRILL, [main(t)], now);
      expect([view.here, view.heading]).toEqual([[], []]);
    }
  });

  it('puts the tray that arrived first on top', () => {
    const p = (id: string) => plate(id, id, 'main', ['jollof'], { stage: 'dishing', trayId: id });
    const late = tray(
      'late',
      ['b'],
      [
        { id: PASS, marks: [['b', 'chef', null]] },
        {
          id: GRILL,
          marks: [
            ['b', 'jollof', 'notOn', 2],
            ['b', 'rice'],
          ],
        },
      ],
    );
    const early = tray(
      'early',
      ['c'],
      [
        { id: PASS, marks: [['c', 'chef', null]] },
        {
          id: GRILL,
          marks: [
            ['c', 'jollof', 'on', 1],
            ['c', 'rice'],
          ],
        },
      ],
    );
    const main = read(
      MAIN,
      [...ITEMS],
      [
        { id: 'b', seat: '2', order: p('b') },
        { id: 'c', seat: '3', order: p('c') },
      ],
      [late, early],
    );

    expect(stationView(GRILL, [main], now).here.map((one) => one.tray.id)).toEqual([
      'early',
      'late',
    ]);
  });
});

describe('openingStation', () => {
  const list = (yours: string | null) => ({
    event: 'Adaeze & Tunde’s wedding',
    you: 'Gbenga Salami',
    stations: [
      { id: PASS, name: 'Pass', people: [] },
      { id: GRILL, name: 'Grill', people: [] },
    ],
    yours,
    fired: [],
  });

  it('opens on the roster’s station even after another was picked', () => {
    expect(openingStation(list(GRILL), PASS)).toBe(GRILL);
  });

  it('opens someone on no station on the one last picked, or the list', () => {
    expect(openingStation(list(null), GRILL)).toBe(GRILL);
    expect(openingStation(list(null), null)).toBeNull();
    expect(openingStation(list(null), 'gone')).toBeNull();
  });
});

describe('undo after a mark (sc-4015)', () => {
  const marked = Date.parse(at(0));
  const mark: StationMark = {
    courseId: 'mains',
    key: 'jollof',
    was: 'ready',
    to: 'preparing',
    tapKey: 'tap-1',
    at: marked,
  };
  const after = (ms: number) => new Date(marked + ms);
  const course = (id: string | null): ServiceRead => ({
    ...read({ id: 'mains', name: 'Mains' }, [{ key: 'jollof', at: 'grill' }], []),
    items: [
      {
        id,
        key: 'jollof',
        name: 'Jollof rice',
        station: station(GRILL),
        state: 'preparing',
        readyIn: 10,
        changedAt: at(0),
        changedBy: 'Kemi',
        preparingSince: at(0),
      },
    ],
  });
  const tap = (key: string) =>
    keptServiceTap(
      'e1',
      { kind: 'itemState', courseId: 'mains', item: 'jollof', state: 'preparing', readyIn: 10 },
      { item: 'ready' },
      key,
    );

  it('is offered until two minutes have passed, by the server’s clock', () => {
    expect(undoOpen(mark, after(119_000))).toBe(true);
    expect(undoOpen(mark, after(120_000))).toBe(false);
  });

  it('is offered on an item’s first mark, which has no id yet', () => {
    expect(undoOpen(mark, after(1_000))).toBe(true);
    expect(undoPlan(mark, [], [course(null)])).toEqual({ kind: 'unknown' });
    expect(undoPlan(mark, [], [course('item-1')])).toEqual({
      kind: 'send',
      subject: 'item-1',
      expected: { item: 'preparing' },
    });
  });

  it('expects the state the mark left, which the server refuses an undo without', () => {
    expect(undoPlan({ ...mark, was: 'preparing', to: 'ready' }, [], [course('item-1')])).toEqual({
      kind: 'send',
      subject: 'item-1',
      expected: { item: 'ready' },
    });
  });

  it('says what the mark made, so a new time while Preparing reads Preparing', () => {
    expect(undoWords({ ...mark, was: 'preparing', to: 'preparing' })).toBe('station.undoPreparing');
    expect(undoWords({ ...mark, was: 'preparing', to: 'ready' })).toBe('station.undoReady');
    expect(undoWords(mark)).toBe('station.undoPreparing');
  });

  it('takes a mark that was never sent out of what is kept, rather than sending an undo', () => {
    expect(undoPlan(mark, [tap('tap-1')], [course(null)])).toEqual({
      kind: 'drop',
      tapKey: 'tap-1',
    });
    expect(undoPlan(mark, [tap('other')], [course('item-1')])).toEqual({
      kind: 'send',
      subject: 'item-1',
      expected: { item: 'preparing' },
    });
  });

  it('is no longer offered on a mark refused as Not sent', () => {
    const marks = new Map([
      ['mains|jollof', mark],
      ['mains|plantain', { ...mark, key: 'plantain', tapKey: 'tap-2' }],
    ]);

    expect([...withoutRefused(marks, [{ tap: tap('tap-1') }]).keys()]).toEqual(['mains|plantain']);
  });
});

describe('a mark kept offline, and its Not sent line (sc-4015)', () => {
  async function english() {
    const i18n = createInstance();
    await i18n.init({
      lng: 'en',
      resources: { en: { translation: en } },
      interpolation: { escapeValue: false },
    });

    return i18n.t;
  }

  const jollof = (): ServiceRead => ({
    ...read({ id: 'mains', name: 'Mains' }, [{ key: 'jollof', at: 'grill' }], []),
    items: [
      {
        id: 'item-1',
        key: 'jollof',
        name: 'Jollof rice',
        station: station(GRILL),
        state: 'preparing',
        readyIn: 10,
        changedAt: at(0),
        changedBy: 'Kemi',
        preparingSince: at(0),
      },
    ],
  });
  const ready = keptServiceTap(
    'e1',
    { kind: 'itemState', courseId: 'mains', item: 'jollof', state: 'ready', readyIn: null },
    { item: 'ready' },
    'tap-1',
  );

  it('stays kept while there is no connection, and is sent when there is one', async () => {
    const store = memoryServiceTapStore();
    await keepServiceTap(store, ready);

    const offline = await sendServiceTaps(store, async () => {
      throw new TypeError('Network request failed');
    });
    expect(offline.left.map((one) => one.key)).toEqual(['tap-1']);
    expect(offline.refused).toEqual([]);

    const online = await sendServiceTaps(store, async () => ({}));
    expect(online.left).toEqual([]);
    expect(online.refetch).toBe(true);
  });

  it('says who got there first when another disher marked the item while it was kept', async () => {
    const store = memoryServiceTapStore();
    await keepServiceTap(store, ready);
    const sent = await sendServiceTaps(store, async () => {
      throw new ApiError({
        type: 'https://soirely.com/errors/service_changed',
        title: 'Service changed',
        status: 409,
        changed: [{ item: 'jollof', state: 'preparing', by: 'Kemi' }],
      } as ConstructorParameters<typeof ApiError>[0]);
    });
    const t = await english();

    expect(sent.left).toEqual([]);
    expect(
      sent.refused.flatMap((one) => one.lines).map((line) => notSentLine(t, line, [jollof()])),
    ).toEqual(['Jollof rice is now Preparing, marked by Kemi.']);
  });
});

describe('the station’s times (sc-4015)', () => {
  it('are 24-hour, whatever the device’s own setting', () => {
    expect(stationTime(new Date(2027, 2, 6, 19, 42), 'en-US')).toBe('19:42');
  });
});

describe('picking a station from the list (sc-4015)', () => {
  it('keeps the pick on this device for the event, and writes nothing else', async () => {
    const writes: [string, string][] = [];
    await rememberPick(
      { getItem: async () => null, setItem: async (key, value) => void writes.push([key, value]) },
      'a1',
      'e1',
      GRILL,
    );

    expect(writes).toEqual([[pickedKey('a1', 'e1'), GRILL]]);
  });

  it('changes no roster: the screen calls the API only to read and to send service taps', () => {
    const source = readFileSync(
      new URL('../components/station/KitchenStationView.tsx', import.meta.url),
      'utf8',
    );
    const calls = [
      ...new Set([...source.matchAll(/\bapi\.(\w+)\(/gu)].map((one) => one[1])),
    ].sort();

    expect(calls).toEqual([
      'kitchenStations',
      'sendServiceTap',
      'serviceRead',
      'serviceSubscription',
    ]);
  });
});

describe('the view’s wiring QA failed (sc-4015)', () => {
  const view = () =>
    readFileSync(new URL('../components/station/KitchenStationView.tsx', import.meta.url), 'utf8');
  const refused = (status: number, worksAt?: 'floor' | 'pass') =>
    new ApiError({ type: 'about:blank', title: 'No', status, ...(worksAt ? { worksAt } : {}) });

  it('sends a floor worker refused here to the floor card, and anyone else to no access', () => {
    expect(refusedAccess(refused(403, 'floor'))).toBe('floor');
    expect(refusedAccess(refused(403, 'pass'))).toBe('none');
    expect(refusedAccess(refused(403))).toBe('none');
    expect(refusedAccess(refused(500, 'floor'))).toBeNull();
    expect(refusedAccess(new Error('offline'))).toBeNull();
    expect(view()).toMatch(/refusedAccess\(error\)/u);
  });

  it('re-reads when the stations change: a stations message is data, not a heartbeat or a phase', () => {
    expect(topicMessage(JSON.stringify({ type: 'stations' }))).toEqual({ kind: 'data' });
    expect(topicMessage(JSON.stringify({ type: 'heartbeat' }))).toEqual({ kind: 'heartbeat' });
    expect(topicMessage(JSON.stringify({ type: 'phase', phase: 'wrapped' }))).toEqual({
      kind: 'phase',
      phase: 'wrapped',
    });
    expect(topicMessage('not json')).toEqual({ kind: 'data' });
    expect(view()).toMatch(/topicMessage\(data\)/u);
  });

  it('tells the freshness line how many marks are kept on the device', () => {
    expect(view()).toMatch(/\.waiting\(kept\.length\)/u);
  });
});
