import { ApiClient, type TokenStore } from '@soirely/api-client';
import { NO_ANSWER_MS, createConnection, createOfflineWatch } from '@soirely/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { afterFailedLoad } from './offlineLoad.ts';

type Soirely = 'answers' | 'unreachable' | 'silent' | 'refresh503';

type Load = { kind: 'loaded'; rows: number } | { kind: 'failed' };

/** Events as the app wires it: the api-client's fetch feeds the connection, and every load goes through the watch. */
function eventsScreen() {
  vi.useFakeTimers({ now: new Date('2026-11-01T20:00:00Z') });
  const connection = createConnection();
  const soirely: { now: Soirely } = { now: 'answers' };
  let access: string | null = 'old';
  const tokens: TokenStore = {
    access: () => access,
    refresh: () => 'refresh',
    save: (issued) => {
      access = issued.accessToken;
    },
    clear: () => {
      access = null;
    },
  };
  const requests: string[] = [];
  const api = new ApiClient({
    baseUrl: () => 'https://soirely.test',
    tokens,
    refreshTokenIn: 'body',
    fetch: (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      const answer: Promise<Response> =
        soirely.now === 'unreachable'
          ? Promise.reject(new TypeError('Network request failed'))
          : soirely.now === 'silent'
            ? new Promise(() => {})
            : soirely.now === 'refresh503'
              ? Promise.resolve(
                  new Response('{}', { status: path.endsWith('/refresh') ? 503 : 401 }),
                )
              : Promise.resolve(
                  new Response(JSON.stringify({ events: [], total: 0 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                  }),
                );
      connection.observe(answer, init);

      return answer;
    },
  });
  const screen: { load: Load } = { load: { kind: 'failed' } };
  const reload = vi.fn(() => {
    offline.watch(api.events('org_1')).then(
      () => {
        screen.load = { kind: 'loaded', rows: 3 };
        offline.setScreen({ loaded: true, reload, pressAnswered: () => {} });
      },
      (error: unknown) => {
        screen.load = afterFailedLoad(screen.load, error, { kind: 'failed' });
      },
    );
  });
  const offline = createOfflineWatch({ connection });
  offline.setScreen({ loaded: false, reload, pressAnswered: () => {} });
  offline.start();

  return { offline, connection, soirely, reload, requests, screen };
}

async function loadedThenOffline() {
  const it = eventsScreen();
  it.reload();
  await vi.advanceTimersByTimeAsync(0);
  it.soirely.now = 'unreachable';
  it.connection.deviceOffline();
  it.reload.mockClear();
  it.requests.length = 0;

  return it;
}

describe("the app's Events, offline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the rows under the band when a pull to refresh never reaches Soirely', async () => {
    const { offline, reload, screen } = await loadedThenOffline();

    reload();
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.load).toEqual({ kind: 'loaded', rows: 3 });
    expect(offline.state().stale).toBe(true);
  });

  it("drops the band and shows today's failure words when the token refresh answers 503", async () => {
    const { offline, connection, soirely, reload, screen } = await loadedThenOffline();

    soirely.now = 'refresh503';
    connection.deviceOnline();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.load).toEqual({ kind: 'failed' });
    expect(offline.state().stale).toBe(false);
  });

  it('joins the load already out on a second Try again: one request, given up 20 s after the first press', async () => {
    const { offline, soirely, requests, screen } = await loadedThenOffline();

    soirely.now = 'silent';
    offline.retry();
    await vi.advanceTimersByTimeAsync(5_000);
    offline.retry();

    expect(requests).toEqual(['/api/orgs/org_1/events']);

    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS - 5_000);
    expect(offline.state()).toMatchObject({ out: 0, unanswered: 1, stale: true });
    expect(screen.load).toEqual({ kind: 'loaded', rows: 3 });
  });
});
