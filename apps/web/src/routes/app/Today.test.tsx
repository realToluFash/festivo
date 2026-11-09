import type { Membership } from '@soirely/api-client';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { membership, OWNER_PERMISSIONS } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

function signedIn(organisation: Membership): void {
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
      organisation,
      organisations: [organisation],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function event(name: string, rest: Record<string, unknown> = {}) {
  return {
    id: `ev_${name.length}`,
    organisationId: 'org_1',
    name,
    type: 'wedding',
    status: 'draft',
    phase: 'draft',
    startsAt: '2099-11-14T16:00:00+01:00',
    endsAt: '2099-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    cover: null,
    venue: null,
    hosts: [],
    madeLiveAt: null,
    pausedAt: null,
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: OWNER_PERMISSIONS,
    milestones: [],
    ...rest,
  };
}

/** The organisation's events, unfinished and finished, and every other request left waiting. */
function serving(events: object[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));

    if (url.pathname !== '/api/orgs/org_1/events') return new Promise<Response>(() => {});

    const shown = url.searchParams.get('finished') === 'true' ? [] : events;

    return new Response(JSON.stringify({ events: shown, total: shown.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function open() {
  const router = createMemoryRouter(routes, { initialEntries: ['/app'] });

  render(<RouterProvider router={router} />);

  return router;
}

const content = () => document.getElementById('content') as HTMLElement;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Today at a desk (sc-30413)', () => {
  it('welcomes a first run with its three steps, and Start your first event opens New event', async () => {
    signedIn(membership({ id: 'org_1' }));
    serving([]);
    const router = open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Folake' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Set up your first event' }),
    ).toBeDefined();
    expect(screen.getByText('Name it and give it a date')).toBeDefined();
    expect(within(content()).queryByRole('button', { name: 'New event' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start your first event' }));

    expect(router.state.location.pathname).toBe('/app/events/new');
  });

  it('offers no way to create an event to a role without Create events', async () => {
    signedIn(
      membership({
        id: 'org_1',
        permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'events.create'),
      }),
    );
    serving([]);
    open();

    await screen.findByRole('heading', { level: 2, name: 'Set up your first event' });

    expect(screen.queryByRole('button', { name: 'Start your first event' })).toBeNull();
  });

  it('draws This week and Your events, with no Needs you, and a row opens its event', async () => {
    signedIn(membership({ id: 'org_1' }));
    serving([event('Bisi & Kola’s engagement')]);
    const router = open();

    const row = await screen.findByRole('button', { name: /^Bisi & Kola’s engagement/u });
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Your events' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /Needs you/u })).toBeNull();
    expect(within(row).getByText('Draft')).toBeDefined();
    expect(within(content()).getByRole('button', { name: 'New event' })).toBeDefined();

    fireEvent.click(row);

    expect(router.state.location.pathname).toBe(
      `/app/events/ev_${'Bisi & Kola’s engagement'.length}`,
    );
  });

  it('keeps New event off the banner for a role without Create events', async () => {
    signedIn(
      membership({
        id: 'org_1',
        permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'events.create'),
      }),
    );
    serving([event('Ireti at 40')]);
    open();

    await screen.findByRole('button', { name: /^Ireti at 40/u });

    expect(within(content()).queryByRole('button', { name: 'New event' })).toBeNull();
  });

  it('takes Calendar and All events to their pages', async () => {
    signedIn(membership({ id: 'org_1' }));
    serving([event('Ireti at 40')]);
    const router = open();

    fireEvent.click(await screen.findByRole('button', { name: 'All events' }));
    expect(router.state.location.pathname).toBe('/app/events');

    await router.navigate('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Calendar' }));
    expect(router.state.location.pathname).toBe('/app/calendar');
  });

  it('keeps the count it had for a role that cannot read events', async () => {
    signedIn(
      membership({
        id: 'org_1',
        permissions: OWNER_PERMISSIONS.filter((permission) => !permission.startsWith('events.')),
      }),
    );
    serving([]);
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
  });
});
