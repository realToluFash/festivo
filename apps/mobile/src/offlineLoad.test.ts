import { ApiClient, type TokenStore } from '@soirely/api-client';
import { NO_ANSWER_MS, createConnection, createOfflineWatch } from '@soirely/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { afterFailedLoad, bandReadOut, formAfterLoad, formShownAt } from './offlineLoad.ts';

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

  it('asks once when the network returns to a silent Soirely, then waits', async () => {
    const { offline, connection, soirely, requests, screen } = await loadedThenOffline();

    soirely.now = 'silent';
    connection.deviceOnline();
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS / 2);
    connection.deviceOnline();
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS / 2);
    connection.deviceOnline();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(requests).toEqual(['/api/orgs/org_1/events']);
    expect(offline.state()).toMatchObject({ out: 0, stale: true, unanswered: 0 });
    expect(screen.load).toEqual({ kind: 'loaded', rows: 3 });
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

describe('Edit details, once its form shows (Decided, 2 Nov)', () => {
  type Form = { kind: 'loading' } | { kind: 'failed' } | { event: { name: string }; etag: string };
  const opened: Form = { event: { name: 'Adaeze and Tunde' }, etag: '"1"' };

  it('fills the form from the first load', () => {
    expect(formAfterLoad<Form>({ kind: 'loading' }, opened)).toBe(opened);
  });

  it('keeps the form and the tag it opened with when a reload answers with a newer one', () => {
    const renamed: Form = { event: { name: 'Renamed by a co-host' }, etag: '"2"' };

    expect(formAfterLoad<Form>(opened, renamed)).toBe(opened);
  });

  it('keeps the form when a reload fails', () => {
    expect(formAfterLoad<Form>(opened, { kind: 'failed' })).toBe(opened);
  });
});

describe("the band's time on Edit details (Decided, 2 Nov)", () => {
  const nine = new Date(2026, 10, 10, 9, 0);
  const nineThirtyFive = new Date(2026, 10, 10, 9, 35);

  it('is the minute the form first showed', () => {
    expect(formShownAt(null, 'loaded', nine)).toBe(nine);
  });

  it('stays there when a Try again answers, as the form keeps its fields and tag', () => {
    expect(formShownAt(nine, 'loaded', nineThirtyFive)).toBe(nine);
  });

  it('moves to the minute the form took Show the latest', () => {
    expect(formShownAt(nine, 'latest', nineThirtyFive)).toBe(nineThirtyFive);
  });
});

describe('what the band says, screen by screen in the stack', () => {
  /** Plays a screen's band through its states, returning each time it spoke. */
  function played(steps: { showing: boolean; unanswered: number; inFront: boolean }[]): number[] {
    let said: number | null = null;
    const spoke: number[] = [];
    steps.forEach((band, i) => {
      const next = bandReadOut(said, band);
      said = next.said;
      if (next.speaks) spoke.push(i);
    });

    return spoke;
  }

  it('speaks once as it appears on the screen in front, and not as it re-renders', () => {
    expect(
      played([
        { showing: false, unanswered: 0, inFront: true },
        { showing: true, unanswered: 0, inFront: true },
        { showing: true, unanswered: 0, inFront: true },
      ]),
    ).toEqual([1]);
  });

  it('says nothing from a screen behind, as Events under Calendar, while the one in front speaks', () => {
    expect(
      played([
        { showing: false, unanswered: 0, inFront: false },
        { showing: true, unanswered: 0, inFront: false },
      ]),
    ).toEqual([]);
  });

  it('speaks again after each unanswered Try again', () => {
    expect(
      played([
        { showing: true, unanswered: 0, inFront: true },
        { showing: true, unanswered: 1, inFront: true },
        { showing: true, unanswered: 2, inFront: true },
      ]),
    ).toEqual([0, 1, 2]);
  });

  it('says a band that came up while the screen was behind once, as it returns to the front', () => {
    expect(
      played([
        { showing: true, unanswered: 0, inFront: false },
        { showing: true, unanswered: 0, inFront: true },
        { showing: true, unanswered: 0, inFront: false },
        { showing: true, unanswered: 0, inFront: true },
      ]),
    ).toEqual([1]);
  });

  it('speaks again when the band goes and comes back', () => {
    expect(
      played([
        { showing: true, unanswered: 0, inFront: true },
        { showing: false, unanswered: 0, inFront: true },
        { showing: true, unanswered: 0, inFront: true },
      ]),
    ).toEqual([0, 2]);
  });
});
