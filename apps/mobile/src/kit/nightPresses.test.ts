import {
  ApiError,
  ERROR_TYPE_PREFIX,
  type QueuedPress,
  type Schedule,
  memoryPressStore,
} from '@soirely/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { nightPressQueue, storedPresses } from './nightPresses.ts';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => kept.get(key) ?? null,
    setItem: async (key: string, value: string) => void kept.set(key, value),
    removeItem: async (key: string) => void kept.delete(key),
  },
}));

const press = (key: string, itemId = 'speeches'): QueuedPress => ({
  key,
  pressedAt: '2030-11-15T19:44:00+00:00',
  eventId: 'evt-1',
  itemId,
  kind: 'done',
  title: 'Speeches',
});

const SCHEDULE = { timeZone: 'Europe/London', items: [] } as unknown as Schedule;

const refused = (status: number, code: string, by?: { name: string; at: string }) =>
  new ApiError({
    type: `${ERROR_TYPE_PREFIX}${code}`,
    title: code,
    status,
    ...(by == null ? {} : { superseded_by: by }),
  });

describe('presses kept on the device (sc-3895)', () => {
  beforeEach(() => kept.clear());

  it('keeps a press across a store made again, as a closed and reopened app makes it', async () => {
    await nightPressQueue(storedPresses('evt-1')).keep(press('a'));

    const reopened = nightPressQueue(storedPresses('evt-1'));

    expect((await reopened.load()).map((one) => one.key)).toEqual(['a']);
  });

  it('keeps each event apart and drops what is not a press', async () => {
    kept.set('soirely.nightPresses.evt-2', JSON.stringify([{ key: 1 }, press('b')]));

    expect(await storedPresses('evt-1').load()).toEqual([]);
    expect((await storedPresses('evt-2').load()).map((one) => one.key)).toEqual(['b']);
  });

  it('reads storage that is not JSON as an empty queue', async () => {
    kept.set('soirely.nightPresses.evt-1', '{not json');

    expect(await storedPresses('evt-1').load()).toEqual([]);
  });

  it('forgets the event’s key once everything is sent', async () => {
    const queue = nightPressQueue(storedPresses('evt-1'));

    await queue.keep(press('a'));
    await queue.send(async () => SCHEDULE);

    expect(kept.has('soirely.nightPresses.evt-1')).toBe(false);
  });
});

describe('sending the queue', () => {
  it('sends one press at a time, oldest first, and stops at a network error with the rest kept', async () => {
    const queue = nightPressQueue(memoryPressStore());
    const sent: string[] = [];

    await queue.keep(press('a'));
    await queue.keep(press('b'));
    await queue.keep(press('c'));

    const result = await queue.send(async (one) => {
      sent.push(one.key);
      if (one.key === 'b') throw new TypeError('Network request failed');

      return SCHEDULE;
    });

    expect(sent).toEqual(['a', 'b']);
    expect(result.left.map((one) => one.key)).toEqual(['b', 'c']);
    expect((await queue.load()).map((one) => one.key)).toEqual(['b', 'c']);
  });

  it('takes a losing replay out of the queue with who it lost to', async () => {
    const queue = nightPressQueue(memoryPressStore());
    const by = { name: 'Ifeoma Nduka', at: '2030-11-15T20:31:00+00:00' };

    await queue.keep(press('a', 'dance'));
    await queue.keep(press('b'));

    const result = await queue.send(async (one) => {
      if (one.key === 'a') throw refused(409, 'item_started', by);

      return SCHEDULE;
    });

    expect(result.lost).toEqual([{ press: press('a', 'dance'), code: 'item_started', by }]);
    expect(await queue.load()).toEqual([]);
  });

  it('never writes over a press kept while the queue is sending', async () => {
    const queue = nightPressQueue(memoryPressStore());
    const held: { answer: ((schedule: Schedule) => void) | null } = { answer: null };

    await queue.keep(press('a'));

    const sending = queue.send(
      (one) =>
        new Promise<Schedule>((resolve) => {
          if (one.key === 'a') held.answer = resolve;
          else throw refused(503, 'unavailable');
        }),
    );

    await vi.waitFor(() => expect(held.answer).not.toBeNull());
    await queue.keep(press('b'));
    held.answer?.(SCHEDULE);
    await sending;

    expect((await queue.load()).map((one) => one.key)).toEqual(['b']);
  });
});
