import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type ConnectionChange,
  NO_ANSWER_MS,
  answeredWithin,
  createConnection,
} from './connection.ts';

function watched() {
  const pending = new Map<number, () => void>();
  let next = 0;
  const connection = createConnection({
    set: (run) => {
      next += 1;
      pending.set(next, run);
      return next;
    },
    clear: (timer) => pending.delete(timer as number),
  });
  const heard: ConnectionChange[] = [];
  connection.subscribe((change) => heard.push(change));

  return {
    connection,
    heard,
    silence: () => {
      for (const run of pending.values()) run();
    },
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the connection', () => {
  it('hears an answer of any status as answered', async () => {
    const { connection, heard } = watched();

    connection.observe(Promise.resolve(new Response(null, { status: 503 })));
    await settled();

    expect(heard).toEqual(['answered']);
  });

  it('hears a request that never reached Soirely as lost', async () => {
    const { connection, heard } = watched();

    connection.observe(Promise.reject(new TypeError('Failed to fetch')));
    await settled();

    expect(heard).toEqual(['lost']);
  });

  it('hears nothing from a request the client itself aborted', async () => {
    const { connection, heard } = watched();
    const controller = new AbortController();
    controller.abort();

    connection.observe(Promise.reject(new Error('aborted')), { signal: controller.signal });
    await settled();

    expect(heard).toEqual([]);
  });

  it(`hears a request with no answer after ${NO_ANSWER_MS / 1000} s as lost, while it is still out`, () => {
    const { connection, heard, silence } = watched();

    connection.observe(new Promise(() => {}));
    expect(heard).toEqual([]);

    silence();
    expect(heard).toEqual(['lost']);
  });

  it('does not hear an upload still being received as silence', () => {
    const { connection, heard, silence } = watched();

    connection.observe(new Promise(() => {}), { body: new Blob(['cover']) });
    silence();

    expect(heard).toEqual([]);
  });

  it('does not count an answered request as silent later', async () => {
    const { connection, heard, silence } = watched();

    connection.observe(Promise.resolve(new Response(null)));
    await settled();
    silence();

    expect(heard).toEqual(['answered']);
  });

  it("passes the device's own word on, which is never an answer", () => {
    const { connection, heard } = watched();

    connection.deviceOffline();
    connection.deviceOnline();

    expect(heard).toEqual(['lost', 'deviceBack']);
  });
});

describe('a load given the 20 s', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`gives up on it after ${NO_ANSWER_MS / 1000} s with no answer, and not before`, async () => {
    vi.useFakeTimers();
    const outcome = vi.fn();

    answeredWithin(new Promise(() => {}), () => new Error('no answer')).catch(outcome);
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS - 1);
    expect(outcome).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toHaveBeenCalledWith(new Error('no answer'));
  });

  it('passes an answer or a failure on as it came', async () => {
    await expect(answeredWithin(Promise.resolve('loaded'), () => 'late')).resolves.toBe('loaded');
    await expect(answeredWithin(Promise.reject(new Error('503')), () => 'late')).rejects.toThrow(
      '503',
    );
  });
});
