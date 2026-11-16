import { describe, expect, it } from 'vitest';

import { ApiError, ApiUnreachableError } from './problem.ts';
import { type QueuedPress, enqueuePress, memoryPressStore, sendQueue } from './pressQueue.ts';
import type { Schedule } from './schedule.ts';

const press = (key: string, kind: QueuedPress['kind'] = 'start'): QueuedPress => ({
  key,
  eventId: 'ev_1',
  itemId: `it_${key}`,
  kind,
  pressedAt: '2030-11-15T19:30:00+00:00',
  title: `Item ${key}`,
});

const SCHEDULE: Schedule = {
  timeZone: 'Europe/London',
  earliest: '',
  latest: '',
  itemsMaximum: 200,
  items: [],
};

describe('the offline press queue (sc-3895)', () => {
  it('saves a press before anything is sent', async () => {
    const store = memoryPressStore();

    await enqueuePress(store, press('a'));

    expect(await store.load()).toEqual([press('a')]);
  });

  it('sends one press at a time, oldest first, and empties the queue', async () => {
    const store = memoryPressStore([press('a'), press('b')]);
    const sent: string[] = [];

    const result = await sendQueue(store, async (one) => {
      sent.push(one.key);
      return SCHEDULE;
    });

    expect(sent).toEqual(['a', 'b']);
    expect(result).toEqual({ schedule: SCHEDULE, lost: [], left: [] });
    expect(await store.load()).toEqual([]);
  });

  it('stops at a network error and keeps the rest', async () => {
    const store = memoryPressStore([press('a'), press('b')]);

    const result = await sendQueue(store, async (one) => {
      if (one.key === 'b') throw new ApiUnreachableError();
      return SCHEDULE;
    });

    expect(result.left).toEqual([press('b')]);
    expect(await store.load()).toEqual([press('b')]);
  });

  it('takes a losing replay off the queue with whom it lost to', async () => {
    const store = memoryPressStore([press('a'), press('b')]);
    const superseded_by = { name: 'Ifeoma Nduka', at: '2030-11-15T19:28:00+00:00' };

    const result = await sendQueue(store, async (one) => {
      if (one.key === 'a')
        throw new ApiError({
          type: 'https://soirely.com/errors/item_started',
          title: 'This item has already started.',
          status: 409,
          superseded_by,
        });
      return SCHEDULE;
    });

    expect(result.lost).toEqual([
      {
        press: press('a'),
        code: 'item_started',
        by: superseded_by,
        said: 'This item has already started.',
      },
    ]);
    expect(result.left).toEqual([]);
  });

  it('keeps a press saved while another is being sent', async () => {
    const store = memoryPressStore([press('a')]);
    const sent: string[] = [];

    await sendQueue(store, async (one) => {
      sent.push(one.key);
      if (one.key === 'a') await enqueuePress(store, press('b'));
      return SCHEDULE;
    });

    expect(sent).toEqual(['a', 'b']);
    expect(await store.load()).toEqual([]);
  });
});
