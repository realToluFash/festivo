import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake',
  verified: true,
  complete: true,
  hasPassword: true,
  twoFactorSetupPrompt: true,
  colourScheme: null,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
  providers: [],
};

const SIGNED_OUT = () =>
  json({ type: 'https://soirely.com/errors/unauthenticated', title: 'No.', status: 401 }, 401);

function answering(me: () => Response, rest = SIGNED_OUT) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/auth/me') return me();
    if (path === '/api/orgs') return json({ organisations: [] });

    return rest();
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function reloaded() {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/two-factor/again'] })}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Set up two-factor again, reloaded (sc-29956)', () => {
  it('shows the page when signed in', async () => {
    answering(() => json(ACCOUNT));
    reloaded();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up two-factor again' }),
    ).toBeDefined();
  });

  it('goes to sign-in when signed out', async () => {
    answering(SIGNED_OUT);
    reloaded();

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
  });

  it('says Soirely cannot be reached, and Try again shows the page once it can', async () => {
    let reachable = false;
    answering(() => {
      if (!reachable) throw new TypeError('Failed to fetch');
      return json(ACCOUNT);
    });
    reloaded();

    expect(await screen.findByText('Cannot reach Soirely')).toBeDefined();

    reachable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up two-factor again' }),
    ).toBeDefined();
  });
});
