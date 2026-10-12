import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from './index.tsx';

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
  it('renders the shell with navigation and the organisation', () => {
    at('/app');

    expect(screen.getByLabelText('Switch organisation')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Events' })).toBeDefined();
    expect(screen.getByText('Signed in as Ada Okonkwo')).toBeDefined();
  });

  /**
   * A real page, not a redirect and not a blank area. A redirect on a shared
   * link produces a loop nobody can read; a blank area looks like a failed
   * load.
   */
  it('shows a real page for a route the account lacks permission for', () => {
    at('/app/settings');

    expect(screen.getByRole('heading', { name: 'You do not have access to this' })).toBeDefined();
    // And the navigation survives, because the way out of a refused page is
    // the navigation.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined();
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
          element: routes[2]!.element,
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
