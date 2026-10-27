import type { Membership } from '@soirely/api-client';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { api } from '../../api.ts';
import { __setSessionState } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const OKAFOR = membership({ id: 'org_2', name: 'Okafor Family' });

function signedInWith(organisations: Membership[]): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Folake Adeyemi',
      email: 'folake@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      needsOrganisation: false,
      hasPassword: true,
      organisation: IRE,
      organisations,
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

/** The organisations the API now answers with; anything else the pages ask for is empty. */
function nowIn(organisations: Membership[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ invitations: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  return vi.spyOn(api, 'organisationsWithPaused').mockResolvedValue({ organisations, paused: [] });
}

function at(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function sidebarLink(name: string): HTMLElement {
  const sidebar = document.querySelector<HTMLElement>('.shell-nav');

  if (sidebar == null) throw new Error('No sidebar');

  return within(sidebar).getByRole('link', { name });
}

function backToTheTab(): void {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('removed from their only organisation while signed in (sc-16229)', () => {
  it('on an account page, moves to the no-organisation header and the way back', async () => {
    signedInWith([IRE]);
    at('/app/account');
    nowIn([]);

    fireEvent.click(screen.getByRole('link', { name: 'Security' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Join or start an organisation/ })).toBeDefined(),
    );
    expect(screen.queryByRole('button', { name: /Organisation: Ìrè Events/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Events' })).toBeNull();
  });

  it('on a product page, opens You are not in an organisation at the next move', async () => {
    signedInWith([IRE]);
    at('/app/events');
    nowIn([]);

    fireEvent.click(sidebarLink('Guests'));

    expect(
      await screen.findByRole('heading', { name: 'You are not in an organisation' }),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('does the same on coming back to the tab, with no click', async () => {
    signedInWith([IRE]);
    at('/app/events');
    nowIn([]);

    backToTheTab();

    expect(
      await screen.findByRole('heading', { name: 'You are not in an organisation' }),
    ).toBeDefined();
  });
});

describe('removed from one of two organisations while signed in (sc-16229)', () => {
  it('opens the other at the next move, says so, and lists only it', async () => {
    signedInWith([IRE, OKAFOR]);
    at('/app/events');
    nowIn([OKAFOR]);

    fireEvent.click(sidebarLink('Guests'));

    expect((await screen.findByRole('status')).textContent).toMatch(
      /Now working in Okafor Family\./,
    );
    fireEvent.click(screen.getByRole('button', { name: /Organisation: Okafor Family/ }));
    const options = within(
      screen.getByRole('listbox', { name: 'Your organisations' }),
    ).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringMatching(/Okafor Family/),
    ]);
  });

  it('stays on an account page, in the other, on coming back to the tab', async () => {
    signedInWith([IRE, OKAFOR]);
    at('/app/account');
    nowIn([OKAFOR]);

    backToTheTab();

    expect((await screen.findByRole('status')).textContent).toMatch(
      /Now working in Okafor Family\./,
    );
    expect(sidebarLink('Your account').getAttribute('aria-current')).toBe('page');
  });
});

describe('still in their organisation (sc-16229)', () => {
  it('moves and comes back to the tab as before, with no notice', async () => {
    signedInWith([IRE, OKAFOR]);
    at('/app/events');
    const read = nowIn([IRE, OKAFOR]);

    fireEvent.click(sidebarLink('Guests'));
    backToTheTab();

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Now working in/)).toBeNull();
    expect(screen.getByRole('button', { name: /Organisation: Ìrè Events/ })).toBeDefined();
  });
});
