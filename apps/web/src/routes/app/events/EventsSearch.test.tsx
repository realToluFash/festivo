import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { forgetEventsTab, serverClock } from '@soirely/domain';

import { __setSessionState } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

function event(overrides: Record<string, unknown>) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
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
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: OWNER_PERMISSIONS,
    milestones: [],
    ...overrides,
  };
}

const LUCIA = event({ id: 'ev_l', name: 'Lucía at 30', type: 'birthday' });
const GALA = event({
  id: 'ev_g',
  name: 'Gala at Casa Lucia',
  status: 'live',
  phase: 'live',
  madeLiveAt: '2026-10-01T09:00:00+00:00',
  hosts: ['Tunde Bakare'],
});
const SEND_OFF = event({
  id: 'ev_s',
  name: 'Lucia’s send-off',
  status: 'ended',
  phase: 'finished',
  madeLiveAt: '2020-10-01T09:00:00+00:00',
  startsAt: '2020-11-14T16:00:00+01:00',
  endsAt: '2020-11-15T02:00:00+01:00',
  concludedAt: '2020-11-15T01:00:00+00:00',
});
const OWAMBE = event({ id: 'ev_o', name: 'Owambe' });

function signedIn(): void {
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
      organisation: IRE,
      organisations: [IRE],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function folded(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The API, narrowing the list by `q` and `type` as it does; every request it was sent. */
function answering(): URL[] {
  const asked: URL[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));

    if (url.pathname === '/api/orgs/org_1/events/hosts')
      return json({ hosts: ['Funmi Adeyemi', 'Tunde Bakare'] });
    if (url.pathname !== '/api/orgs/org_1/events') return json({});

    asked.push(url);
    const q = folded(url.searchParams.get('q') ?? '');
    const types = url.searchParams.get('type')?.split(',') ?? [];
    const finished = url.searchParams.get('finished') === 'true';
    const events = (finished ? [SEND_OFF] : [LUCIA, GALA, OWAMBE]).filter(
      (one) =>
        folded(String(one.name)).includes(q) &&
        (types.length === 0 || types.includes(String(one.type))),
    );

    return json({ events, total: events.length });
  });

  return asked;
}

function routed(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

function text(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s/g, ' ');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetEventsTab();
});

describe('Searching and filtering Events (sc-30302)', () => {
  it('shows one set of results from the address, Upcoming, Drafts and Past each with its count, every row saying its phase', async () => {
    signedIn();
    const asked = answering();
    routed('/app/events?q=lucia');

    expect(await screen.findByText('3 events')).toBeDefined();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getAllByRole('region').map((group) => group.getAttribute('aria-label'))).toEqual([
      'Upcoming',
      'Drafts',
      'Past',
    ]);
    expect(text(screen.getByRole('region', { name: 'Drafts' }))).toContain('Lucía at 30');
    expect(text(screen.getByRole('region', { name: 'Drafts' }))).toContain('Draft');
    expect(text(screen.getByRole('region', { name: 'Past' }))).toContain('Finished');
    expect(screen.getByRole('searchbox', { name: 'Search events' })).toHaveProperty(
      'value',
      'lucia',
    );
    expect(screen.getByRole('search')).toBeDefined();
    expect(
      asked
        .filter((url) => url.searchParams.get('q') === 'lucia')
        .map((url) => url.searchParams.get('finished'))
        .sort(),
    ).toEqual(['false', 'true']);
  });

  it('searches once typing rests, without moving focus, and writes the search into the address', async () => {
    signedIn();
    answering();
    const router = routed('/app/events');
    const field = await screen.findByRole('searchbox', { name: 'Search events' });

    field.focus();
    fireEvent.change(field, { target: { value: 'owa' } });

    await waitFor(() => expect(router.state.location.search).toBe('?q=owa'));
    expect(await screen.findByText('1 event')).toBeDefined();
    expect(document.activeElement).toBe(field);
  });

  it('searches at once on Return, and Escape clears the field and brings the tabs back', async () => {
    signedIn();
    answering();
    const router = routed('/app/events');
    const field = await screen.findByRole('searchbox', { name: 'Search events' });

    fireEvent.change(field, { target: { value: 'gala' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(router.state.location.search).toBe('?q=gala');
    expect(await screen.findByText('1 event')).toBeDefined();

    fireEvent.keyDown(field, { key: 'Escape' });

    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('tablist')).toBeDefined();
    expect(field).toHaveProperty('value', '');
  });

  it('says what was searched and filtered when nothing matches, with Clear search and Clear filters', async () => {
    signedIn();
    answering();
    const router = routed('/app/events?q=garden%20party&type=wedding');

    expect(await screen.findByRole('heading', { name: 'No events match' })).toBeDefined();
    expect(screen.getByText('0 events')).toBeDefined();
    expect(
      screen.getByText('You searched for “garden party” and filtered by Wedding.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toBe('?q=garden+party');
    expect(await screen.findByText('You searched for “garden party”.')).toBeDefined();

    const none = screen.getByRole('heading', { name: 'No events match' }).parentElement!;
    fireEvent.click(within(none).getByRole('button', { name: 'Clear search' }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('tablist')).toBeDefined();
  });

  it('filters by a type from the one Filter menu, which then names it, and offers the organisation’s hosts', async () => {
    signedIn();
    answering();
    const router = routed('/app/events');

    fireEvent.click(await screen.findByRole('button', { name: 'Filter: All' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Type/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Birthday' }));

    expect(router.state.location.search).toBe('?type=birthday');
    expect(await screen.findByText('1 event')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter: Birthday' })).toBeDefined();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to Filter' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Hosted by/ }));

    expect(screen.getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual([
      'Funmi Adeyemi',
      'Tunde Bakare',
    ]);
  });

  it('asks the API for the days This month covers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
    serverClock.observe(new Date().toUTCString());
    onTestFinished(() => {
      vi.useRealTimers();
      serverClock.observe(new Date().toUTCString());
    });
    signedIn();
    const asked = answering();
    const router = routed('/app/events');

    fireEvent.click(await screen.findByRole('button', { name: 'Filter: All' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^When/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'This month' }));

    expect(router.state.location.search).toBe('?from=2026-11-01&to=2026-11-30');
    await waitFor(() =>
      expect(
        asked.some(
          (url) =>
            url.searchParams.get('from') === '2026-11-01' &&
            url.searchParams.get('to') === '2026-11-30',
        ),
      ).toBe(true),
    );
    expect(screen.getByRole('button', { name: 'Filter: This month' })).toBeDefined();
  });
});
