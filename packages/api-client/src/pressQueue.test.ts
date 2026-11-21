import { describe, expect, it } from 'vitest';

import { ApiError, ApiUnreachableError } from './problem.ts';
import {
  type QueuedPress,
  enqueuePress,
  memoryPressStore,
  sendQueue,
  withPresses,
} from './pressQueue.ts';
import type { Schedule, ScheduleItem } from './schedule.ts';

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

describe('presses laid over the server’s night (sc-3895)', () => {
  const at = (wall: string) => `${wall}:00+00:00`;
  const item = (id: string, marks: Partial<ScheduleItem> = {}): ScheduleItem => ({
    id,
    title: id,
    startsAt: at('2030-11-15T19:45'),
    startedAt: null,
    endedAt: null,
    skipped: false,
    day: '2030-11-15',
    lengthMinutes: 30,
    place: null,
    ownerName: null,
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
    version: 1,
    ...marks,
  });
  const night = (items: ScheduleItem[]): Schedule => ({ ...SCHEDULE, items });
  const pressOn = (itemId: string, kind: QueuedPress['kind'], wall: string): QueuedPress => ({
    ...press(`${itemId}-${kind}`, kind),
    itemId,
    pressedAt: at(wall),
  });

  it('shows a kept press at once, timed by the press and in the event’s zone', () => {
    const shown = withPresses(night([item('speeches')]), [
      pressOn('speeches', 'start', '2030-11-15T19:50'),
    ]);

    expect(shown.items[0]).toMatchObject({ startedAt: at('2030-11-15T19:50'), endedAt: null });
  });

  it('keeps a press waiting over a read that does not have it yet', () => {
    const shown = withPresses(
      night([item('speeches', { startedAt: at('2030-11-15T19:50') }), item('dance')]),
      [
        pressOn('speeches', 'done', '2030-11-15T20:28'),
        pressOn('dance', 'skip', '2030-11-15T20:29'),
      ],
    );

    expect(shown.items.map((one) => [one.endedAt, one.skipped])).toEqual([
      [at('2030-11-15T20:28'), false],
      [null, true],
    ]);
  });

  it('clears the start of a skipped item that was on, as the API’s replay does', () => {
    const shown = withPresses(night([item('speeches', { startedAt: at('2030-11-15T19:50') })]), [
      pressOn('speeches', 'skip', '2030-11-15T20:00'),
    ]);

    expect(shown.items[0]).toMatchObject({ startedAt: null, endedAt: null, skipped: true });
  });
});
