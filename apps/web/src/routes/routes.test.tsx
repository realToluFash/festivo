import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../session.ts';
import { routes } from './index.tsx';
import { membership } from '../test-memberships.ts';

const MEMBERSHIP = membership({ id: 'org_1', name: 'Okonkwo Events' });

const ADA: Session = {
  name: 'Ada Okonkwo',
  email: 'ada@example.com',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  organisationCountry: null,
  timezone: null,
  waitingFor: null,
};

/**
 * The shell, through the router, at the addresses people actually open.
 *
 * Rendered through the real route tree rather than by mounting components
 * directly: the thing being tested is that an address resolves to a page, and
 * mounting the component proves only that the component renders.
 */
function at(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the public tree', () => {
  it('serves the start page with no account', () => {
    at('/');

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  /** Somebody who cannot read the marketing copy cannot sign up. */
  it('offers the language switcher on a public page', () => {
    at('/');

    expect(screen.getByLabelText('Language')).toBeDefined();
  });

  it('renders a real page for an address that does not exist', () => {
    at('/no-such-page');

    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeDefined();
  });
});

describe('the application tree', () => {
  beforeEach(() => {
    __setSessionState({ status: 'signedIn', session: ADA });
  });

  it('renders the shell with navigation and the organisation', () => {
    at('/app');

    expect(
      screen.getByRole('button', { name: /Organisation: Okonkwo Events, your role Owner/ }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Events' })).toBeDefined();
    expect(screen.getByText('Signed in as Ada Okonkwo')).toBeDefined();
  });

  it('shows an account in no organisation where it stands, and keeps the navigation', () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...ADA, organisation: null, organisations: [] },
    });

    at('/app/settings');

    expect(screen.getByRole('heading', { name: 'You are not in an organisation' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined();
  });

  it('sends somebody with no session to sign in, saying nothing about being signed out', async () => {
    __setSessionState({ status: 'signedOut', ended: false });

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sends a sign-up still waiting on its code back to the code, not to sign in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    sessionStorage.setItem(
      'soirely.registration',
      JSON.stringify({ registration: 'the-handle', email: 'ada@example.com' }),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cooldownSeconds: 0, codeState: 'live' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeDefined(),
    );
    sessionStorage.clear();
  });

  it('clears a sign-up that has run out, and opens on sign in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    sessionStorage.setItem(
      'soirely.registration',
      JSON.stringify({ registration: 'spent', email: 'ada@example.com' }),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://soirely.com/errors/registration_expired',
          title: 'Gone',
          status: 410,
        }),
        { status: 410, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(sessionStorage.getItem('soirely.registration')).toBeNull();
  });

  it('says they were signed out when a session was lost on the way', async () => {
    __setSessionState({ status: 'signedOut', ended: true });

    at('/app');

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/signed out/i));
  });

  it('keeps the session when a reload cannot reach the API, and comes back with it', async () => {
    __setSessionState({ status: 'unknown' });
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Cannot reach Soirely' })).toBeDefined(),
    );
    expect(screen.getByRole('status').textContent).toMatch(/You are still signed in/);
    expect(screen.queryByRole('heading', { level: 1, name: 'Sign in' })).toBeNull();
    expect(screen.queryByLabelText('Email')).toBeNull();

    let answer: (response: Response) => void = () => {};
    const account = new Promise<Response>((resolve) => (answer = resolve));
    fetch.mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/orgs'
        ? new Response(JSON.stringify({ organisations: [MEMBERSHIP] }), { status: 200 })
        : account,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const trying = await screen.findByRole('button', { name: 'Trying again…' });
    expect(trying.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Cannot reach Soirely' })).toBeDefined();

    answer(
      new Response(
        JSON.stringify({
          id: 'acc_1',
          name: 'Ada Okonkwo',
          businessName: 'Okonkwo Events',
          countryCode: 'NG',
          organisationCountry: null,
          locale: 'en',
          timezone: null,
          waitingFor: null,
          verified: true,
          complete: true,
          needsOrganisation: false,
          hasPassword: true,
          emailAddresses: [{ id: 'a1', address: 'ada@example.com', verified: true, primary: true }],
          phoneNumbers: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await waitFor(() => expect(screen.getByText('Signed in as Ada Okonkwo')).toBeDefined());
  });

  it('waits rather than redirecting while the session is being checked', async () => {
    __setSessionState({ status: 'unknown' });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    at('/app');

    await waitFor(() => expect(screen.getByText('Loading…')).toBeDefined());
    expect(screen.queryByRole('heading', { level: 1, name: 'Sign in' })).toBeNull();
  });

  it('keeps the shell usable when a screen throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Boom = () => {
      throw new Error('a screen failed');
    };

    const router = createMemoryRouter(
      [
        {
          path: '/app',
          element: routes.find((route) => route.path === '/app')!.element,
          children: [{ index: true, element: <Boom /> }],
        },
      ],
      { initialEntries: ['/app'] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Guests' })).toBeDefined();
  });
});

describe('the guest tree', () => {
  it('serves an invitation with no account and no application navigation', () => {
    at('/i/abcdefghijklmnop1234');

    expect(screen.getByRole('heading', { name: 'You are invited' })).toBeDefined();
    expect(screen.queryByLabelText('Switch organisation')).toBeNull();
  });

  /**
   * The person reading this has no account, did not choose the link and cannot
   * debug anything. A blank screen is the worst possible answer.
   */
  it('renders a real page for a malformed token', () => {
    at('/i/nope');

    expect(
      screen.getByRole('heading', { name: 'This invitation link does not work' }),
    ).toBeDefined();
  });

  it('tells them what to do about it', () => {
    at('/i/nope');

    expect(screen.getByRole('alert').textContent).toMatch(/fresh link/);
  });
});

describe('the status page', () => {
  it('renders what the API answered, read through the shared client', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', checks: { postgres: { status: 'ok' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    at('/status');

    await waitFor(() => expect(screen.getByText('All services are responding.')).toBeDefined());
    expect(screen.getByText('postgres')).toBeDefined();
  });

  /** The base URL came from runtime configuration, so the request proves it. */
  it('calls the configured base URL rather than a relative path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', checks: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    at('/status');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('http://api.test/api/health');
  });

  it('shows a degraded API as degraded rather than as unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'degraded',
          checks: { postgres: { status: 'ok' }, redis: { status: 'error' } },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    at('/status');

    await waitFor(() =>
      expect(screen.getByText('Some services are not responding.')).toBeDefined(),
    );
    expect(screen.getByText('redis')).toBeDefined();
    expect(screen.queryByText('The API could not be reached.')).toBeNull();
  });

  it('says so when the API cannot be reached, and offers a retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    at('/status');

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('The API could not be reached.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  /** A host and a port are internal detail on a page anybody can open. */
  it('does not leak the thrown message onto the page', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.7:8080'),
    );

    at('/status');

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(document.body.textContent).not.toMatch(/10\.0\.0\.7/);
  });
});
