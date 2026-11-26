import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './problem.ts';
import {
  type KeptServiceTap,
  asKeptServiceTaps,
  keepServiceTap,
  keptServiceTap,
  memoryServiceTapStore,
  sendServiceTaps,
} from './serviceTapQueue.ts';

const ERRORS = 'https://soirely.com/errors/';
const AT = new Date('2027-03-06T19:00:00Z');

function tap(key: string): KeptServiceTap {
  return keptServiceTap(
    'e1',
    { kind: 'check', trayId: 't1' },
    { plates: { p1: 'dishing' } },
    key,
    AT,
  );
}

function onPlate(key: string, plate: string): KeptServiceTap {
  return keptServiceTap(
    'e1',
    { kind: 'tick', trayId: 't2', plateId: plate },
    { plates: { [plate]: 'onItsWay' } },
    key,
    AT,
  );
}

function item(key: string, name: string): KeptServiceTap {
  return keptServiceTap(
    'e1',
    { kind: 'itemState', courseId: 'c1', item: name, state: 'ready' },
    { item: 'preparing' },
    key,
    AT,
  );
}

function refused(
  status: number,
  type: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return new ApiError(
    { type: `${ERRORS}${type}`, title: type, status, ...extra } as never,
    new Response(null, { status, headers }),
  );
}

describe('a kept service tap', () => {
  it('names its request under the event, with its key and what it saw', () => {
    expect(
      keptServiceTap(
        'e1',
        { kind: 'tick', trayId: 't1', plateId: 'p 2' },
        { plates: { 'p 2': 'onItsWay' } },
        'k1',
        AT,
      ),
    ).toEqual({
      key: 'k1',
      eventId: 'e1',
      kind: 'tick',
      method: 'POST',
      path: '/trays/t1/plates/p%202/served',
      body: {},
      expected: { plates: { 'p 2': 'onItsWay' } },
      tappedAt: AT.toISOString(),
    });
    expect(
      keptServiceTap(
        'e1',
        { kind: 'itemState', courseId: 'c1', item: 'plantain', state: 'preparing', readyIn: 5 },
        { item: 'ready' },
        'k2',
        AT,
      ),
    ).toMatchObject({
      method: 'PUT',
      path: '/course/c1/items',
      body: { item: 'plantain', state: 'preparing', readyIn: 5 },
    });
  });

  it('is read back from storage only when whole', () => {
    expect(asKeptServiceTaps([tap('k1'), { ...tap('k2'), kind: 'startTray' }, null, 'x'])).toEqual([
      tap('k1'),
    ]);
    expect(asKeptServiceTaps('nonsense')).toEqual([]);
  });
});

describe('sending kept taps', () => {
  it('sends in order, each with its own key, and refetches once all are answered', async () => {
    const store = memoryServiceTapStore([tap('k1'), tap('k2')]);
    const keys: string[] = [];

    const sent = await sendServiceTaps(store, async (one) => {
      keys.push(one.key);
    });

    expect(keys).toEqual(['k1', 'k2']);
    expect(sent).toEqual({ refused: [], dropped: [], left: [], refetch: true });
  });

  it('sends each tap once when a second send starts while the first runs', async () => {
    const store = memoryServiceTapStore([tap('k1'), tap('k2')]);
    const keys: string[] = [];
    const send = async (one: KeptServiceTap) => {
      keys.push(one.key);
      await Promise.resolve();
    };

    const [first, second] = await Promise.all([
      sendServiceTaps(store, send),
      sendServiceTaps(store, send),
    ]);

    expect(keys).toEqual(['k1', 'k2']);
    expect(first).toEqual({ refused: [], dropped: [], left: [], refetch: true });
    expect(second).toEqual({ refused: [], dropped: [], left: [], refetch: false });
  });

  it('drops a refused tap with its lines, and still sends the ones after it', async () => {
    const store = memoryServiceTapStore([tap('k1'), onPlate('k2', 'p9')]);
    const changed = [
      {
        plateId: 'p1',
        guestId: 'g1',
        table: '4',
        stage: 'served',
        onTray: true,
        by: 'Ifeoma Nduka',
      },
    ];

    const sent = await sendServiceTaps(store, async (one) => {
      if (one.key === 'k1') throw refused(409, 'service_changed', { changed });
    });

    expect(sent.refused).toEqual([
      {
        tap: tap('k1'),
        lines: [
          {
            kind: 'stageNow',
            plateId: 'p1',
            guestId: 'g1',
            table: '4',
            stage: 'served',
            by: 'Ifeoma Nduka',
          },
        ],
      },
    ]);
    expect(sent.left).toEqual([]);
    expect(sent.refetch).toBe(true);
  });

  it('stops with no answer or a 5xx, keeping the tap and the ones after it, and does not refetch', async () => {
    for (const failure of [new TypeError('Failed to fetch'), refused(503, 'unavailable')]) {
      const store = memoryServiceTapStore([tap('k1'), tap('k2')]);

      const sent = await sendServiceTaps(store, async () => {
        throw failure;
      });

      expect(sent).toEqual({
        refused: [],
        dropped: [],
        left: [tap('k1'), tap('k2')],
        refetch: false,
      });
    }
  });

  it('waits out a 429 for its Retry-After and sends the same tap again with the same key', async () => {
    const store = memoryServiceTapStore([tap('k1')]);
    const wait = vi.fn(async () => undefined);
    const send = vi
      .fn<(one: KeptServiceTap) => Promise<void>>()
      .mockRejectedValueOnce(refused(429, 'too_many_attempts', {}, { 'Retry-After': '12' }))
      .mockResolvedValueOnce(undefined);

    const sent = await sendServiceTaps(store, send, { wait });

    expect(wait).toHaveBeenCalledWith(12);
    expect(send.mock.calls.map(([one]) => one.key)).toEqual(['k1', 'k1']);
    expect(sent.refetch).toBe(true);
  });

  it('sends a tap kept while the send is under way', async () => {
    const store = memoryServiceTapStore([tap('k1')]);
    const keys: string[] = [];

    await sendServiceTaps(store, async (one) => {
      keys.push(one.key);
      if (one.key === 'k1') await keepServiceTap(store, tap('k2'));
    });

    expect(keys).toEqual(['k1', 'k2']);
  });

  describe('a tap resting on a refused one (sc-97571)', () => {
    const refuse =
      (...keys: string[]) =>
      async (one: KeptServiceTap) => {
        if (keys.includes(one.key)) throw refused(409, 'service_changed', { changed: [] });
      };

    it('drops every later tap on the same item, sends the others in order, and counts the chain as answered', async () => {
      const taps = [item('j0', 'jollof')];

      for (let n = 1; n <= 11; n++) taps.push(item(`j${n}`, 'jollof'), onPlate(`o${n}`, `x${n}`));
      taps.splice(3, 0, item('chicken', 'chicken'));
      const store = memoryServiceTapStore(taps);
      const sentKeys: string[] = [];

      const sent = await sendServiceTaps(store, async (one) => {
        sentKeys.push(one.key);
        await refuse('j0')(one);
      });

      expect(sent.refused.map((one) => one.tap.key)).toEqual(['j0']);
      expect(sent.dropped).toHaveLength(11);
      expect(sentKeys).toEqual([
        'j0',
        'o1',
        'chicken',
        ...Array.from({ length: 10 }, (_, i) => `o${i + 2}`),
      ]);
      expect(sent.left).toEqual([]);
      expect(sent.refetch).toBe(true);
      expect(await store.load()).toEqual([]);
    });

    it('drops a tick and a check of the tray resting on a refused mark, not a tap on another plate', async () => {
      const mark = keptServiceTap(
        'e1',
        { kind: 'mark', trayId: 't1', plateId: 'p1', item: 'rice', mark: 'on' as never },
        { plates: { p1: 'dishing' } },
        'm',
        AT,
      );
      const store = memoryServiceTapStore([
        mark,
        onPlate('tickP1', 'p1'),
        tap('check'),
        onPlate('other', 'p9'),
      ]);
      const sentKeys: string[] = [];

      const sent = await sendServiceTaps(store, async (one) => {
        sentKeys.push(one.key);
        await refuse('m')(one);
      });

      expect(sent.dropped.map((one) => one.key)).toEqual(['tickP1', 'check']);
      expect(sentKeys).toEqual(['m', 'other']);
    });

    it('drops a refused check, a tick and a later tap on a plate it saw', async () => {
      const store = memoryServiceTapStore([
        tap('check'),
        onPlate('tick', 'p1'),
        onPlate('after', 'p1'),
      ]);

      const sent = await sendServiceTaps(store, refuse('check'));

      expect(sent.dropped.map((one) => one.key)).toEqual(['tick', 'after']);
    });

    it('drops an undo of a refused tap and a tap resting on a dropped one', async () => {
      const undo = keptServiceTap(
        'e1',
        { kind: 'undo', subject: 'p1' },
        { plates: {} },
        'undo',
        AT,
      );
      const wide = keptServiceTap(
        'e1',
        { kind: 'check', trayId: 't5' },
        { plates: { p1: 'dishing', p2: 'dishing' } },
        'wide',
        AT,
      );
      const store = memoryServiceTapStore([
        tap('first'),
        wide,
        onPlate('chain', 'p2'),
        undo,
        onPlate('free', 'p7'),
      ]);
      const sentKeys: string[] = [];

      const sent = await sendServiceTaps(store, async (one) => {
        sentKeys.push(one.key);
        await refuse('first')(one);
      });

      expect(sent.dropped.map((one) => one.key)).toEqual(['wide', 'chain', 'undo']);
      expect(sentKeys).toEqual(['first', 'free']);
      expect(sent.refused).toHaveLength(1);
    });
  });
});
