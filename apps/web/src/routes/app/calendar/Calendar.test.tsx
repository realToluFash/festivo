import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    permissions: OWNER_PERMISSIONS,
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

function day(date: string): HTMLElement {
  const button = document.querySelector<HTMLElement>(`[data-day="${date}"]`);

  if (button == null) throw new Error(`no day ${date}`);

  return button;
}

function label(date: string): string | null {
  return day(date).getAttribute('aria-label');
}

async function loaded(): Promise<HTMLElement> {
  const grid = await screen.findByRole('grid', {}, WAIT);

  await waitFor(() => expect(grid.getAttribute('aria-busy')).toBe('false'), WAIT);

  return grid;
}

const WAIT = { timeout: 8000 };
const SLOW = { timeout: 20000 };

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

describe('Calendar, weeks as lanes (sc-30413)', () => {
  it(
    'says it is loading over a busy grid of weeks, with nothing in it to reach',
    SLOW,
    async () => {
      signedIn();
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
      at('/app/calendar');

      const grid = await screen.findByRole('grid', {}, WAIT);

      expect(grid.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByRole('status').textContent).toMatch(/Loading the calendar…$/);
      expect(grid.querySelector('a')).toBeNull();
    },
  );

  it('is in the navigation, and opens on the month holding today', SLOW, async () => {
    signedIn();
    answering({ org_1: [WEDDING] });
    at('/app/calendar');
    await loaded();

    expect(screen.getByRole('link', { name: 'Calendar' }).getAttribute('href')).toBe(
      '/app/calendar',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'November 2026' })).toBeTruthy();
    expect(label('2026-11-03')).toBe('Today, Tuesday, November 3');
    expect(day('2026-11-03').getAttribute('aria-current')).toBe('date');
  });

  it(
    'draws a multi-day event across its days and the end of the month, linked to its page',
    SLOW,
    async () => {
      signedIn();
      answering({ org_1: [WEDDING] });
      at('/app/calendar');
      await loaded();

      expect(label('2026-11-28')).toBe('Saturday, November 28, 1 item');
      expect(label('2026-11-30')).toBe('Monday, November 30, 1 item');
      expect(label('2026-12-01')).toBe('Tuesday, December 1, 1 item');
      expect(label('2026-12-02')).toBe('Wednesday, December 2');

      fireEvent.click(day('2026-12-01'));

      const panel = screen.getByRole('complementary', { name: 'Tuesday, Dec 1' });
      const bar = within(panel).getByRole('link', { name: /^Boda Lisboa, Live, / });

      expect(bar.getAttribute('href')).toBe('/app/events/ev_wedding');
      expect(within(panel).getByText(/Sat, Nov 28 to Tue, Dec 1/)).toBeTruthy();
    },
  );

  it(
    "places an event on its own calendar day, with its zone named, not on the reader's",
    SLOW,
    async () => {
      signedIn();
      answering({ org_1: [ISLAND] });
      at('/app/calendar');
      await loaded();

      expect(label('2026-11-15')).toBe('Sunday, November 15, 1 item');
      expect(label('2026-11-14')).toBe('Saturday, November 14');

      fireEvent.click(day('2026-11-15'));

      expect(
        within(screen.getByRole('complementary', { name: 'Sunday, Nov 15' })).getByText(
          /08:00 Pacific\/Kiritimati/,
        ),
      ).toBeTruthy();
    },
  );

  it(
    'shows milestones under Events and milestones, and leaves them out under Events only',
    SLOW,
    async () => {
      signedIn();
      answering({ org_1: [DINNER] });
      at('/app/calendar');
      await loaded();

      expect(label('2026-11-10')).toBe('Tuesday, November 10, 1 item');

      fireEvent.click(day('2026-11-10'));
      expect(
        within(screen.getByRole('complementary', { name: 'Tuesday, Nov 10' }))
          .getByRole('link', { name: /^Send numbers to the kitchen, / })
          .getAttribute('href'),
      ).toBe('/app/events/ev_dinner/guests');
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      fireEvent.click(day('2026-11-12'));
      expect(
        within(screen.getByRole('complementary', { name: 'Thursday, Nov 12' }))
          .getByRole('link', { name: /^Seating locked, / })
          .getAttribute('href'),
      ).toBe('/app/events/ev_dinner/dates');
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

      fireEvent.click(screen.getByRole('button', { name: 'Show: Events and milestones' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Events only' }));

      expect(screen.getByRole('button', { name: 'Show: Events only' })).toBeTruthy();
      expect(label('2026-11-10')).toBe('Tuesday, November 10');
      expect(label('2026-11-20')).toBe('Friday, November 20, 1 item');
    },
  );

  it('moves by day with the arrow keys, across the edge of the month', SLOW, async () => {
    signedIn();
    answering({ org_1: [WEDDING] });
    at('/app/calendar');
    await loaded();

    const today = day('2026-11-03');

    expect(today.tabIndex).toBe(0);
    today.focus();
    for (let week = 0; week < 5; week++) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    }

    expect((document.activeElement as HTMLElement).dataset.day).toBe('2026-12-08');
  });

  it(
    'says "+n more" on a day with more than fits, and the whole day in its panel',
    SLOW,
    async () => {
      signedIn();
      answering({
        org_1: ['a', 'b', 'c', 'd'].map((id) => event({ id, name: `Event ${id}` })),
      });
      at('/app/calendar');
      await loaded();

      expect(label('2026-11-14')).toBe('Saturday, November 14, 4 items');
      expect(
        within(day('2026-11-14').closest('[role="gridcell"]')!).getByText(/^\+\d more$/),
      ).toBeTruthy();

      fireEvent.click(day('2026-11-14'));
      expect(
        within(screen.getByRole('complementary', { name: 'Saturday, Nov 14' })).getAllByRole(
          'link',
        ),
      ).toHaveLength(4);
    },
  );

  it('lists the days in Agenda, and remembers the view', SLOW, async () => {
    signedIn();
    answering({ org_1: [DINNER, WEDDING] });
    at('/app/calendar');
    await loaded();

    fireEvent.click(screen.getByRole('radio', { name: 'View: Agenda' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Tuesday, Nov 10' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Friday, Nov 20' })).toBeTruthy();

    act(() => screen.getByRole('link', { name: 'Events' }).click());
    act(() => screen.getByRole('link', { name: 'Calendar' }).click());

    expect(
      await screen.findByRole('radio', { name: 'View: Agenda', checked: true }, WAIT),
    ).toBeTruthy();
  });

  it(
    "changes to the other organisation's calendar when the organisation is switched",
    SLOW,
    async () => {
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
      await loaded();
      expect(label('2026-11-20')).toBe('Friday, November 20, 1 item');

      act(() => switchOrganisation('org_2'));

      await waitFor(() => expect(label('2026-11-21')).toBe('Saturday, November 21, 1 item'), WAIT);
      expect(label('2026-11-20')).toBe('Friday, November 20');
    },
  );

  it('shows the Events empty state with New event', SLOW, async () => {
    signedIn();
    answering({ org_1: [] });
    at('/app/calendar');

    expect(
      await screen.findByRole('heading', { name: 'Set up your first event' }, WAIT),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New event' }).getAttribute('href')).toBe(
      '/app/events/new',
    );
    expect(screen.queryByRole('radio', { name: 'View: Agenda' })).toBeNull();
  });

  it('asks a reader who may not create to ask an owner', SLOW, async () => {
    signedIn(READER, [READER]);
    answering({ org_1: [] });
    at('/app/calendar');

    expect(
      await screen.findByText(/Ask an owner if you need to create one\./, {}, WAIT),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New event' })).toBeNull();
  });

  it('says it did not load, with Try again, then loads', SLOW, async () => {
    signedIn();
    answering({ org_1: 'fail' });
    at('/app/calendar');

    expect((await screen.findByRole('alert', {}, WAIT)).textContent).toMatch(
      /The calendar did not load\./,
    );

    vi.restoreAllMocks();
    answering({ org_1: [WEDDING] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(label('2026-11-28')).toBe('Saturday, November 28, 1 item'), WAIT);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
