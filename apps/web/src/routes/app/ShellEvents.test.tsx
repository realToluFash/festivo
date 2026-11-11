import type { Membership } from '@soirely/api-client';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { membership, OWNER_PERMISSIONS } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

function signedIn(organisation: Membership, organisations: Membership[] = [organisation]): void {
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
      organisations,
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function event(id: string, name: string, rest: Record<string, unknown> = {}) {
  return {
    id,
    organisationId: 'org_1',
    name,
    type: 'wedding',
    status: 'live',
    phase: 'live',
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

/** Each organisation's events, and every other request left waiting. */
function serving(byOrganisation: Record<string, object[]>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    const organisationId = /^\/api\/orgs\/([^/]+)\/events$/u.exec(url.pathname)?.[1];
    const events = organisationId == null ? undefined : byOrganisation[organisationId];

    if (events == null) return new Promise<Response>(() => {});

    const shown = url.searchParams.get('finished') === 'true' ? [] : events;

    return new Response(JSON.stringify({ events: shown, total: shown.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

const sidebar = () => screen.getByRole('navigation', { name: 'Soirely' });

afterEach(() => {
  vi.restoreAllMocks();
});

const EVENTS = [
  event('ev_draft', 'Ireti’s fortieth', { status: 'draft', phase: 'draft' }),
  event('ev_later', 'Bisi & Kola’s engagement', {
    startsAt: '2099-12-20T16:00:00+01:00',
    endsAt: '2099-12-20T23:00:00+01:00',
    dayCount: 1,
  }),
  event('ev_sooner', 'Tunde & Amaka’s wedding'),
];

describe('the sidebar’s Your events at a desk (sc-39290)', () => {
  it.each(['/app', '/app/events', '/app/calendar', '/app/settings'])(
    'lists Today’s events in Today’s order on %s, each a link to its page',
    async (path) => {
      signedIn(membership({ id: 'org_1' }));
      serving({ org_1: EVENTS });
      open(path);

      const heading = await within(sidebar()).findByRole('heading', { name: 'Your events' });
      const rows = within(heading.parentElement as HTMLElement).getAllByRole('link');

      expect(rows.map((row) => row.textContent)).toEqual([
        'Tunde & Amaka’s wedding',
        'Bisi & Kola’s engagement',
        'Ireti’s fortieth',
      ]);
      expect(rows.map((row) => row.getAttribute('href'))).toEqual([
        '/app/events/ev_sooner',
        '/app/events/ev_later',
        '/app/events/ev_draft',
      ]);
      expect(rows.some((row) => row.hasAttribute('aria-current'))).toBe(false);
    },
  );

  it('has no heading over nothing, and keeps Settings and the person at the foot', async () => {
    signedIn(membership({ id: 'org_1' }));
    const fetched = serving({ org_1: [] });
    open('/app/events');

    await waitFor(() => expect(fetched).toHaveBeenCalled());
    await act(async () => {});

    expect(within(sidebar()).queryByRole('heading', { name: 'Your events' })).toBeNull();
    expect(within(sidebar()).getByRole('link', { name: 'Settings' })).toBeDefined();
    expect(within(sidebar()).getByRole('link', { name: /^Folake Adeyemi/u })).toBeDefined();
  });

  it('leaves an event’s page its own sidebar', async () => {
    signedIn(membership({ id: 'org_1' }));
    const fetched = serving({ org_1: EVENTS });
    open('/app/events/ev_sooner');

    await waitFor(() => expect(fetched).toHaveBeenCalled());
    await act(async () => {});

    expect(within(sidebar()).queryByRole('heading', { name: 'Your events' })).toBeNull();
  });

  it('never shows the previous organisation’s events once the switch is made', async () => {
    const first = membership({ id: 'org_1' });
    const second = membership({ id: 'org_2', name: 'Second' });
    signedIn(first, [first, second]);
    serving({ org_1: EVENTS });
    open('/app/settings');

    await within(sidebar()).findByRole('heading', { name: 'Your events' });

    act(() => signedIn(second, [first, second]));

    expect(within(sidebar()).queryByRole('heading', { name: 'Your events' })).toBeNull();
    expect(within(sidebar()).queryByText('Tunde & Amaka’s wedding')).toBeNull();
  });
});
