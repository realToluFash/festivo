import type { Membership } from '@soirely/api-client';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
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
  vi.useRealTimers();
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

  it('a first run tells a role without Create events to ask an owner, in place of the way in', async () => {
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
    expect(within(content()).queryByRole('button', { name: 'New event' })).toBeNull();
    expect(
      screen.getByText(
        'Events your organisation creates will show here. Ask an owner if you need to create one.',
      ),
    ).toBeDefined();
  });

  it('draws This week and Your events, with no Needs you, and a row opens its event', async () => {
    signedIn(membership({ id: 'org_1' }));
    serving([event('Bisi & Kola’s engagement')]);
    const router = open();

    const row = await screen.findByRole('button', { name: /^Bisi & Kola’s engagement/u });
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeDefined();
    expect(within(content()).getByRole('heading', { level: 2, name: 'Your events' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /Needs you/u })).toBeNull();
    expect(within(row).getByText('Draft')).toBeDefined();
    expect(within(content()).getByRole('button', { name: 'New event' })).toBeDefined();

    fireEvent.click(row);

    expect(router.state.location.pathname).toBe(
      `/app/events/ev_${'Bisi & Kola’s engagement'.length}`,
    );
  });

  it('draws This week’s bars in rows, two that share a day one above the other (sc-37302)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T09:00:00+01:00'));
    const spanning = (name: string, first: string, last: string, dayCount: number) =>
      event(name, {
        status: 'live',
        phase: 'live',
        startsAt: `2026-11-${first}T10:00:00+01:00`,
        endsAt: `2026-11-${last}T20:00:00+01:00`,
        dayCount,
      });
    signedIn(membership({ id: 'org_1' }));
    serving([
      spanning('Aso ebi', '03', '06', 4),
      spanning('Bisi’s 40th', '05', '08', 4),
      spanning('Chidi & Ngozi', '07', '09', 3),
    ]);
    open();

    const week = await screen.findByRole('region', { name: 'This week' });
    await within(week).findAllByText('Aso ebi');
    const rows = [...week.querySelectorAll('.today-bar-row')].map((row) =>
      [...row.querySelectorAll('.today-bar-name')].map((name) => name.textContent),
    );

    expect(rows).toEqual([['Aso ebi', 'Chidi & Ngozi'], ['Bisi’s 40th']]);
  });

  it('keeps a row’s day count and its date each whole, so the date wraps rather than cuts (sc-36532)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T09:00:00+01:00'));
    signedIn(membership({ id: 'org_1' }));
    serving([
      event('Casamento', {
        status: 'live',
        phase: 'live',
        startsAt: '2027-04-01T16:00:00+01:00',
        endsAt: '2027-04-01T23:00:00+01:00',
        dayCount: 1,
      }),
    ]);
    await act(() => i18next.changeLanguage('pt'));

    try {
      open();

      const row = await screen.findByRole('button', { name: /^Casamento/u });
      const when = row.querySelector('.today-event-when') as HTMLElement;

      expect(when.querySelector('.today-event-count')?.textContent).toBe('Em 149 dias ·');
      expect(when.querySelector('.today-event-dates')?.textContent).toBe(
        'quinta-feira, 1 de abr. de 2027',
      );
    } finally {
      await act(() => i18next.changeLanguage('en'));
    }
  });

  it('keeps each date of a multi-day row whole, breaking only after the connector (sc-39091)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T09:00:00+01:00'));
    signedIn(membership({ id: 'org_1' }));
    serving([
      event('Casamento', {
        status: 'live',
        phase: 'live',
        startsAt: '2026-11-04T16:00:00+01:00',
        endsAt: '2026-11-06T23:00:00+01:00',
        dayCount: 3,
      }),
    ]);
    await act(() => i18next.changeLanguage('pt'));

    try {
      open();

      const row = await screen.findByRole('button', { name: /^Casamento/u });
      const when = row.querySelector('.today-event-when') as HTMLElement;
      const dates = [...when.querySelectorAll('.today-event-date')].map((date) => date.textContent);

      expect(when.querySelector('.today-event-count')?.textContent).toBe('Amanhã ·');
      expect(dates).toEqual(['De quarta-feira, 4 de nov. até', 'sexta-feira, 6 de nov.']);
      expect(
        screen.getByRole('button', {
          name: 'Casamento Amanhã · De quarta-feira, 4 de nov. até sexta-feira, 6 de nov. Última semana',
        }),
      ).toBe(row);
    } finally {
      await act(() => i18next.changeLanguage('en'));
    }
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

  it('shows Today to a Member who reads events only as each one is shared', async () => {
    signedIn(
      membership({
        id: 'org_1',
        permissions: OWNER_PERMISSIONS.filter((permission) => !permission.startsWith('events.')),
      }),
    );
    serving([event('Ireti at 40')]);
    open();

    expect(await screen.findByRole('button', { name: 'All events' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Dashboard' })).toBeNull();
  });
});
