import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session, useSession } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const CASA = membership({ id: 'org_2', name: 'Casa Lumen Eventos' });

function event(organisationId: string) {
  return {
    id: 'ev_1',
    organisationId,
    name: 'Adaeze and Tunde',
    type: 'wedding',
    status: 'draft',
    startsAt: '2030-11-14T16:00:00+01:00',
    endsAt: '2030-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    cover: null,
    venue: null,
    arrivalNote: null,
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: OWNER_PERMISSIONS,
  };
}

function signedIn(organisations = [IRE, CASA]): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations,
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ETag: '"1"' } });
}

function answering(event: () => Response) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;

    return line === 'GET /api/events/ev_1' ? event() : json({ events: [], total: 0 });
  });
}

function WorkingIn() {
  return <output data-testid="working-in">{useSession().organisation?.id}</output>;
}

function workingIn(): string | null {
  return screen.getByTestId('working-in').textContent;
}

function openLink(): void {
  const router = createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1'] });

  render(
    <>
      <WorkingIn />
      <RouterProvider router={router} />
    </>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("an event's link from another of the account's organisations (sc-80863)", () => {
  it('moves the account into it and says so under the crumb', async () => {
    signedIn();
    answering(() => json({ event: event('org_2') }));
    openLink();

    expect(await screen.findByText('Now working in Casa Lumen Eventos.')).toBeTruthy();
    expect(workingIn()).toBe('org_2');
    expect(screen.queryByText('This event is not available')).toBeNull();
  });

  it('opens an event of the organisation worked in as before, with no notice', async () => {
    signedIn();
    answering(() => json({ event: event('org_1') }));
    openLink();

    expect((await screen.findAllByText('Adaeze and Tunde')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Now working in/)).toBeNull();
    expect(workingIn()).toBe('org_1');
  });

  it('is not available, and moves nothing, for an organisation the account is not in', async () => {
    signedIn([IRE]);
    answering(() => json({ event: event('org_2') }));
    openLink();

    expect(await screen.findByText('This event is not available')).toBeTruthy();
    expect(workingIn()).toBe('org_1');
  });

  it('is not available, and moves nothing, when the API has nothing for the account', async () => {
    signedIn();
    answering(() => json({ status: 404 }, 404));
    openLink();

    expect(await screen.findByText('This event is not available')).toBeTruthy();
    expect(workingIn()).toBe('org_1');
  });

  it('stays put while the event fails to load, and moves once Try again loads it', async () => {
    signedIn();
    let reads = 0;
    answering(() => {
      reads += 1;

      return reads === 1 ? json({}, 500) : json({ event: event('org_2') });
    });
    openLink();

    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(workingIn()).toBe('org_1');
    fireEvent.click(retry);

    await waitFor(() => expect(workingIn()).toBe('org_2'));
    expect(await screen.findByText('Now working in Casa Lumen Eventos.')).toBeTruthy();
  });
});
