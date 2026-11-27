import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session, useSession } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const OKAFOR = membership({ id: 'org_2', name: 'Okafor Family' });

function signedIn(organisations = [IRE, OKAFOR]): void {
  const session: Session = {
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
    organisations,
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function WorkingIn() {
  return <output data-testid="working-in">{useSession().organisation?.id}</output>;
}

function workingIn(): string | null {
  return screen.getByTestId('working-in').textContent;
}

function open(at: string) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );
  const router = createMemoryRouter(routes, { initialEntries: [at] });

  render(
    <>
      <WorkingIn />
      <RouterProvider router={router} />
    </>,
  );

  return router;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a link naming the organisation it opens in (sc-3931)', () => {
  it('switches to it, says so, and keeps the rest of the address without the name', async () => {
    signedIn();
    const router = open('/app/settings?organisation=org_2#usage-this-period');

    await waitFor(() => expect(workingIn()).toBe('org_2'));
    expect(await screen.findByText('Now working in Okafor Family.')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/app/settings');
    expect(router.state.location.search).toBe('');
    expect(router.state.location.hash).toBe('#usage-this-period');
  });

  it('stays where it is, with no notice, when it names the organisation already current', async () => {
    signedIn();
    const router = open('/app/settings?organisation=org_1');

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(workingIn()).toBe('org_1');
    expect(screen.queryByText(/Now working in/)).toBeNull();
  });

  it('moves nothing for an organisation the account is not in', async () => {
    signedIn([IRE]);
    const router = open('/app/settings?organisation=org_2');

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(workingIn()).toBe('org_1');
    expect(screen.queryByText(/Now working in/)).toBeNull();
  });
});
