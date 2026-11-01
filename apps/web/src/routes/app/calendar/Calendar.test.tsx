import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { serverClock } from '@soirely/domain';

import { __setSessionState, type Session, switchOrganisation } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const LAGOON = membership({ id: 'org_2', name: 'Lagoon Weddings' });

const READER = membership({
  ...IRE,
  role: { id: 'role_5', seededAs: 'read_only', name: null },
  permissions: OWNER_PERMISSIONS.filter((permission) => permission.endsWith('.read')),
});

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
    name: 'Adaeze and Tunde',
    type: 'wedding',
    status: 'live',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-14T22:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 1,
    currency: 'NGN',
    cover: null,
    venue: null,
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: '2026-10-21T09:00:00+00:00',
    pausedAt: null,
    phase: 'live',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    milestones: [],
    ...overrides,
  };
}

const WEDDING = event({
  id: 'ev_wedding',
  name: 'Boda Lisboa',
  startsAt: '2026-11-28T15:00:00+00:00',
  endsAt: '2026-12-01T12:00:00+00:00',
  timeZone: 'Europe/Lisbon',
  dayCount: 4,
});

/** 08:00 on Sunday where it is held, which is still Saturday everywhere west of the date line's far side. */
const ISLAND = event({
  id: 'ev_island',
  name: 'Sunrise brunch',
  startsAt: '2026-11-15T08:00:00+14:00',
  endsAt: '2026-11-15T11:00:00+14:00',
  timeZone: 'Pacific/Kiritimati',
});

const DINNER = event({
  id: 'ev_dinner',
  name: 'Board dinner',
  startsAt: '2026-11-20T19:00:00+01:00',
  endsAt: '2026-11-20T22:00:00+01:00',
  milestones: [
    {
      at: '2026-11-10T12:00:00+01:00',
      title: 'Send numbers to the kitchen',
      note: null,
      owner: 'you',
      area: 'guests',
      action: { label: 'Open guests', link: '/app/events/ev_dinner/guests' },
    },
    {
      at: '2026-11-12T09:00:00+01:00',
      title: 'Seating locked',
      note: null,
      owner: 'automatic',
      area: 'seating',
      action: null,
    },
  ],
});

function signedIn(organisation = IRE, organisations = [IRE, LAGOON]): void {
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
    organisation,
    organisations,
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function answering(byOrganisation: Record<string, Record<string, unknown>[] | 'fail'>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    const organisation = /^\/api\/orgs\/([^/]+)\/events$/.exec(url.pathname)?.[1] ?? '';
    const events = byOrganisation[organisation] ?? [];

    if (events === 'fail') return new Response('{}', { status: 500 });

    const finished = url.searchParams.get('finished') === 'true';
    const page = finished
      ? events.filter((one) => one.phase === 'finished')
      : events.filter((one) => one.phase !== 'finished');

    return new Response(JSON.stringify({ events: page, total: page.length }), { status: 200 });
  });
}

function at(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function day(name: RegExp): HTMLElement {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T09:00:00Z'));
  serverClock.observe(new Date().toUTCString());
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Calendar', () => {
  it('waits a second while it loads, then shows the shape of its rows under its loading words', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    at('/app/calendar');

    const busy = await screen.findByText(
      (_, element) => element?.getAttribute('aria-busy') === 'true',
    );

    expect(screen.queryByText('Loading the calendar…')).toBeNull();
    expect((await screen.findByRole('status', {}, { timeout: 2000 })).textContent).toBe(
      'Loading the calendar…',
    );
    expect(busy.querySelectorAll('.skeleton-row-60').length).toBeGreaterThan(0);
  });

  it('is in the navigation, and opens on this month', async () => {
    signedIn();
    answering({ org_1: [WEDDING] });
    at('/app/calendar');

    expect(screen.getByRole('link', { name: 'Calendar' }).getAttribute('href')).toBe(
      '/app/calendar',
    );
    expect(await screen.findByRole('grid', { name: 'Month' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
    expect(day(/^Today, Tuesday, November 3$/).getAttribute('aria-current')).toBe('date');
  });

  it('draws a multi-day event on each of its days, across the end of the month', async () => {
    signedIn();
    answering({ org_1: [WEDDING] });
    at('/app/calendar');
    await screen.findByRole('grid');

    for (const name of [
      /^Saturday, November 28, 1 item$/,
      /^Sunday, November 29, 1 item$/,
      /^Monday, November 30, 1 item$/,
    ]) {
      expect(day(name)).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    expect(day(/^Tuesday, December 1, 1 item$/)).toBeTruthy();
    expect(day(/^Wednesday, December 2$/)).toBeTruthy();

    fireEvent.click(day(/^Tuesday, December 1, 1 item$/));

    const list = screen.getByRole('dialog', { name: /Tuesday, Dec 1/ });

    expect(
      within(list)
        .getByRole('link', { name: /Boda Lisboa/ })
        .getAttribute('href'),
    ).toBe('/app/events/ev_wedding');
    expect(within(list).getByText(/Sat, Nov 28 to Tue, Dec 1/)).toBeTruthy();
  });

  it("places an event on its own calendar day, with its zone named, not on the reader's", async () => {
    signedIn();
    answering({ org_1: [ISLAND] });
    at('/app/calendar');
    await screen.findByRole('grid');

    expect(day(/^Sunday, November 15, 1 item$/)).toBeTruthy();
    expect(day(/^Saturday, November 14$/)).toBeTruthy();

    fireEvent.click(day(/^Sunday, November 15/));

    expect(within(screen.getByRole('dialog')).getByText('08:00 Pacific/Kiritimati')).toBeTruthy();
  });

  it('shows milestones under Events and milestones, and leaves them out under Events only', async () => {
    signedIn();
    answering({ org_1: [DINNER] });
    at('/app/calendar');
    await screen.findByRole('grid');

    expect(day(/^Tuesday, November 10, 1 item$/)).toBeTruthy();

    fireEvent.click(day(/^Tuesday, November 10/));

    const list = screen.getByRole('dialog');

    expect(
      within(list)
        .getByRole('link', { name: /Send numbers to the kitchen/ })
        .getAttribute('href'),
    ).toBe('/app/events/ev_dinner/guests');
    fireEvent.click(within(list).getByRole('button', { name: 'Close' }));
    fireEvent.click(day(/^Thursday, November 12/));
    expect(
      within(screen.getByRole('dialog'))
        .getByRole('link', { name: /Seating locked/ })
        .getAttribute('href'),
    ).toBe('/app/events/ev_dinner/dates');
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Show' }), {
      target: { value: 'events' },
    });

    expect(day(/^Tuesday, November 10$/)).toBeTruthy();
    expect(day(/^Friday, November 20, 1 item$/)).toBeTruthy();
  });

  it('moves by day with the arrow keys, across the edge of the month, and opens a day with Enter', async () => {
    signedIn();
    answering({ org_1: [WEDDING] });
    at('/app/calendar');
    await screen.findByRole('grid');

    const today = day(/^Today, Tuesday, November 3$/);

    expect(today.tabIndex).toBe(0);
    fireEvent.keyDown(today, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(day(/^Tuesday, November 10$/));

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });

    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(day(/^Tuesday, December 8$/));
  });

  it('shows "+n more" on a day with more than fits, and the whole day in its list', async () => {
    signedIn();
    answering({
      org_1: ['a', 'b', 'c', 'd'].map((id) => event({ id, name: `Event ${id}` })),
    });
    at('/app/calendar');
    await screen.findByRole('grid');

    const busy = day(/^Saturday, November 14, 4 items$/);

    expect(within(busy).getByText('+2 more')).toBeTruthy();
    fireEvent.click(busy);
    expect(within(screen.getByRole('dialog')).getAllByRole('link')).toHaveLength(4);
  });

  it('lists the month by day in Agenda, and remembers the view and month', async () => {
    signedIn();
    answering({ org_1: [DINNER, WEDDING] });
    at('/app/calendar');
    await screen.findByRole('grid');

    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));

    const headings = screen.getAllByRole('heading', { level: 3 }).map((one) => one.textContent);

    expect(headings).toEqual([
      'Tuesday, Nov 10',
      'Thursday, Nov 12',
      'Friday, Nov 20',
      'Saturday, Nov 28',
      'Sunday, Nov 29',
      'Monday, Nov 30',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Nothing on the calendar in October 2026.')).toBeTruthy();
    act(() => screen.getByRole('link', { name: 'Events' }).click());
    act(() => screen.getByRole('link', { name: 'Calendar' }).click());

    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agenda' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it("changes to the other organisation's calendar when the organisation is switched", async () => {
    signedIn();
    answering({
      org_1: [DINNER],
      org_2: [
        event({
          id: 'ev_2',
          organisationId: 'org_2',
          name: 'Lagoon gala',
          startsAt: '2026-11-21T18:00:00+01:00',
          endsAt: '2026-11-21T23:00:00+01:00',
        }),
      ],
    });
    at('/app/calendar');
    await screen.findByRole('grid');
    expect(day(/^Friday, November 20, 1 item$/)).toBeTruthy();

    act(() => switchOrganisation('org_2'));

    expect(
      await screen.findByRole('button', { name: /^Saturday, November 21, 1 item$/ }),
    ).toBeTruthy();
    expect(day(/^Friday, November 20$/)).toBeTruthy();
  });

  it('shows the Events empty state with New event, or the ask-an-owner line for a reader', async () => {
    signedIn();
    answering({ org_1: [] });
    at('/app/calendar');

    expect(await screen.findByRole('heading', { name: 'Set up your first event' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New event' }).getAttribute('href')).toBe(
      '/app/events/new',
    );
    expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull();
  });

  it('asks a reader who may not create to ask an owner', async () => {
    signedIn(READER, [READER]);
    answering({ org_1: [] });
    at('/app/calendar');

    expect(await screen.findByText(/Ask an owner if you need to create one\./)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New event' })).toBeNull();
  });

  it('says it did not load, with Try again, and draws no grid', async () => {
    signedIn();
    answering({ org_1: 'fail' });
    at('/app/calendar');

    expect(await screen.findByText(/The calendar did not load\./)).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();

    answering({ org_1: [WEDDING] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('grid')).toBeTruthy();
  });
});
