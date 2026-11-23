import type { Membership } from '@soirely/api-client';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { PHONE_WIDTH } from '../../../phoneWidth.ts';
import { __setSessionState } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { handoffPage } from './handoff.ts';

const NAME = 'Adaeze & Tunde’s wedding';

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

function event(id: string, rest: Record<string, unknown> = {}) {
  return {
    id,
    organisationId: 'org_1',
    name: NAME,
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
    arrivalNote: null,
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

/** The events by id; a missing one answers 404, and every other request waits. */
function serving(events: Record<string, object>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const id = /^\/api\/events\/([^/]+)$/u.exec(new URL(String(input)).pathname)?.[1];

    if (id == null) return new Promise<Response>(() => {});

    const found = events[decodeURIComponent(id)];

    return found == null
      ? new Response(JSON.stringify({ error: { code: 'not_found' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      : new Response(JSON.stringify({ event: found }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: '"1"' },
        });
  });
}

let phone = true;
const widthChanged: (() => void)[] = [];

function resize(toPhone: boolean): void {
  phone = toPhone;
  act(() => widthChanged.forEach((listener) => listener()));
}

beforeEach(() => {
  phone = true;
  widthChanged.length = 0;
  window.sessionStorage.clear();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          return query === PHONE_WIDTH ? phone : false;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => widthChanged.push(listener),
        removeEventListener() {},
      }) as never,
  );
  signedIn(membership({ id: 'org_1' }));
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

const anyway = () => screen.getByRole('button', { name: 'Show this page anyway' });

describe('an event’s page at a phone’s width hands over to the app (sc-55397)', () => {
  it('names the event and the area, takes focus on its heading, and has one action', async () => {
    serving({ ev_1: event('ev_1') });
    open('/app/events/ev_1/seating');

    const heading = await screen.findByRole('heading', { level: 1, name: NAME });

    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(heading.id).toBe('content');
    expect(document.querySelectorAll('#content')).toHaveLength(1);
    expect(screen.getByText('Seating', { selector: '.ho-area' })).toBeTruthy();
    expect(
      screen.getByText(
        'This page is made for a wider window. On a phone or a tablet, it is in the Soirely app.',
      ),
    ).toBeTruthy();
    expect(within(screen.getByRole('main')).getAllByRole('button')).toEqual([anyway()]);
    expect(within(screen.getByRole('main')).queryAllByRole('link')).toEqual([]);
  });

  it.each([
    ['/app/events/ev_1', 'Overview'],
    ['/app/events/ev_1/dates', 'Overview'],
    ['/app/events/ev_1/edit', 'Overview'],
    ['/app/events/ev_1/guests', 'Guests'],
    ['/app/events/ev_1/staff/roster', 'Staff'],
    ['/app/events/ev_1/people', 'People'],
    ['/app/events/ev_1/budget', 'Budget'],
  ])('%s says it is %s', async (path, area) => {
    serving({ ev_1: event('ev_1') });
    open(path);

    await screen.findByRole('heading', { level: 1, name: NAME });

    expect(document.querySelector('.ho-area')?.textContent).toBe(area);
  });

  it('on the run page names no area, and Menu lists the event’s areas with none lit', async () => {
    serving({ ev_1: event('ev_1') });
    open('/app/events/ev_1/run');

    await screen.findByRole('heading', { level: 1, name: NAME });
    expect(document.querySelector('.ho-area')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });

    expect(within(menu).getByRole('link', { name: 'Seating' }).getAttribute('href')).toBe(
      '/app/events/ev_1/seating',
    );
    expect(menu.querySelector('[aria-current="page"]')).toBeNull();
  });

  it('on New event says New event, with no event', async () => {
    serving({});
    open('/app/events/new');

    expect(await screen.findByRole('heading', { level: 1, name: 'New event' })).toBeTruthy();
    expect(document.querySelector('.ho-area')).toBeNull();
  });

  it('Show this page anyway shows the page, and every page after it in the tab', async () => {
    serving({ ev_1: event('ev_1') });
    const router = open('/app/events/ev_1/reports');

    await screen.findByRole('heading', { level: 1, name: NAME });
    fireEvent.click(anyway());

    expect(await screen.findByText('Reports for this event are coming.')).toBeTruthy();
    expect(window.sessionStorage.getItem('soirely.showPageAnyway')).toBe('1');

    await act(() => router.navigate('/app/events/ev_1/messages'));
    expect(await screen.findByText('Messages for this event are coming.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show this page anyway' })).toBeNull();
  });

  it('a widened window replaces the handoff with the page', async () => {
    serving({ ev_1: event('ev_1') });
    open('/app/events/ev_1/reports');

    await screen.findByRole('heading', { level: 1, name: NAME });
    resize(false);

    expect(await screen.findByText('Reports for this event are coming.')).toBeTruthy();
    resize(true);
    expect(screen.getByText('Reports for this event are coming.')).toBeTruthy();
  });

  it('a page opened wide stays when narrowed, and the next one hands over', async () => {
    phone = false;
    serving({ ev_1: event('ev_1') });
    const router = open('/app/events/ev_1/reports');

    expect(await screen.findByText('Reports for this event are coming.')).toBeTruthy();
    resize(true);
    expect(screen.getByText('Reports for this event are coming.')).toBeTruthy();

    await act(() => router.navigate('/app/events/ev_1/messages'));
    expect(await screen.findByRole('heading', { level: 1, name: NAME })).toBeTruthy();
  });

  it('an event that is not there shows what it shows on main', async () => {
    serving({});
    open('/app/events/ev_gone/budget');

    expect(
      await screen.findByRole('heading', { name: 'This event is not available' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show this page anyway' })).toBeNull();
  });

  it('an area the person cannot open shows what it shows on main', async () => {
    serving({
      ev_1: event('ev_1', {
        permissions: OWNER_PERMISSIONS.filter((one) => one !== 'seating.read'),
      }),
    });
    open('/app/events/ev_1/seating');

    expect(await screen.findByRole('heading', { name: 'This page does not exist' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show this page anyway' })).toBeNull();
  });

  it('an event of another organisation never shows its name', async () => {
    serving({ ev_1: event('ev_1', { organisationId: 'org_2' }) });
    open('/app/events/ev_1/budget');

    expect(
      await screen.findByRole('heading', { name: 'This event is not available' }),
    ).toBeTruthy();
    expect(screen.queryByText(NAME)).toBeNull();
  });

  it('Events keeps its own layout at a phone’s width', async () => {
    serving({});
    open('/app/events');

    await screen.findByRole('heading', { level: 1, name: 'Events' });
    expect(screen.queryByRole('button', { name: 'Show this page anyway' })).toBeNull();
  });
});

describe('which pages hand over', () => {
  it.each([
    ['/app/events/new', { kind: 'new' }],
    ['/app/events/e1/run', { kind: 'event', eventId: 'e1', area: null, needs: 'run_of_show.read' }],
    ['/app/events/e1/staff', { kind: 'event', eventId: 'e1', area: 'staff', needs: 'staff.read' }],
    ['/app/events/e1/menu', { kind: 'event', eventId: 'e1', area: 'menu', needs: 'menu.read' }],
    [
      '/app/events/e1/budget',
      { kind: 'event', eventId: 'e1', area: 'budget', needs: 'budget.read' },
    ],
    ['/app/events/e1/reports', { kind: 'event', eventId: 'e1', area: 'reports', needs: null }],
    ['/app/events/e1/menu/kitchen', null],
    ['/app/events/e1/nothing', null],
    ['/app/events/e1/staff/nothing', null],
    ['/app/events', null],
    ['/app/calendar', null],
  ])('%s', (path, page) => {
    expect(handoffPage(path)).toEqual(page);
  });
});
