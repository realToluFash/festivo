import { type Account, type OutsideEvent, gateOf, heldByDevice } from '@soirely/api-client';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { __forgetTab } from '../../tabKept.ts';
import { routes } from '../index.tsx';

const SHIFT: OutsideEvent = {
  id: 'ev_1',
  name: 'Joana & Rui’s wedding',
  organisationName: 'Lumen Feiras',
  role: 'can_view',
  jobLabel: 'Bar',
  startsAt: '2030-11-14T15:00:00+00:00',
  endsAt: '2030-11-14T23:30:00+00:00',
};

const ME = {
  id: 'u_joao',
  name: 'João Pereira',
  verified: false,
  complete: true,
  emailAddresses: [],
  phoneNumbers: [],
  outsideEvents: [SHIFT],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

const asked: string[] = [];

function answering(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    asked.push(path);
    if (path === '/api/auth/me') return json(ME);
    if (path === '/api/events/ev_1')
      return json({
        event: {
          id: 'ev_1',
          organisationId: 'org_lumen',
          name: SHIFT.name,
          type: 'wedding',
          status: 'live',
          startsAt: SHIFT.startsAt,
          endsAt: SHIFT.endsAt,
          timeZone: 'Europe/Lisbon',
          dayCount: 1,
          currency: 'EUR',
          cover: null,
          venue: { name: 'Quinta do Torneiro', address: null },
          arrivalNote: null,
          hosts: [],
          madeLiveAt: '2026-10-26T15:00:00+00:00',
          pausedAt: null,
          phase: 'live',
          concludedAt: null,
          createdAt: '2026-10-21T09:00:00+00:00',
          permissions: [
            'events.read',
            'guests.read',
            'schedule.read',
            'seating.read',
            'people.read',
          ],
        },
      });
    if (path.startsWith('/api/events/ev_1/')) return json({ people: [], owners: [], admins: [] });

    return json({ type: 'account_unverified', status: 403 }, 403);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  __forgetTab();
  asked.length = 0;
});

describe('the account a door code makes (sc-72)', () => {
  it('has no gate to pass, while an address not yet proved still has one', () => {
    const held = ME as unknown as Account;
    const unproved = {
      ...ME,
      emailAddresses: [{ address: 'joao@example.test', primary: true, verified: false }],
    } as unknown as Account;

    expect(heldByDevice(held)).toBe(true);
    expect(gateOf(held)).toBeNull();
    expect(heldByDevice(unproved)).toBe(false);
    expect(gateOf(unproved)).toBe('email');
  });

  it('lands inside its event, and asks for nothing the API refuses it', async () => {
    __setSessionState({
      status: 'signedIn',
      session: {
        name: ME.name,
        email: '',
        verified: false,
        complete: true,
        awaiting: null,
        heldByDevice: true,
        providers: [],
        userId: ME.id,
        needsOrganisation: false,
        hasPassword: false,
        organisation: null,
        organisations: [],
        organisationCountry: null,
        timezone: null,
        waitingFor: null,
        outsideEvents: [SHIFT],
      },
    });
    answering();
    const router = createMemoryRouter(routes, { initialEntries: ['/app'] });
    render(<RouterProvider router={router} />);

    await screen.findByRole('heading', { level: 1, name: SHIFT.name });
    expect(router.state.location.pathname).toBe('/app/events/ev_1');
    expect(
      asked.filter((path) => path === '/api/invitations' || path === '/api/join-offers'),
    ).toEqual([]);
  });
});
