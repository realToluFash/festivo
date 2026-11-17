import type { Membership } from '@soirely/api-client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { RUN_AGAIN_MS } from '../../components/useRunSchedule.ts';
import { __setSessionState } from '../../session.ts';
import { membership, OWNER_PERMISSIONS } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

const ORG: Membership = membership({ id: 'org_1' });
const NOW = '2030-11-15T20:02:00Z';

function signedIn(): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Folake Adeyemi',
      email: 'folake@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u1',
      needsOrganisation: false,
      hasPassword: true,
      organisation: ORG,
      organisations: [ORG],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function event(permissions: string[]) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
    name: 'Adaeze and Tunde',
    type: 'wedding',
    status: 'live',
    phase: 'happening_now',
    startsAt: '2030-11-15T10:00:00+00:00',
    endsAt: '2030-11-16T03:00:00+00:00',
    timeZone: 'Europe/London',
    dayCount: 1,
    currency: 'GBP',
    cover: null,
    venue: null,
    arrivalNote: null,
    hosts: [],
    madeLiveAt: '2030-11-01T09:00:00+00:00',
    pausedAt: null,
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions,
    milestones: [],
  };
}

const at = (time: string) => `2030-11-15T${time}:00+00:00`;

function item(id: string, title: string, time: string, more: Record<string, unknown> = {}) {
  return {
    id,
    title,
    startsAt: at(time),
    startedAt: null,
    endedAt: null,
    skipped: false,
    day: '2030-11-15',
    lengthMinutes: null,
    place: 'Ballroom',
    ownerName: null,
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
    version: 1,
    ...more,
  };
}

const ARRIVE = item('it_arrive', 'Guests arrive', '18:00', {
  lengthMinutes: 30,
  startedAt: at('18:02'),
  endedAt: at('18:31'),
});
const DINNER = item('it_dinner', 'Dinner is served', '18:30', {
  lengthMinutes: 75,
  startedAt: at('18:33'),
  endedAt: at('19:48'),
});
const SPEECHES = item('it_speeches', 'Speeches', '19:45', {
  lengthMinutes: 40,
  startedAt: at('19:50'),
});
const DANCE = item('it_dance', 'First dance', '20:30', { lengthMinutes: 15 });
const GARDEN = item('it_fire', 'Fireworks', '21:00', { lengthMinutes: 10, place: 'Garden' });

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Today's events and the event's running order, read afresh on each request; every other request left waiting. */
function serving(permissions: string[], items: unknown[] | (() => unknown[])) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));

    if (url.pathname === '/api/orgs/org_1/events') {
      const shown = url.searchParams.get('finished') === 'true' ? [] : [event(permissions)];

      return json({ events: shown, total: shown.length });
    }
    if (url.pathname === '/api/events/ev_1/schedule')
      return json({
        schedule: {
          timeZone: 'Europe/London',
          earliest: at('05:00'),
          latest: '2030-11-16T03:00:00+00:00',
          itemsMaximum: 200,
          items: typeof items === 'function' ? items() : items,
        },
      });

    return new Promise<Response>(() => {});
  });
}

function open() {
  const router = createMemoryRouter(routes, { initialEntries: ['/app'] });

  render(<RouterProvider router={router} />);

  return router;
}

const READS = OWNER_PERMISSIONS;
const NO_READ = OWNER_PERMISSIONS.filter((one) => !one.startsWith('run_of_show.'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  signedIn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Now on the web’s Today from the run of show (sc-61017)', () => {
  it('shows the item Now, until when, the figure, Next alone and the rail, for a role that reads the run of show', async () => {
    serving(READS, [ARRIVE, DINNER, SPEECHES, DANCE]);
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Speeches' })).toBeDefined();
    expect(document.querySelector('.today-now-event')?.textContent).toBe('Adaeze and Tunde');
    expect(screen.getByText('until 20:30')).toBeDefined();
    expect(document.querySelector('.tn-figure .visually-hidden')?.textContent).toBe('On time');
    expect(document.querySelector('.tn-next')?.textContent).toBe('Next20:30 First dance');
    expect(document.querySelector('.today-arrived')).toBeNull();
    expect(
      screen.getByRole('img', {
        name: '18:00 Guests arrive, done; 18:30 Dinner is served, done; 19:45 Speeches, now; 20:30 First dance, next',
      }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open the event' })).toBeNull();
  });

  it('opens the event’s Schedule, Run of show while it is on, on the followed track', async () => {
    serving(READS, [ARRIVE, DINNER, DANCE, GARDEN]);
    const router = open();

    fireEvent.click(await screen.findByRole('button', { name: 'Open run of show' }));

    expect(router.state.location.pathname).toBe('/app/events/ev_1/schedule');
    expect(new URLSearchParams(router.state.location.search).get('track')).toBe(
      '2030-11-15|Ballroom',
    );
  });

  it('keeps the built Now for a role without run_of_show.read, and never reads the running order', async () => {
    const fetched = serving(NO_READ, [ARRIVE, DINNER, SPEECHES, DANCE]);
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open run of show' })).toBeNull();
    expect(
      fetched.mock.calls.some(([input]) => String(input).includes('/api/events/ev_1/schedule')),
    ).toBe(false);
  });

  it('keeps the built Now on an event day with no running order', async () => {
    serving(READS, []);
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open run of show' })).toBeNull();
  });

  it('reads the running order again every RUN_AGAIN_MS, so a press elsewhere shows with no reload', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(NOW));
    let items: unknown[] = [ARRIVE, DINNER, SPEECHES, DANCE];
    serving(READS, () => items);
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Speeches' })).toBeDefined();

    items = [ARRIVE, DINNER, { ...SPEECHES, endedAt: at('20:01') }, DANCE];
    await act(() => vi.advanceTimersByTimeAsync(RUN_AGAIN_MS));

    expect(await screen.findByRole('heading', { level: 1, name: 'Nothing is on' })).toBeDefined();
  });

  it('reads the running order again on returning to the browser tab', async () => {
    let items: unknown[] = [ARRIVE, DINNER, SPEECHES, DANCE];
    serving(READS, () => items);
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Speeches' })).toBeDefined();

    items = [ARRIVE, DINNER, { ...SPEECHES, endedAt: at('20:01') }, DANCE];
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Nothing is on' })).toBeDefined();
  });
});

describe('Now says how old its run of show is once its reads stop landing (sc-62416)', () => {
  /** Today's events, and each read of the running order answered as `answer` says at that moment. */
  function reading(answer: () => 'order' | 'down' | 'hang' | number) {
    const events = serving(READS, [ARRIVE, DINNER, SPEECHES, DANCE]);
    const order = events.getMockImplementation()!;

    events.mockImplementation(async (input, init) => {
      if (!String(input).includes('/api/events/ev_1/schedule')) return order(input, init);

      const now = answer();
      if (now === 'order') return order(input, init);
      if (now === 'down') throw new TypeError('Failed to fetch');
      if (now === 'hang') return new Promise<Response>(() => {});

      return new Response(
        JSON.stringify({ type: 'https://soirely.app/errors/x', title: 'No', status: now }),
        { status: now, headers: { 'Content-Type': 'application/problem+json' } },
      );
    });
  }

  async function after(ms: number) {
    await act(() => vi.advanceTimersByTimeAsync(ms));
  }

  /** Now's own line, apart from Today's offline band, which ages Today's read and may show beside it. */
  const line = () => {
    const status = document.querySelector('header [role="status"]');

    return status?.textContent === '' ? null : (status ?? null);
  };

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    vi.setSystemTime(new Date(NOW));
  });

  it('counts a read with no answer after 10 seconds as failed, and shows the line once the last landed read is past 60 seconds', async () => {
    let answer: 'order' | 'hang' = 'order';
    reading(() => answer);
    open();
    await after(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Speeches' })).toBeDefined();

    answer = 'hang';
    await after(60_000);
    expect(line()).toBeNull();

    await after(1);
    expect(line()?.textContent).toBe('Offline · as of 20:02');
    expect(screen.getByRole('heading', { level: 1, name: 'Speeches' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open run of show' })).toBeDefined();
  });

  it('shows no line on a failed read while the last landed read is 60 seconds old or less, and drops it once a read lands', async () => {
    let answer: 'order' | number = 'order';
    reading(() => answer);
    open();
    await after(0);

    answer = 500;
    await after(50_000);
    expect(line()).toBeNull();

    await after(10_001);
    expect(line()?.textContent).toBe('Offline · as of 20:02');

    answer = 'order';
    await after(40_000);
    expect(line()).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Speeches' })).toBeDefined();
  });

  it.each([403, 404])('goes back to the built Now with no line after a %i', async (status) => {
    let answer: 'order' | 'down' | number = 'order';
    reading(() => answer);
    open();
    await after(0);

    answer = 'down';
    await after(61_000);
    expect(line()).not.toBeNull();

    answer = status;
    await after(50_000);
    expect(line()).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
  });

  it('keeps the built Now with no line when the first read fails', async () => {
    reading(() => 'down');
    open();
    await after(120_000);

    expect(line()).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
  });

  it("names the day once the last landed read was on an earlier day in the event's zone", async () => {
    vi.setSystemTime(new Date('2030-11-15T23:59:30Z'));
    let answer: 'order' | 'down' = 'order';
    reading(() => answer);
    open();
    await after(0);

    answer = 'down';
    await after(61_000);
    expect(line()?.textContent).toBe('Offline · as of Friday, Nov 15 at 23:59');
  });
});
