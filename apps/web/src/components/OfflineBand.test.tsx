import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { forgetEventsTab } from '@soirely/domain';

import { __setSessionState } from '../session.ts';
import { OWNER_PERMISSIONS, membership } from '../test-memberships.ts';
import { routes } from '../routes/index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

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

function draft(name: string) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
    name,
    type: 'wedding',
    status: 'draft',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    cover: null,
    venue: null,
    hosts: [],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: OWNER_PERMISSIONS,
    milestones: [],
  };
}

type Soirely = 'answers' | 'unreachable' | 'broken' | 'refresh503';

/** Events' two requests, answered with whatever the event is called by then, or not answered at all. */
function serving(state: { soirely: Soirely; name: string }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));

    if (state.soirely === 'unreachable') throw new TypeError('Failed to fetch');
    if (state.soirely === 'broken') return new Response('{}', { status: 503 });
    if (state.soirely === 'refresh503')
      return new Response('{}', { status: url.pathname === '/api/auth/refresh' ? 503 : 401 });
    if (url.pathname !== '/api/orgs/org_1/events') return new Response('{}', { status: 200 });

    const finished = url.searchParams.get('finished') === 'true';
    const events = finished ? [] : [draft(state.name)];

    return new Response(JSON.stringify({ events, total: events.length }), { status: 200 });
  });
}

function band(): HTMLElement | null {
  return document.querySelector('.offline-band');
}

function goOffline(): void {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

function comeBack(): void {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

async function onEvents(): Promise<void> {
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/events'] })} />,
  );
  fireEvent.click(await screen.findByRole('tab', { name: /^Drafts/ }));
  await screen.findByText('Adaeze and Tunde');
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  forgetEventsTab();
});

describe('the offline band (sc-22586)', () => {
  it('shows the minute Events last loaded once the browser goes offline, and keeps the list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 26, 20, 9, 30));
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    serving(state);
    await onEvents();

    state.soirely = 'unreachable';
    goOffline();

    await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 20:09'));
    expect(screen.getByText('Adaeze and Tunde')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    await waitFor(() =>
      expect(document.querySelector('.offline-band > [aria-live="polite"]')?.textContent).toBe(
        'Offline · as of 20:09',
      ),
    );
  });

  it('loads again when the network returns, goes once Soirely answers, and shows what changed meanwhile', async () => {
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    serving(state);
    await onEvents();

    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()).not.toBeNull());

    comeBack();
    await waitFor(() => expect(band()).not.toBeNull());

    goOffline();
    state.soirely = 'answers';
    state.name = 'Adaeze and Tunde, renamed';
    comeBack();

    await screen.findByText('Adaeze and Tunde, renamed');
    expect(band()).toBeNull();
  });

  it('shows when a refresh fails to reach Soirely, and Try again brings the screen back to its title', async () => {
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    serving(state);
    await onEvents();

    state.soirely = 'unreachable';
    comeBack();
    goOffline();
    await waitFor(() => expect(band()).not.toBeNull());

    state.soirely = 'answers';
    act(() => screen.getByRole('button', { name: 'Try again' }).click());

    await waitFor(() => expect(band()).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Events' })),
    );
  });

  it('joins a second press to the load already out, and gives that load up 20 s after the first press', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    const fetched = serving(state);
    await onEvents();

    goOffline();
    await waitFor(() => expect(band()).not.toBeNull());
    fetched.mockImplementation(() => new Promise<Response>(() => {}));
    const asked = fetched.mock.calls.length;
    const said = document.querySelector('.offline-band [aria-live]');

    act(() => screen.getByRole('button', { name: 'Try again' }).click());
    await screen.findByText('Refreshing…');
    const askedByFirstPress = fetched.mock.calls.length - asked;
    expect(askedByFirstPress).toBeGreaterThan(0);

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    act(() => screen.getByRole('button', { name: 'Try again' }).click());
    await act(() => vi.advanceTimersByTimeAsync(14_000));
    expect(fetched.mock.calls.length - asked).toBe(askedByFirstPress);
    expect(screen.getByText('Refreshing…')).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.queryByText('Refreshing…')).toBeNull();
    expect(band()).not.toBeNull();
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Events' }));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(said?.textContent).toMatch(/^Offline · as of /);
  });

  it('never shows for an answer, a 5xx included: the screen keeps its own words', async () => {
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    serving(state);
    await onEvents();

    state.soirely = 'broken';
    goOffline();
    await waitFor(() => expect(band()).not.toBeNull());
    comeBack();

    await screen.findByText('The events did not load. Try again in a moment.');
    expect(band()).toBeNull();
  });

  it('goes when the token refresh answers 503, and asks no more: that is an answer too', async () => {
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    const fetched = serving(state);
    await onEvents();

    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()).not.toBeNull());
    state.soirely = 'refresh503';
    fetched.mockClear();
    comeBack();

    await screen.findByText('The events did not load. Try again in a moment.');
    expect(band()).toBeNull();
    const refreshes = () =>
      fetched.mock.calls.filter(([input]) => String(input).endsWith('/api/auth/refresh')).length;
    const asked = refreshes();
    expect(asked).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(refreshes()).toBe(asked);
  });

  it('shows nothing on a screen that has loaded nothing', async () => {
    signedIn();
    serving({ soirely: 'unreachable', name: '' });
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/events'] })} />,
    );

    await screen.findByText('The events did not load. Try again in a moment.');
    goOffline();

    expect(band()).toBeNull();
  });

  it('names the day once midnight passes, without a press', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 26, 23, 58, 10));
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    serving(state);
    await onEvents();

    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 23:58'));

    await act(() => vi.advanceTimersByTimeAsync(3 * 60_000));

    expect(band()?.textContent).toContain('Offline · as of Monday, Oct 26 at 23:58');
  });

  it("shows on an event's page, with Refreshing… beside Back while it loads again", async () => {
    signedIn();
    let soirely: 'answers' | 'unreachable' | 'silent' = 'answers';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (soirely === 'unreachable') throw new TypeError('Failed to fetch');
      if (soirely === 'silent') return new Promise<Response>(() => {});
      if (url.pathname !== '/api/events/ev_1') return new Response('{}', { status: 200 });

      return new Response(JSON.stringify({ event: draft('Adaeze and Tunde') }), {
        status: 200,
        headers: { ETag: '"1"' },
      });
    });
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1'] })}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toMatch(/^Offline · as of /));

    soirely = 'silent';
    comeBack();

    await screen.findByText('Refreshing…');
    expect(band()).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
  });

  describe("beside the bell's own band (sc-27096)", () => {
    function servingWithFeed(state: { soirely: Soirely; name: string }) {
      const events = serving(state);
      const answer = events.getMockImplementation()!;
      events.mockImplementation(async (input, init) => {
        if (state.soirely !== 'answers' || new URL(String(input)).pathname !== '/api/notifications')
          return answer(input, init);

        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'n1',
                category: 'messages',
                title: 'Kemi replied',
                lines: [],
                eventId: null,
                eventName: null,
                eventAvailable: true,
                muted: false,
                place: null,
                read: false,
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
            next: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      return events;
    }

    const eventsBand = () => document.querySelector('.offline-band:not(.notifications-band)');
    const feedBand = () => document.querySelector('.notifications-band');
    const panel = () => document.querySelector<HTMLElement>('.notifications-panel')!;
    const asked = (fetched: ReturnType<typeof serving>, path: string) =>
      fetched.mock.calls.filter(([input]) => new URL(String(input)).pathname === path).length;

    async function bothOffline(state: { soirely: Soirely }): Promise<void> {
      state.soirely = 'unreachable';
      goOffline();
      await waitFor(() => expect(eventsBand()).not.toBeNull());
      await waitFor(() => expect(feedBand()?.textContent).toMatch(/^Offline · as of /));
    }

    it('each Try again reloads only its own load, and the other band stays', async () => {
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
      const fetched = servingWithFeed(state);
      await onEvents();
      fireEvent.click(screen.getByRole('button', { name: /^Notifications, 1 unread/ }));
      await within(panel()).findByText('Kemi replied');

      await bothOffline(state);
      state.soirely = 'answers';
      fetched.mockClear();
      act(() => within(panel()).getByRole('button', { name: 'Try again' }).click());

      await waitFor(() => expect(feedBand()?.textContent ?? '').toBe(''));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asked(fetched, '/api/notifications')).toBe(1);
      expect(asked(fetched, '/api/orgs/org_1/events')).toBe(0);
      expect(eventsBand()).not.toBeNull();

      await bothOffline(state);
      state.soirely = 'answers';
      fetched.mockClear();
      const eventsTryAgain = screen
        .getAllByRole('button', { name: 'Try again' })
        .find((button) => !panel().contains(button))!;
      act(() => eventsTryAgain.click());

      await waitFor(() => expect(eventsBand()).toBeNull());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asked(fetched, '/api/orgs/org_1/events')).toBeGreaterThan(0);
      expect(asked(fetched, '/api/notifications')).toBe(0);
      expect(feedBand()?.textContent).toMatch(/^Offline · as of /);
    });
  });
});

describe('the offline band on the planning screens (sc-27086)', () => {
  function servingEvents(state: { soirely: Soirely; name: string; finished?: number }) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (state.soirely === 'unreachable') throw new TypeError('Failed to fetch');
      if (url.pathname !== '/api/orgs/org_1/events') return new Response('{}', { status: 200 });

      const finished = url.searchParams.get('finished') === 'true';
      const events = finished
        ? Array.from({ length: state.finished ?? 0 }, (_, i) => ({
            ...draft(state.name),
            id: `ev_f${i}`,
          }))
        : [draft(state.name)];

      return new Response(JSON.stringify({ events, total: events.length }), { status: 200 });
    });
  }

  function open(path: string): void {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  }

  /** Try again pressed with Soirely still down: the press reaches fetch, and its rejection settles. */
  async function tryAgainUnanswered(fetched: { mock: { calls: unknown[] } }): Promise<void> {
    const asked = fetched.mock.calls.length;
    act(() => screen.getByRole('button', { name: 'Try again' }).click());
    await waitFor(() => expect(fetched.mock.calls.length).toBeGreaterThan(asked));
    await waitFor(() => expect(screen.queryByText('Refreshing…')).toBeNull());
  }

  it("shows the minute Calendar loaded, and Try again shows the event's new name and lands on Calendar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 41, 5));
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    servingEvents(state);
    open('/app/calendar');
    expect(await screen.findAllByText('Adaeze and Tunde')).not.toHaveLength(0);

    vi.setSystemTime(new Date(2026, 10, 10, 9, 47, 0));
    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:41'));
    expect(screen.getAllByText('Adaeze and Tunde')).not.toHaveLength(0);

    state.soirely = 'answers';
    state.name = 'Adaeze and Tunde, renamed';
    act(() => screen.getByRole('button', { name: 'Try again' }).click());

    expect(await screen.findAllByText('Adaeze and Tunde, renamed')).not.toHaveLength(0);
    expect(band()).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Calendar' })),
    );
  });

  it('keeps the calendar and the band, its time unchanged, when Try again does not reach Soirely', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 41, 5));
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    const fetched = servingEvents(state);
    open('/app/calendar');
    expect(await screen.findAllByText('Adaeze and Tunde')).not.toHaveLength(0);

    vi.setSystemTime(new Date(2026, 10, 10, 9, 47, 0));
    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:41'));

    vi.setSystemTime(new Date(2026, 10, 10, 9, 52, 0));
    await tryAgainUnanswered(fetched);

    expect(band()?.textContent).toContain('Offline · as of 09:41');
    expect(screen.getAllByText('Adaeze and Tunde')).not.toHaveLength(0);
  });

  it('shows no band on a Calendar that loaded nothing', async () => {
    signedIn();
    servingEvents({ soirely: 'unreachable', name: '' });
    open('/app/calendar');

    await screen.findByRole('button', { name: 'Try again' });
    goOffline();

    expect(band()).toBeNull();
  });

  it('shows on Today, keeps its events, and says Refreshing… under its banner while it loads again', async () => {
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    const fetched = servingEvents(state);
    open('/app');
    await screen.findByText('Adaeze and Tunde');

    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toMatch(/^Offline · as of /));
    expect(screen.getByText('Adaeze and Tunde')).toBeDefined();

    fetched.mockImplementation(() => new Promise<Response>(() => {}));
    act(() => screen.getByRole('button', { name: 'Try again' }).click());

    await screen.findByText('Refreshing…');
    expect(screen.getByText('Adaeze and Tunde')).toBeDefined();
  });

  it('shows the new events once Try again on Today is answered, and lands on its greeting', async () => {
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    servingEvents(state);
    open('/app');
    await screen.findByText('Adaeze and Tunde');

    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toMatch(/^Offline · as of /));

    state.soirely = 'answers';
    state.name = 'Adaeze and Tunde, renamed';
    act(() => screen.getByRole('button', { name: 'Try again' }).click());

    await screen.findByText('Adaeze and Tunde, renamed');
    expect(band()).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
  });

  it('keeps the events and the band, its time unchanged, when Try again on Today does not reach Soirely', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 41, 5));
    signedIn();
    const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde' };
    const fetched = servingEvents(state);
    open('/app');
    await screen.findByText('Adaeze and Tunde');

    vi.setSystemTime(new Date(2026, 10, 10, 9, 47, 0));
    state.soirely = 'unreachable';
    goOffline();
    await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:41'));

    vi.setSystemTime(new Date(2026, 10, 10, 9, 52, 0));
    await tryAgainUnanswered(fetched);

    expect(band()?.textContent).toContain('Offline · as of 09:41');
    expect(screen.getByText('Adaeze and Tunde')).toBeDefined();
  });

  describe('Edit details', () => {
    function servingEvent(state: { soirely: Soirely; name: string; tag: string }) {
      return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));

        if (state.soirely === 'unreachable') throw new TypeError('Failed to fetch');
        if (url.pathname !== '/api/events/ev_1') return new Response('{}', { status: 200 });
        if (init?.method === 'PATCH') {
          const sent = new Headers(init.headers).get('If-Match');

          return sent === state.tag
            ? new Response(JSON.stringify({ event: draft(state.name) }), {
                status: 200,
                headers: { ETag: state.tag },
              })
            : new Response('{}', { status: 412 });
        }

        return new Response(JSON.stringify({ event: draft(state.name) }), {
          status: 200,
          headers: { ETag: state.tag },
        });
      });
    }

    async function typeName(name: string): Promise<HTMLInputElement> {
      const field = await screen.findByLabelText<HTMLInputElement>('Event name');
      fireEvent.change(field, { target: { value: name } });

      return field;
    }

    it('keeps what was typed through the reload, and lands on Edit details', async () => {
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde', tag: '"1"' };
      servingEvent(state);
      open('/app/events/ev_1/edit');
      await typeName('Adaeze and Tunde at Eko');

      state.soirely = 'unreachable';
      goOffline();
      await waitFor(() => expect(band()?.textContent).toMatch(/^Offline · as of /));

      state.soirely = 'answers';
      act(() => screen.getByRole('button', { name: 'Try again' }).click());

      await waitFor(() => expect(band()).toBeNull());
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Edit details' })),
      );
      expect(screen.getByLabelText<HTMLInputElement>('Event name').value).toBe(
        'Adaeze and Tunde at Eko',
      );
    });

    it('keeps the form, what was typed and the band, its time unchanged, when Try again does not reach Soirely', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 10, 9, 41, 5));
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde', tag: '"1"' };
      const fetched = servingEvent(state);
      open('/app/events/ev_1/edit');
      await typeName('Adaeze and Tunde at Eko');

      vi.setSystemTime(new Date(2026, 10, 10, 9, 47, 0));
      state.soirely = 'unreachable';
      goOffline();
      await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:41'));

      vi.setSystemTime(new Date(2026, 10, 10, 9, 52, 0));
      await tryAgainUnanswered(fetched);

      expect(band()?.textContent).toContain('Offline · as of 09:41');
      expect(screen.getByLabelText<HTMLInputElement>('Event name').value).toBe(
        'Adaeze and Tunde at Eko',
      );
    });

    it('keeps the minute the form opened after a Try again that answers, as the form keeps its fields', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 5));
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde', tag: '"1"' };
      servingEvent(state);
      open('/app/events/ev_1/edit');
      await typeName('Adaeze and Tunde at Eko');

      vi.setSystemTime(new Date(2026, 10, 10, 9, 30, 0));
      state.soirely = 'unreachable';
      goOffline();
      await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:00'));

      vi.setSystemTime(new Date(2026, 10, 10, 9, 35, 0));
      state.soirely = 'answers';
      act(() => screen.getByRole('button', { name: 'Try again' }).click());
      await waitFor(() => expect(band()).toBeNull());

      vi.setSystemTime(new Date(2026, 10, 10, 9, 40, 0));
      state.soirely = 'unreachable';
      goOffline();

      await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:00'));
    });

    it('moves the time to the minute the form took Show the latest', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 5));
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde', tag: '"1"' };
      servingEvent(state);
      open('/app/events/ev_1/edit');
      await typeName('Adaeze and Tunde at Eko');

      state.name = 'Renamed by a co-host';
      state.tag = '"2"';
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await screen.findByText(/Somebody else changed this event since you opened it/);

      vi.setSystemTime(new Date(2026, 10, 10, 9, 20, 0));
      fireEvent.click(screen.getByRole('button', { name: 'Show the latest' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Show the latest version?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Show the latest' }));
      await waitFor(() =>
        expect(screen.getByLabelText<HTMLInputElement>('Event name').value).toBe(
          'Renamed by a co-host',
        ),
      );

      vi.setSystemTime(new Date(2026, 10, 10, 9, 30, 0));
      state.soirely = 'unreachable';
      goOffline();

      await waitFor(() => expect(band()?.textContent).toContain('Offline · as of 09:20'));
    });

    it('saves against the tag the form opened with, so a change made elsewhere meanwhile is still caught', async () => {
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde', tag: '"1"' };
      servingEvent(state);
      open('/app/events/ev_1/edit');
      await typeName('Adaeze and Tunde at Eko');

      state.soirely = 'unreachable';
      goOffline();
      await waitFor(() => expect(band()).not.toBeNull());

      state.soirely = 'answers';
      state.name = 'Renamed by a co-host';
      state.tag = '"2"';
      act(() => screen.getByRole('button', { name: 'Try again' }).click());
      await waitFor(() => expect(band()).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await screen.findByText(/Somebody else changed this event since you opened it/);
      expect(screen.getByLabelText<HTMLInputElement>('Event name').value).toBe(
        'Adaeze and Tunde at Eko',
      );
    });

    it('refuses a save pressed offline, keeps the name, and sends nothing on coming back', async () => {
      signedIn();
      const state = { soirely: 'answers' as Soirely, name: 'Adaeze and Tunde', tag: '"1"' };
      const fetched = servingEvent(state);
      open('/app/events/ev_1/edit');
      await typeName('Adaeze and Tunde at Eko');

      state.soirely = 'unreachable';
      goOffline();
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await screen.findByText('Not saved. Your changes are still here. Try again.');
      expect(screen.getByLabelText<HTMLInputElement>('Event name').value).toBe(
        'Adaeze and Tunde at Eko',
      );

      state.soirely = 'answers';
      comeBack();
      await waitFor(() => expect(band()).toBeNull());
      const patched = fetched.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patched).toHaveLength(1);
    });
  });
});
