import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { routes } from '../routes/index.tsx';

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  waitingFor: null,
  verified: true,
  complete: true,
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function open() {
  __setSessionState({ status: 'unreachable', retrying: false });

  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app'] })} />,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Cannot reach Soirely, Try again (sc-11369)', () => {
  it('lands on the heading of the page that shows once Soirely answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/auth/me') return json(ACCOUNT);
      if (path === '/api/orgs') return json({ organisations: [membership()] });
      return json({ invitations: [] });
    });
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('lands on "Cannot reach Soirely" and the words under it when it fails again', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    open();

    expect(screen.getByRole('status')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const notice = screen.getByRole('heading', { name: 'Cannot reach Soirely' }).parentElement;
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(notice?.textContent).toMatch(/You are still signed in/);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
