import type { Membership } from '@soirely/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

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

/** Today's events and the event's running order; every other request left waiting. */
function serving(permissions: string[], items: unknown[]) {
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
          items,
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
});
