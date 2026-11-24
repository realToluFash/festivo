import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, type RouteObject, createMemoryRouter } from 'react-router';

import { placesItsNotices } from '../../deskTop.ts';
import { __setSessionState } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

const HELD = membership({ withheldUntilTwoFactor: ['members.manage'] });
const IRE = membership();
const LINKED = 'Google is now linked to your account. You can sign in with either.';

function paths(tree: RouteObject[], base: string): string[] {
  return tree.flatMap((route) => {
    const path =
      route.path == null ? base : route.path.startsWith('/') ? route.path : `${base}/${route.path}`;
    const own = route.index === true || route.path != null ? [path] : [];

    return [...own, ...paths(route.children ?? [], path)];
  });
}

const placing = paths(routes, '').filter(
  (path) => !path.includes(':') && !path.includes('*') && placesItsNotices(path),
);

function signedIn(organisation = HELD): void {
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
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
}

function at(path: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('every page that places its own notices at a desk (sc-39471, #88228)', () => {
  it('is found by walking the routes', () => {
    expect(placing).toContain('/app/settings/vendors/payment-reminders');
    expect(placing).toContain('/app/calendar');
    expect(placing).toContain('/app/menu-library');
  });

  it.each(placing)('%s shows the sign-in rules’ notice once', async (path) => {
    signedIn();
    at(path);

    await screen.findAllByText('Two-factor required by Ìrè Events');
    expect(screen.getAllByText('Two-factor required by Ìrè Events')).toHaveLength(1);
  });

  it.each(placing)('%s shows "Google linked" once', async (path) => {
    sessionStorage.setItem('soirely.provider.linked', 'Google');
    signedIn(IRE);
    at(path);

    await screen.findAllByText(LINKED);
    expect(screen.getAllByText(LINKED)).toHaveLength(1);
  });
});

describe('"Google linked" on Settings at a desk (sc-39471, #88228)', () => {
  it('stands in the page’s column above its title, not across the Settings card', async () => {
    sessionStorage.setItem('soirely.provider.linked', 'Google');
    signedIn(IRE);
    at('/app/settings/vendors/payment-reminders');

    const notice = (await screen.findByText(LINKED)).closest('.notice');

    expect(notice?.closest('.settings-desk-page')).not.toBeNull();
  });
});

describe('the sign-in rules’ notices on the Menu library at a desk (sc-39471, #88656)', () => {
  it('stand in the page’s own column, above its title', async () => {
    signedIn();
    at('/app/menu-library');

    const notice = (await screen.findByText('Two-factor required by Ìrè Events')).closest(
      '.rn-box',
    );

    expect(notice?.closest('.desk.lib-page')).not.toBeNull();
  });
});

describe('"Not now" on the two-factor gate (sc-39471, #88316)', () => {
  it('stays pressed when the person moves from Events to the Calendar', async () => {
    signedIn();
    const router = at('/app/events');

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('Two-factor required by Ìrè Events')).toBeNull();

    await act(() => router.navigate('/app/calendar'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/calendar'));
    expect(screen.queryByText('Two-factor required by Ìrè Events')).toBeNull();
  });
});
