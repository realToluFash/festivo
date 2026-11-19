import type { OutsideEvent } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { __forgetTab } from '../../tabKept.ts';
import { routes } from '../index.tsx';

const WEDDING: OutsideEvent = {
  id: 'ev_1',
  name: 'Adaeze and Tunde',
  organisationName: 'Ìrè Events',
  role: 'can_view',
  jobLabel: 'Cloakroom',
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-15T02:00:00+01:00',
};

const LAUNCH: OutsideEvent = {
  id: 'ev_2',
  name: 'Studio launch',
  organisationName: 'Ayo Events',
  role: 'can_edit',
  jobLabel: null,
  startsAt: '2030-12-05T16:00:00+01:00',
  endsAt: '2030-12-05T23:00:00+01:00',
};

const READS = ['events.read', 'guests.read', 'schedule.read', 'seating.read', 'people.read'];
const EDITS = [...READS, 'events.manage', 'guests.manage', 'menu.read', 'menu.manage'];

function event(held: OutsideEvent) {
  return {
    id: held.id,
    organisationId: held.id === 'ev_1' ? 'org_ire' : 'org_ayo',
    name: held.name,
    type: 'wedding',
    status: 'live',
    startsAt: held.startsAt,
    endsAt: held.endsAt,
    timeZone: 'Africa/Lagos',
    dayCount: 1,
    currency: 'NGN',
    cover: null,
    venue: { name: 'Eko Hotel', address: null },
    arrivalNote: null,
    hosts: [],
    madeLiveAt: '2026-10-26T15:00:00+00:00',
    pausedAt: null,
    phase: 'live',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: held.role === 'can_edit' ? EDITS : READS,
  };
}

function outside(events: OutsideEvent[]): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Bisi Adebayo',
      email: 'bisi@lagoslights.example',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u_bisi',
      needsOrganisation: false,
      hasPassword: true,
      organisation: null,
      organisations: [],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
      outsideEvents: events,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

function answering(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    const held = [WEDDING, LAUNCH].find((one) => path === `/api/events/${one.id}`);
    if (held != null) return json({ event: event(held) });
    if (path.endsWith('/people'))
      return json({
        people: [1, 2, 3].map((n) => ({
          id: `p_${n}`,
          membershipId: null,
          user: { id: `u_${n}`, name: `Person ${n}` },
          role: 'can_view',
          jobLabel: null,
          outside: true,
          address: null,
          addressKind: null,
          endsAt: null,
        })),
        owners: [],
        admins: [],
      });

    return json({});
  });
}

function app(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

function areas(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Event' });

  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

afterEach(() => {
  vi.restoreAllMocks();
  __forgetTab();
});

describe('an account with no organisation, inside an event it holds (sc-71)', () => {
  it('lands on its first event at /app, with the reading areas and no Today, Events, Calendar or switcher', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    const router = app('/app');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(router.state.location.pathname).toBe('/app/events/ev_1');
    expect(areas()).toEqual(['Overview', 'Guests', 'Schedule', 'Seating', 'People']);
    for (const name of ['Today', 'Events', 'Calendar', 'Settings'])
      expect(screen.queryByRole('link', { name })).toBeNull();
    expect(screen.queryByRole('button', { name: /Switch organisation/u })).toBeNull();
  });

  it('opens Overview as the demo draws it: the level line, then Guests and how many are on the event', async () => {
    outside([WEDDING]);
    answering();
    app('/app/events/ev_1');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(screen.getByText('Thu, Nov 14 · 16:00 to Fri, Nov 15, 02:00')).toBeDefined();
    expect(screen.getByText('Can view · Cloakroom · until Fri, Nov 15, 02:00')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByText('Names and replies only, no contact details')).toBeDefined();
    expect(await screen.findByText('3 people on this event')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Edit details/u })).toBeNull();
  });

  it('gives Can edit every area but Budget, in the member sidebar’s order, and no Duplicate or Delete', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    app('/app/events/ev_2');

    await screen.findAllByText('Studio launch');
    expect(areas()).toEqual([
      'Overview',
      'Guests',
      'Menu',
      'Seating',
      'Messages',
      'Schedule',
      'Staff',
      'People',
      'Reports',
    ]);
    expect(screen.queryByText(/Duplicate/u)).toBeNull();
    expect(screen.queryByText(/Delete/u)).toBeNull();
  });

  it('sends an event it does not hold, and an area its level does not open, to the event it lands on', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    const router = app('/app/events/ev_9/guests');

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
    await router.navigate('/app/events/ev_1/budget');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
  });

  it('reaches Your account and Sign out from the person at the sidebar’s foot', async () => {
    outside([WEDDING]);
    answering();
    const router = app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Your account', 'Sign out']);

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Your account' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/account'));
  });
});
