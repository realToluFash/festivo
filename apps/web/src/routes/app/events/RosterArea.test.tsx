import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { cssRule, stylesheet } from '../../../test-styles.ts';

const ROSTER_CSS = stylesheet(import.meta.dirname, 'roster.css');

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-15T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 2,
  currency: 'NGN',
  cover: null,
  venue: {
    name: 'The Landmark',
    address: {
      formatted: 'Water Corporation Drive, Lagos',
      line1: null,
      line2: null,
      city: 'Lagos',
      region: null,
      postalCode: null,
      countryCode: null,
      latitude: null,
      longitude: null,
    },
  },
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number, more: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...more }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Answer = (body: unknown) => Response | Promise<Response>;

function entry(id: string, fullName: string, more: Record<string, unknown> = {}) {
  return {
    id,
    fullName,
    mobile: null,
    email: null,
    job: null,
    station: null,
    shift: null,
    link: 'no_mobile',
    contactsErased: false,
    ...more,
  };
}

async function onRoster(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
  phase = 'live',
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions, phase } });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/roster'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Staff' });

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The Roster on the Staff page (sc-3906)', () => {
  it('ends its crumb row with the one bell at a desk (sc-39509)', async () => {
    signedIn();
    await onRoster({});

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('answers a member without the staff permission as a page that does not exist, under the crumb row and its one bell (sc-39509)', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? json({ event: { ...EVENT, permissions: ['events.read'], phase: 'live' } })
        : json({}),
    );
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/roster'] })}
      />,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('answers an area an event does not have as a page that does not exist, under the crumb row and its one bell (sc-39509)', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({}));
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/bogus'] })}
      />,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('opens from Staff at its own address, with no tab bar while it is the only tab', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? json({ event: { ...EVENT, permissions: OWNER_PERMISSIONS, phase: 'live' } })
        : json({ staff: [] }),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Nobody on the staff yet')).toBeDefined();
    expect(router.state.location.pathname).toBe('/app/events/ev_1/staff/roster');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('navigation', { name: 'Staff' })).toBeNull();
  });

  it("sits inside the desk's button and field resets, and wraps its card's header when narrow", async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? json({ event: { ...EVENT, permissions: OWNER_PERMISSIONS, phase: 'live' } })
        : json({ staff: [] }),
    );
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/roster'] })}
      />,
    );

    const add = await screen.findByRole('button', { name: 'Add a person' });
    expect(add.closest('.desk.ev')).not.toBeNull();
    expect(
      cssRule('.rs .sn-card-names', ROSTER_CSS.slice(ROSTER_CSS.indexOf('(width <= 720px)'))),
    ).toContain('flex-basis: 12rem;');
  });

  it('adds a person by name alone, refusing a blank name beside its field', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () => json({ staff: [] }),
      'POST /api/events/ev_1/staff': () =>
        json({ staff: entry('st_1', 'Chidi Okafor'), member: null }, 201),
    });

    expect(await screen.findByText('Nobody on the staff yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add a person' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Enter their name.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/staff')).toBe(false);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Chidi Okafor ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findAllByText('Chidi Okafor added to the roster.')).toHaveLength(2);
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/staff')?.body).toEqual({
      fullName: 'Chidi Okafor',
      mobile: null,
      email: null,
      allowShared: false,
    });
    expect(screen.getByRole('button', { name: 'Chidi Okafor' })).toBeDefined();
    expect(screen.getByText('Add a mobile number to send a link')).toBeDefined();
  });

  it('warns that a number is shared, then adds anyway, and names the member it linked', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({ staff: [entry('st_1', 'Amaka Eze', { mobile: '+2348031234567', link: 'none' })] }),
      'POST /api/events/ev_1/staff': (body) =>
        (body as { allowShared: boolean }).allowShared
          ? json(
              {
                staff: entry('st_2', 'Bola Ade', { mobile: '+2348031234567', link: 'none' }),
                member: 'Bola Adeyemi',
              },
              201,
            )
          : problem('staff_number_shared', 409, { sharedWith: 'Amaka Eze' }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a person' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bola Ade' } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), {
      target: { value: '803 123 4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Amaka Eze already uses this number')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));

    expect(await screen.findByText('Bola Ade added to the roster.')).toBeDefined();
    expect(
      screen.getByText(
        'Bola Adeyemi is a member of Ìrè Events. Their shift will appear in their app.',
      ),
    ).toBeDefined();
    const posts = sent.filter((one) => one.line === 'POST /api/events/ev_1/staff');
    expect(posts.map((one) => (one.body as { allowShared: boolean }).allowShared)).toEqual([
      false,
      true,
    ]);
  });

  it('removes a person after asking', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () => json({ staff: [entry('st_1', 'Amaka Eze')] }),
      'DELETE /api/events/ev_1/staff/st_1': () => new Response(null, { status: 204 }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Amaka Eze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from the event' }));
    expect(screen.getByRole('heading', { name: 'Remove Amaka Eze from the event?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from the event' }));

    await waitFor(() =>
      expect(sent.some((one) => one.line === 'DELETE /api/events/ev_1/staff/st_1')).toBe(true),
    );
    expect(await screen.findByText('Nobody on the staff yet')).toBeDefined();
  });

  it('keeps everyone once the event has finished: no Remove, but Edit stays', async () => {
    signedIn();
    await onRoster(
      { 'GET /api/events/ev_1/staff': () => json({ staff: [entry('st_1', 'Amaka Eze')] }) },
      OWNER_PERMISSIONS,
      'finished',
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Amaka Eze' }));
    expect(screen.queryByRole('button', { name: 'Remove from the event' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('shows the roster read-only without permission to manage staff', async () => {
    signedIn();
    await onRoster(
      { 'GET /api/events/ev_1/staff': () => json({ staff: [entry('st_1', 'Amaka Eze')] }) },
      OWNER_PERMISSIONS.filter((one) => one !== 'staff.manage'),
    );

    expect(
      await screen.findByText(
        'You can see the roster. Changing it needs permission to manage staff.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add a person' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Amaka Eze' }));
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});
