import type { Membership, OutsideEvent } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { __forgetTab } from '../../tabKept.ts';
import { membership } from '../../test-memberships.ts';
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

const LIGHTS = membership({ id: 'org_lights', name: 'Lagos Lights' });
const OKAFOR = membership({
  id: 'org_okafor',
  name: 'Okafor Family',
  role: { id: 'role_2', seededAs: 'member', name: null },
});

function outside(events: OutsideEvent[], organisations: Membership[] = []): void {
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
      organisation: organisations[0] ?? null,
      organisations,
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

function answering(live: readonly OutsideEvent[] = [WEDDING, LAUNCH]): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/auth/me')
      return json({
        id: 'u_bisi',
        name: 'Bisi Adebayo',
        emailAddresses: [],
        phoneNumbers: [],
        outsideEvents: live,
      });
    const held = live.find((one) => path === `/api/events/${one.id}`);
    if (held != null) return json({ event: event(held) });
    if (path.startsWith('/api/events/') && path.split('/').length === 4)
      return json({ type: 'not_found', status: 404 }, 404);
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
    expect(screen.getByText(/^Can view · Cloakroom · until /u)).toBeDefined();
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

  it('sends an area its level does not open to the event’s Overview', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    const router = app('/app/events/ev_1/budget');

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
  });

  it('reaches Your account and Sign out from the person at the sidebar’s foot', async () => {
    outside([WEDDING]);
    answering([WEDDING]);
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

describe('an account with no organisation on two or more events (sc-68438)', () => {
  function rows(group: string): string[] {
    return within(screen.getByRole('group', { name: group }))
      .getAllByRole('menuitem')
      .map((row) => row.getAttribute('aria-label') ?? '');
  }

  it('lists Your events above Your account and Sign out, the event it is in marked You’re here in its place', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    expect(rows('Your events')).toEqual([
      'Adaeze and Tunde. Ìrè Events · Thu, Nov 14 · 16:00. You’re here',
      'Studio launch. Ayo Events · Thu, Dec 5 · 16:00',
    ]);
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
        .slice(-2),
    ).toEqual(['Your account', 'Sign out']);
  });

  it('shows nothing new with a single event', async () => {
    outside([WEDDING]);
    answering([WEDDING]);
    app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    expect(screen.queryByRole('group', { name: 'Your events' })).toBeNull();
  });

  it('opens another at its level, and choosing the one it is in only closes the list', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    const router = app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Adaeze and Tunde\./u }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(router.state.location.pathname).toBe('/app/events/ev_1');

    fireEvent.click(screen.getByRole('button', { name: 'Bisi Adebayo, Can view' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Studio launch\./u }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_2'));
    await waitFor(() => expect(areas()).toContain('Menu'));
  });

  it('answers an event revoked while the list was open as one that does not exist, and goes back to the event it came from', async () => {
    const live = [WEDDING, LAUNCH];
    outside([...live]);
    answering(live);
    const router = app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    live.pop();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Studio launch\./u }));

    await screen.findByRole('heading', { level: 1, name: 'This event is not available' });
    fireEvent.click(await screen.findByRole('button', { name: 'Back to Adaeze and Tunde' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    expect(screen.queryByRole('group', { name: 'Your events' })).toBeNull();
  });

  it('opened from its address with no event before it, goes back to the one it lands on', async () => {
    outside([WEDDING, LAUNCH]);
    answering();
    const router = app('/app/events/ev_9');

    fireEvent.click(await screen.findByRole('button', { name: 'Back to Adaeze and Tunde' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
  });

  it('with no live grant left, reads Continue', async () => {
    outside([WEDDING]);
    answering([]);
    app('/app/events/ev_9');

    await screen.findByRole('heading', { level: 1, name: 'This event is not available' });
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeDefined();
  });
});

describe('a member inside another organisation’s event it holds from outside (sc-68438)', () => {
  function rows(group: string): string[] {
    return within(screen.getByRole('group', { name: group }))
      .getAllByRole('menuitem')
      .map((row) => row.getAttribute('aria-label') ?? '');
  }

  it('shows the event’s level areas and none of its own organisation’s places, nor the switcher', async () => {
    outside([WEDDING, LAUNCH], [LIGHTS, OKAFOR]);
    answering();
    app('/app/events/ev_1');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(areas()).toEqual(['Overview', 'Guests', 'Schedule', 'Seating', 'People']);
    for (const name of ['Today', 'Events', 'Calendar', 'Settings'])
      expect(screen.queryByRole('link', { name })).toBeNull();
    expect(screen.queryByRole('button', { name: /Organisation: /u })).toBeNull();
  });

  it('lists Your organisations and, with two or more grants, Your events above Your account and Sign out', async () => {
    outside([WEDDING, LAUNCH], [LIGHTS, OKAFOR]);
    answering();
    app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    expect(rows('Your organisations')).toEqual(['Lagos Lights. Owner', 'Okafor Family. Member']);
    expect(rows('Your events')).toEqual([
      'Adaeze and Tunde. Ìrè Events · Thu, Nov 14 · 16:00. You’re here',
      'Studio launch. Ayo Events · Thu, Dec 5 · 16:00',
    ]);
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
        .slice(-2),
    ).toEqual(['Your account', 'Sign out']);
  });

  it('lists no Your events with a single grant', async () => {
    outside([WEDDING], [LIGHTS, OKAFOR]);
    answering([WEDDING]);
    app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    expect(rows('Your organisations')).toEqual(['Lagos Lights. Owner', 'Okafor Family. Member']);
    expect(screen.queryByRole('group', { name: 'Your events' })).toBeNull();
  });

  it('works in the organisation chosen and lands on its Today', async () => {
    outside([WEDDING, LAUNCH], [LIGHTS, OKAFOR]);
    answering();
    const router = app('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Bisi Adebayo, Can view' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Okafor Family. Member' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(
      await screen.findByRole('button', { name: /Organisation: Okafor Family/u }),
    ).toBeDefined();
  });
});
