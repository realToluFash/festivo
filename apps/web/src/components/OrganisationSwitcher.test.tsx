import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, adoptAccount } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { routes } from '../routes/index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const OKAFOR = membership({
  id: 'org_2',
  name: 'Okafor Family',
  role: { id: 'role_2', seededAs: 'coordinator', name: null },
});

function inTwo(): void {
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
      organisations: [IRE, OKAFOR],
      organisationCountry: null,
    },
  });
}

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  __setSessionState({ status: 'unknown' });
});

describe('switching organisation', () => {
  it("lists each organisation with the caller's role, and marks the current one with a word", () => {
    inTwo();
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));

    const list = screen.getByRole('listbox', { name: 'Your organisations' });
    const [ire, okafor] = within(list).getAllByRole('option');

    expect(ire?.getAttribute('aria-selected')).toBe('true');
    expect(ire?.textContent).toMatch(/Your role · Owner.*Current/);
    expect(okafor?.textContent).toMatch(/Okafor Family.*Your role · Coordinator/);
    expect(screen.getByText('Soirely remembers your choice on this device.')).toBeDefined();
  });

  it('switches, says so, and remembers the choice on this device', () => {
    inTwo();
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));
    fireEvent.click(screen.getByRole('option', { name: /Okafor Family/ }));

    expect(screen.getByRole('status').textContent).toMatch(/Now working in Okafor Family\./);
    expect(
      screen.getByRole('button', { name: /Organisation: Okafor Family, your role Coordinator/ }),
    ).toBeDefined();
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_2');
  });

  it('opens on the organisation this device chose last time', async () => {
    window.localStorage.setItem('soirely.organisation', 'org_2');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ organisations: [IRE, OKAFOR] }), { status: 200 }),
    );

    await adoptAccount({
      id: 'acc_1',
      name: 'Folake Adeyemi',
      businessName: null,
      countryCode: null,
      organisationCountry: null,
      locale: 'en',
      verified: true,
      complete: true,
      needsOrganisation: false,
      hasPassword: true,
      providers: [],
      emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
      phoneNumbers: [],
    });
    at('/app');

    expect(screen.getByRole('button', { name: /Organisation: Okafor Family/ })).toBeDefined();
  });

  it('is a plain tile, not a menu, for somebody in one organisation', () => {
    __setSessionState({
      status: 'signedIn',
      session: {
        name: 'Folake',
        email: 'f@ire.events',
        verified: true,
        complete: true,
        awaiting: null,
        providers: [],
        needsOrganisation: false,
        hasPassword: true,
        organisation: IRE,
        organisations: [IRE],
        organisationCountry: null,
      },
    });
    at('/app');

    expect(screen.queryByRole('button', { name: /Switch organisation/ })).toBeNull();
    expect(screen.getByLabelText('Organisation: Ìrè Events, your role Owner')).toBeDefined();
  });
});
