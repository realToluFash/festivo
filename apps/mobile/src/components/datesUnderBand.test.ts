import { ApiClient, type TokenStore } from '@soirely/api-client';
import { createConnection, createOfflineWatch, neverReached, shownBeside } from '@soirely/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { afterFailedLoad } from '../offlineLoad.ts';

/** Up, up with the dates answering after the event, stopped, answering a 500, or answering the event while the dates' fetch fails: at once, or after the event answered. */
type Soirely =
  | 'answers'
  | 'datesLate'
  | 'unreachable'
  | 'error500'
  | 'datesUnreachable'
  | 'datesUnreachableLate';

const FAILED: Load = { kind: 'failed' };

type Load = { kind: 'loading' } | { kind: 'loaded'; titles: string[] } | { kind: 'failed' };

const KITCHEN = {
  at: '2026-10-20T23:59:00+02:00',
  title: 'Give final numbers to the kitchen',
  note: null,
  owner: 'you',
  area: 'menu',
  action: { label: 'Open the kitchen sheet', link: '/events/ev_1/kitchen' },
  done: false,
};
const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2026-10-24T18:00:00+02:00',
  endsAt: '2026-10-25T02:00:00+02:00',
  timeZone: 'Europe/Madrid',
  dayCount: 1,
  currency: 'EUR',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: ['Funmi Adeyemi'],
  thankYou: null,
  madeLiveAt: '2026-10-01T09:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-09-21T09:00:00+00:00',
  permissions: [],
};
const STARTS = {
  at: '2026-10-24T18:00:00+02:00',
  title: 'Boda starts',
  note: null,
  owner: 'event',
  area: 'events',
  action: null,
  done: false,
};

/** The event's Overview as the app wires it (sc-98386): the band's Try again reloads the event through the screen's watch and the dates beside it, which keep what they showed while the band is up. */
function overview() {
  vi.useFakeTimers({ now: new Date('2026-10-21T08:00:00Z') });
  const connection = createConnection();
  const soirely: { now: Soirely; milestones: unknown[] } = {
    now: 'answers',
    milestones: [KITCHEN, STARTS],
  };
  const tokens: TokenStore = {
    access: () => 'access',
    refresh: () => 'refresh',
    save: () => {},
    clear: () => {},
  };
  const requests: string[] = [];
  const api = new ApiClient({
    baseUrl: () => 'https://soirely.test',
    tokens,
    refreshTokenIn: 'body',
    fetch: (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      const dates = path.endsWith('/timeline');
      const datesFail =
        dates && (soirely.now === 'datesUnreachable' || soirely.now === 'datesUnreachableLate');
      const answered = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      const answer: Promise<Response> =
        soirely.now === 'unreachable' || datesFail
          ? soirely.now === 'datesUnreachableLate'
            ? new Promise((_, reject) =>
                setTimeout(() => reject(new TypeError('Network request failed')), 50),
              )
            : Promise.reject(new TypeError('Network request failed'))
          : dates && soirely.now === 'datesLate'
            ? new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve(
                      answered({ timeZone: 'Europe/Madrid', milestones: soirely.milestones }),
                    ),
                  50,
                ),
              )
            : soirely.now === 'error500'
              ? Promise.resolve(
                  new Response(
                    JSON.stringify({
                      type: 'https://soirely.com/errors/internal_error',
                      status: 500,
                    }),
                    { status: 500, headers: { 'content-type': 'application/problem+json' } },
                  ),
                )
              : Promise.resolve(
                  answered(
                    dates
                      ? { timeZone: 'Europe/Madrid', milestones: soirely.milestones }
                      : { event: EVENT },
                  ),
                );
      connection.observe(answer, init);

      return answer;
    },
  });
  const dates: { load: Load; kept: boolean } = { load: { kind: 'loading' }, kept: false };
  // The event's read is the screen's; the dates read beside it, as `useTimeline` does on each reload.
  const reload = vi.fn(() => {
    dates.kept = false;
    offline.watch(api.event('ev_1')).then(
      () => offline.setScreen({ loaded: true, reload, pressAnswered: () => {} }),
      () => {},
    );
    api.eventTimeline('ev_1').then(
      ({ milestones }) => {
        dates.load = { kind: 'loaded', titles: milestones.map(({ title }) => title) };
      },
      (error: unknown) => {
        dates.load = afterFailedLoad(dates.load, error, FAILED, neverReached);
        dates.kept = neverReached(error);
      },
    );
  });
  const offline = createOfflineWatch({ connection });
  offline.setScreen({ loaded: false, reload, pressAnswered: () => {} });
  offline.start();
  const shown = () => shownBeside(dates.load, dates.kept, offline.state().stale, FAILED);

  return { offline, connection, soirely, reload, requests, shown };
}

async function loadedThenOffline() {
  const it = overview();
  it.reload();
  await vi.advanceTimersByTimeAsync(0);
  it.soirely.now = 'unreachable';
  it.connection.deviceOffline();
  it.requests.length = 0;

  return it;
}

describe("the app's Overview dates, under the band (sc-98386)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps Next up, Coming up and Needs you’s milestones when the band’s Try again never reaches Soirely', async () => {
    const { offline, requests, shown } = await loadedThenOffline();

    offline.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(requests).toEqual(['/api/events/ev_1', '/api/events/ev_1/timeline']);
    expect(shown()).toEqual({
      kind: 'loaded',
      titles: ['Give final numbers to the kitchen', 'Boda starts'],
    });
    expect(offline.state().stale).toBe(true);
  });

  it('shows what the next read that answers gave, in place of what was kept', async () => {
    const { offline, soirely, shown } = await loadedThenOffline();

    offline.retry();
    await vi.advanceTimersByTimeAsync(0);
    soirely.now = 'answers';
    soirely.milestones = [STARTS];
    offline.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(shown()).toEqual({ kind: 'loaded', titles: ['Boda starts'] });
    expect(offline.state().stale).toBe(false);
  });

  it('shows the kept rows, not the failed words, between the event’s answer clearing the band and the dates’ answer after a kept read', async () => {
    const { offline, soirely, shown } = await loadedThenOffline();

    offline.retry();
    await vi.advanceTimersByTimeAsync(0);
    soirely.now = 'datesLate';
    soirely.milestones = [STARTS];
    offline.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(offline.state().stale).toBe(false);
    expect(shown()).toEqual({
      kind: 'loaded',
      titles: ['Give final numbers to the kitchen', 'Boda starts'],
    });

    await vi.advanceTimersByTimeAsync(50);

    expect(shown()).toEqual({ kind: 'loaded', titles: ['Boda starts'] });
  });

  it('does not keep a reload Soirely answers with a 500: the dates fail, as today', async () => {
    const { offline, soirely, shown } = await loadedThenOffline();

    soirely.now = 'error500';
    offline.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(shown()).toEqual({ kind: 'failed' });
    expect(offline.state().stale).toBe(false);
  });

  it('fails the dates when their fetch drops while the event’s read answers, so the band’s clearing never leaves stale dates with nothing saying so', async () => {
    const { offline, soirely, shown } = await loadedThenOffline();

    soirely.now = 'datesUnreachable';
    offline.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(offline.state().stale).toBe(false);
    expect(shown()).toEqual({ kind: 'failed' });
  });

  it('keeps them when the event answers first and the dates’ fetch drops after: the lost fetch puts the band back up, and the dates stay under it', async () => {
    const { offline, soirely, shown } = await loadedThenOffline();

    soirely.now = 'datesUnreachableLate';
    offline.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(offline.state().stale).toBe(false);
    expect(shown()).toEqual({
      kind: 'loaded',
      titles: ['Give final numbers to the kitchen', 'Boda starts'],
    });

    await vi.advanceTimersByTimeAsync(50);

    expect(offline.state().stale).toBe(true);
    expect(shown()).toEqual({
      kind: 'loaded',
      titles: ['Give final numbers to the kitchen', 'Boda starts'],
    });
  });

  it('keeps nothing when nothing loaded on this visit: the first read that never reaches Soirely fails', async () => {
    const { offline, soirely, reload, shown } = overview();

    soirely.now = 'unreachable';
    reload();
    await vi.advanceTimersByTimeAsync(0);

    expect(shown()).toEqual({ kind: 'failed' });
    expect(offline.state().stale).toBe(false);
  });
});
