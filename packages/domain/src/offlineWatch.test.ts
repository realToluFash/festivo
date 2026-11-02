import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Connection, NO_ANSWER_MS, createConnection } from './connection.ts';
import {
  ASK_AGAIN_FLOOR_MS,
  NotReached,
  type OfflineWatch,
  createOfflineWatch,
  keepsWhatLoaded,
} from './offlineWatch.ts';

type Soirely = 'answers' | 'unreachable' | 'broken' | 'silent';

/** A screen with one watched load per reload, and a Soirely the test can switch between answering and not. */
function screen(connection = createConnection()) {
  vi.useFakeTimers({ now: new Date('2026-11-01T20:00:00Z') });
  const soirely: { now: Soirely } = { now: 'answers' };
  const failures: unknown[] = [];
  const pressAnswered = vi.fn();
  let watch: OfflineWatch | null = null;

  const request = (): Promise<Response> => {
    const answer: Promise<Response> =
      soirely.now === 'unreachable'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : soirely.now === 'silent'
          ? new Promise(() => {})
          : Promise.resolve(new Response('{}', { status: soirely.now === 'broken' ? 503 : 200 }));
    connection.observe(answer);

    return answer;
  };

  // Like the api-client: an access token refused, then a refresh that answers 503, throws the "unreachable" error.
  const load = async () => {
    const first = await request();
    if (first.status === 503) {
      await request();
      throw new Error('ApiUnreachableError');
    }

    return 'rows';
  };

  let loaded = false;
  const reload = vi.fn(() => {
    watch!.watch(load()).then(
      () => {
        loaded = true;
        watch!.setScreen({ loaded, reload, pressAnswered });
      },
      (error: unknown) => failures.push(error),
    );
  });

  watch = createOfflineWatch({ connection });
  watch.setScreen({ loaded, reload, pressAnswered });
  const stop = watch.start();

  return { watch, connection, soirely, reload, failures, pressAnswered, stop };
}

async function loadedThenOffline(connection?: Connection) {
  const it = screen(connection);
  it.reload();
  await vi.advanceTimersByTimeAsync(0);
  it.soirely.now = 'unreachable';
  it.connection.deviceOffline();
  it.reload.mockClear();

  return it;
}

describe('the offline watch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts the band up over a loaded screen, since the last load Soirely answered', async () => {
    const { watch } = await loadedThenOffline();

    expect(watch.state()).toMatchObject({
      stale: true,
      at: new Date('2026-11-01T20:00:00Z'),
      out: 0,
    });
  });

  it('keeps what loaded when a reload never reaches Soirely', async () => {
    const { watch, reload, failures } = await loadedThenOffline();

    reload();
    await vi.advanceTimersByTimeAsync(0);

    expect(failures).toHaveLength(1);
    expect(keepsWhatLoaded(failures[0])).toBe(true);
    expect(watch.state().stale).toBe(true);
  });

  it('takes the band down when Soirely answers with a 5xx, even on the token refresh, and asks no more', async () => {
    const { watch, soirely, connection, reload, failures } = await loadedThenOffline();

    soirely.now = 'broken';
    connection.deviceOnline();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(ASK_AGAIN_FLOOR_MS * 10);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(keepsWhatLoaded(failures.at(-1))).toBe(false);
    expect(watch.state().stale).toBe(false);
  });

  it('joins a load already out when Try again is pressed again, and gives it up 20 s after the first press', async () => {
    const { watch, soirely, reload } = await loadedThenOffline();

    soirely.now = 'silent';
    watch.retry();
    expect(watch.state().out).toBe(1);

    await vi.advanceTimersByTimeAsync(5_000);
    watch.retry();
    expect(reload).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS - 5_000 - 1);
    expect(watch.state()).toMatchObject({ out: 1, unanswered: 0 });

    await vi.advanceTimersByTimeAsync(1);
    expect(watch.state()).toMatchObject({ out: 0, unanswered: 1, stale: true });
  });

  it('starts a fresh load on a press after the last one was given up', async () => {
    const { watch, soirely, reload } = await loadedThenOffline();

    soirely.now = 'silent';
    watch.retry();
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS);
    watch.retry();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('takes the band down and hands focus on when a press is answered', async () => {
    const { watch, soirely, reload, pressAnswered } = await loadedThenOffline();

    soirely.now = 'answers';
    watch.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(pressAnswered).toHaveBeenCalledTimes(1);
    expect(watch.state()).toMatchObject({ stale: false, unanswered: 0 });
  });

  it('asks again once a load that was out when the network came back has failed, never faster than the floor', async () => {
    const { watch, soirely, connection, reload } = await loadedThenOffline();

    soirely.now = 'silent';
    reload();
    connection.deviceOnline();
    expect(reload).toHaveBeenCalledTimes(1);

    soirely.now = 'unreachable';
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS + 1);
    expect(reload).toHaveBeenCalledTimes(2);

    // Each of these loads fails, and the network keeps saying it is back: still one load per floor.
    for (let turn = 0; turn < 5; turn += 1) connection.deviceOnline();
    await vi.advanceTimersByTimeAsync(ASK_AGAIN_FLOOR_MS - 1);
    expect(reload.mock.calls.length).toBeLessThanOrEqual(3);
    expect(watch.state().stale).toBe(true);
  });

  it('wraps what a load threw when the connection fell silent during it', async () => {
    const { reload, failures } = await loadedThenOffline();

    reload();
    await vi.advanceTimersByTimeAsync(0);

    expect(failures[0]).toBeInstanceOf(NotReached);
    expect((failures[0] as NotReached).reason).toBeInstanceOf(TypeError);
  });

  it('stops listening, and asks nothing later, once stopped', async () => {
    const { watch, soirely, connection, reload, stop } = await loadedThenOffline();

    soirely.now = 'silent';
    reload();
    connection.deviceOnline();
    stop();
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS * 2);
    connection.deviceOnline();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(watch.state().stale).toBe(true);
  });

  it("reloads one screen on its own load's answer, not on another's on the same page, and both when the network returns", async () => {
    const page = await loadedThenOffline();
    const feed = await loadedThenOffline(page.connection);

    page.soirely.now = 'answers';
    page.watch.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(page.watch.state().stale).toBe(false);
    expect(feed.reload).not.toHaveBeenCalled();
    expect(feed.watch.state().stale).toBe(true);

    page.connection.deviceOffline();
    page.reload.mockClear();
    feed.soirely.now = 'answers';
    feed.watch.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.watch.state().stale).toBe(false);
    expect(page.reload).not.toHaveBeenCalled();
    expect(page.watch.state().stale).toBe(true);

    page.connection.deviceOffline();
    page.reload.mockClear();
    feed.reload.mockClear();
    page.connection.deviceOnline();
    expect(page.reload).toHaveBeenCalledTimes(1);
    expect(feed.reload).toHaveBeenCalledTimes(1);
  });
});
