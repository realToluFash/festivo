import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { forgetEventsTab } from '@soirely/domain';

import { __setSessionState } from '../session.ts';
import { membership } from '../test-memberships.ts';
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
    milestones: [],
  };
}

type Soirely = 'answers' | 'unreachable' | 'broken';

/** Events' two requests, answered with whatever the event is called by then, or not answered at all. */
function serving(state: { soirely: Soirely; name: string }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));

    if (state.soirely === 'unreachable') throw new TypeError('Failed to fetch');
    if (state.soirely === 'broken') return new Response('{}', { status: 503 });
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
});
