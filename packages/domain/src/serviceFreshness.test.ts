import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SERVICE_OFF_READ_MS,
  SERVICE_SILENCE_MS,
  type ServicePhase,
  createServiceFreshness,
  freshnessKey,
  refetchDelay,
} from './serviceFreshness.ts';

const START = new Date('2027-03-06T19:00:00Z');

function device(answers: (ServicePhase | Error)[] = []) {
  const read = vi.fn(async (): Promise<ServicePhase> => {
    const next = answers.length > 1 ? answers.shift()! : answers[0];

    if (next == null) return 'on';
    if (next instanceof Error) throw next;

    return next;
  });
  const freshness = createServiceFreshness({ read });

  return { freshness, read };
}

async function after(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('while service is on', () => {
  it('is No connection when opened during service, until the first message arrives', async () => {
    const { freshness } = device();
    freshness.start('on');
    expect(freshness.state()).toEqual({ state: 'noConnection', asOf: START, waiting: 0 });

    await after(5_000);
    freshness.message('heartbeat');
    expect(freshness.state()).toEqual({
      state: 'connected',
      asOf: new Date(START.getTime() + 5_000),
    });
  });

  it('is No connection after a first read answering on, until the first message arrives', async () => {
    const { freshness } = device(['on']);
    freshness.start();
    await after(0);

    expect(freshness.state().state).toBe('noConnection');
  });

  it('is Connected while a message came in the last 20 seconds, and No connection once 20 pass with none', async () => {
    const { freshness } = device();
    freshness.start('on');
    freshness.message('heartbeat');

    await after(SERVICE_SILENCE_MS - 1);
    expect(freshness.state()).toEqual({ state: 'connected', asOf: START });

    await after(1);
    expect(freshness.state()).toEqual({ state: 'noConnection', asOf: START, waiting: 0 });
  });

  it('turns back to Connected on a message, with its time', async () => {
    const { freshness } = device([new Error('no answer')]);
    freshness.start('on');
    await after(SERVICE_SILENCE_MS + 5_000);

    freshness.message('data');

    expect(freshness.state()).toEqual({
      state: 'connected',
      asOf: new Date(START.getTime() + 25_000),
    });
  });

  it('is No connection at once with no network', () => {
    const { freshness } = device();
    freshness.start('on');

    freshness.deviceOffline();

    expect(freshness.state().state).toBe('noConnection');
  });

  it('starts the 20 seconds again on a heartbeat, and a heartbeat alone never refetches', async () => {
    const { freshness, read } = device();
    freshness.start('on');

    for (let beat = 0; beat < 6; beat += 1) {
      await after(10_000);
      freshness.message('heartbeat');
    }

    expect(freshness.state().state).toBe('connected');
    expect(read).not.toHaveBeenCalled();
  });

  it('refetches on silence with backoff, 1, 2, 4… capped at 30 seconds, until a read succeeds', async () => {
    const failed = new Error('no answer');
    const { freshness, read } = device([
      failed,
      failed,
      failed,
      failed,
      failed,
      failed,
      failed,
      'on',
    ]);
    freshness.start('on');
    await after(SERVICE_SILENCE_MS);

    const at: number[] = [];
    read.mockImplementation(async () => {
      at.push(Date.now() - START.getTime() - SERVICE_SILENCE_MS);
      if (at.length < 8) throw failed;

      return 'on';
    });
    await after(1_000 + 2_000 + 4_000 + 8_000 + 16_000 + 30_000 + 30_000 + 30_000);

    expect(at).toEqual([1_000, 3_000, 7_000, 15_000, 31_000, 61_000, 91_000, 121_000]);
    expect([0, 1, 5, 9].map(refetchDelay)).toEqual([1_000, 2_000, 30_000, 30_000]);
    expect(freshness.state()).toEqual({
      state: 'noConnection',
      asOf: new Date(START.getTime() + 141_000),
      waiting: 0,
    });
  });

  it('stops refetching when a message arrives', async () => {
    const { freshness, read } = device([new Error('no answer')]);
    freshness.start('on');
    await after(SERVICE_SILENCE_MS + 1_000);
    expect(read).toHaveBeenCalledTimes(1);

    freshness.message('heartbeat');
    await after(5_000);

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('moves the as-of time only on a message or a read that succeeded', async () => {
    const { freshness } = device([new Error('no answer')]);
    freshness.start('on');
    await after(SERVICE_SILENCE_MS + 60_000);

    expect(freshness.state()).toEqual({ state: 'noConnection', asOf: START, waiting: 0 });
  });

  it('carries the count of taps waiting while No connection', () => {
    const { freshness } = device();
    freshness.start('on');
    freshness.deviceOffline();

    for (const count of [0, 1, 3]) {
      freshness.waiting(count);
      expect(freshness.state()).toEqual({ state: 'noConnection', asOf: START, waiting: count });
    }

    expect(freshnessKey(freshness.state())).toBe('service.fresh.noConnectionWaiting');
    freshness.waiting(0);
    expect(freshnessKey(freshness.state())).toBe('service.fresh.noConnection');
  });
});

describe('while service is off', () => {
  it('shows Not started yet before service, with no switch on silence, and reads every 30 seconds', async () => {
    const { freshness, read } = device(['notStarted']);
    freshness.start('notStarted');

    await after(SERVICE_SILENCE_MS * 3);

    expect(freshness.state()).toEqual({ state: 'notStarted' });
    expect(freshnessKey(freshness.state())).toBe('service.fresh.notStarted');
    expect(read).toHaveBeenCalledTimes(2);
    await after(SERVICE_OFF_READ_MS);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('is Connected once service has ended, its time the last read', async () => {
    const { freshness } = device(['ended']);
    freshness.start('ended');

    await after(SERVICE_OFF_READ_MS * 2);

    expect(freshness.state()).toEqual({
      state: 'connected',
      asOf: new Date(START.getTime() + 60_000),
    });
  });

  it('is No connection with no network or after a failed read', async () => {
    const { freshness } = device([new Error('no answer')]);
    freshness.start('notStarted');
    freshness.deviceOffline();
    expect(freshness.state().state).toBe('noConnection');

    freshness.deviceOnline();
    await after(0);

    expect(freshness.state()).toEqual({ state: 'noConnection', asOf: START, waiting: 0 });
  });

  it('turns the 20-second switch on at once with the message that starts service', async () => {
    const { freshness } = device(['on']);
    freshness.start('notStarted');

    freshness.message('heartbeat');
    expect(freshness.state().state).toBe('connected');

    await after(SERVICE_SILENCE_MS);
    expect(freshness.state().state).toBe('noConnection');
  });

  it('turns the switch on and off at once with the messages that start and end service', async () => {
    const { freshness, read } = device(['ended']);
    freshness.start('notStarted');

    freshness.message('phase', 'on');
    await after(SERVICE_SILENCE_MS - 1);
    expect(freshness.state().state).toBe('connected');

    freshness.message('phase', 'ended');
    await after(SERVICE_SILENCE_MS * 2);

    expect(freshness.state()).toEqual({
      state: 'connected',
      asOf: new Date(START.getTime() + SERVICE_SILENCE_MS - 1 + SERVICE_OFF_READ_MS),
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('turns to the 20-second switch when a read says service is on', async () => {
    const { freshness } = device(['on']);
    freshness.start('notStarted');

    await after(SERVICE_OFF_READ_MS);
    expect(freshness.state().state).toBe('noConnection');

    freshness.message('heartbeat');
    expect(freshness.state().state).toBe('connected');
  });
});

describe('the strip', () => {
  it('tells a listener once per change of state, not on every message', () => {
    const { freshness } = device();
    const heard: string[] = [];
    freshness.subscribe((next) => heard.push(next.state));
    freshness.start('on');
    freshness.message('heartbeat');
    freshness.message('heartbeat');

    freshness.deviceOffline();
    freshness.deviceOffline();

    expect(heard).toEqual(['noConnection', 'connected', 'noConnection']);
  });
});
