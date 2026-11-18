import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import type { Membership, Vendor, VendorsPage } from '@soirely/api-client';
import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const MEMBER = { id: 'role_4', seededAs: 'member', name: null };

function vendor(overrides: Partial<Vendor>): Vendor {
  return {
    id: 'v1',
    name: 'Bloom & Co',
    category: 'flowers',
    contactName: 'Ngozi Eze',
    emailAddress: 'ngozi@bloomandco.co.uk',
    phoneNumber: null,
    phoneCountryCode: null,
    website: null,
    address: null,
    note: null,
    archivedAt: null,
    ...overrides,
  };
}

const NONE = {
  catering: 0,
  venue: 0,
  flowers: 0,
  photography: 0,
  music: 0,
  transport: 0,
  staffing: 0,
  hire: 0,
  other: 0,
};

function pageOf(vendors: Vendor[], overrides: Partial<VendorsPage> = {}): VendorsPage {
  return {
    vendors,
    page: 1,
    total: vendors.length,
    inUse: vendors.filter((one) => one.archivedAt == null).length,
    archived: vendors.filter((one) => one.archivedAt != null).length,
    categories: { ...NONE, flowers: vendors.length },
    ...overrides,
  };
}

const BLOOM = vendor({});
const DELTA = vendor({
  id: 'v7',
  name: 'Delta Frames',
  category: 'photography',
  contactName: 'Tolu Ade',
  emailAddress: null,
  phoneNumber: '+442079460321',
  phoneCountryCode: 'GB',
});

function signedIn(organisation: Membership): void {
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
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: 'Europe/London',
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

type Sent = { method: string; path: string; search: string; body: unknown };

function answering(
  read: (search: string) => VendorsPage,
  write: (sent: Sent) => Response = (sent) =>
    new Response(JSON.stringify({ vendor: BLOOM }), { status: sent.method === 'POST' ? 201 : 200 }),
): Sent[] {
  const sent: Sent[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    const one = { method, path: url.pathname, search: url.search, body };
    sent.push(one);

    if (method === 'GET') return new Response(JSON.stringify(read(url.search)), { status: 200 });

    return write(one);
  });

  return sent;
}

function open() {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/settings/vendors'] })}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings › Vendors at a desk (sc-82)', () => {
  it('counts the directory on its card, then lists each vendor with its contact, category and reach', async () => {
    signedIn(membership());
    answering(() => pageOf([BLOOM, DELTA], { archived: 2 }));
    open();

    expect(await screen.findByText('2 vendors')).toBeDefined();
    expect(screen.getByText('2 in use')).toBeDefined();
    expect(screen.getByText('2 archived')).toBeDefined();
    expect(
      screen.getByText('The people Ìrè Events buys from, chosen on each event’s quotes.'),
    ).toBeDefined();
    const rows = within(screen.getByRole('list', { name: 'Vendors' }))
      .getAllByRole('button')
      .map((row) => row.textContent);
    expect(rows).toEqual([
      'Bloom & CoNgozi Eze · Flowers · ngozi@bloomandco.co.uk',
      'Delta FramesTolu Ade · Photography · +44 20 7946 0321',
    ]);
  });

  it('an empty directory says so, with the add action, and no search', async () => {
    signedIn(membership());
    answering(() => pageOf([]));
    open();

    expect(await screen.findByText('No vendors yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add a vendor' })).toBeDefined();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('a search that matches nothing says so and offers to clear it, not an empty directory', async () => {
    signedIn(membership());
    const sent = answering((search) =>
      search.includes('q=') ? pageOf([], { inUse: 2 }) : pageOf([BLOOM, DELTA]),
    );
    open();

    fireEvent.change(await screen.findByRole('searchbox', { name: 'Search vendors' }), {
      target: { value: 'eclat' },
    });

    expect(await screen.findByText('No vendor matches “eclat”.')).toBeDefined();
    expect(screen.queryByText('No vendors yet')).toBeNull();
    expect(sent.at(-1)?.search).toBe('?q=eclat');
    fireEvent.click(
      within(screen.getByText('No vendor matches “eclat”.').parentElement!).getByRole('button', {
        name: 'Clear the search',
      }),
    );
    expect(await screen.findByText('Bloom & Co')).toBeDefined();
  });

  it('a blank form is refused at Name and Category before anything is sent', async () => {
    signedIn(membership());
    const sent = answering(() => pageOf([BLOOM]));
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Add a vendor' }));
    const form = within(await screen.findByRole('dialog'));
    fireEvent.click(form.getByRole('button', { name: 'Add' }));

    expect(form.getByText('2 fields need fixing, so nothing was sent.')).toBeDefined();
    expect(form.getByText("Enter the vendor's name.")).toBeDefined();
    expect(form.getByText('Choose the category.')).toBeDefined();
    expect(sent.filter(({ method }) => method !== 'GET')).toEqual([]);
  });

  it('the API’s refusal of a number is shown on the phone field', async () => {
    signedIn(membership());
    answering(
      () => pageOf([BLOOM]),
      () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Check the highlighted fields.',
            status: 422,
            violations: [
              {
                propertyPath: 'phoneNumber',
                message: 'That is not a phone number for United Kingdom. Check it and try again.',
                code: 'validation_failed',
              },
            ],
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    );
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Add a vendor' }));
    const form = within(await screen.findByRole('dialog'));
    fireEvent.change(form.getByLabelText('Name'), { target: { value: 'Harbour Boats' } });
    fireEvent.change(form.getByLabelText('Category'), { target: { value: 'transport' } });
    fireEvent.change(form.getByLabelText('Country'), { target: { value: 'GB' } });
    fireEvent.change(form.getByLabelText(/Phone number/), { target: { value: '000 000 0000' } });
    fireEvent.click(form.getByRole('button', { name: 'Add' }));

    expect(
      await form.findByText(
        'That is not a phone number for United Kingdom. Check it and try again.',
      ),
    ).toBeDefined();
  });

  it('archiving from Edit vendor says where it went', async () => {
    signedIn(membership());
    const sent = answering(() => pageOf([BLOOM]));
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bloom & Co/ }));
    const form = within(await screen.findByRole('dialog'));
    await act(async () => {
      fireEvent.click(form.getByRole('button', { name: 'Archive this vendor' }));
    });

    expect(await screen.findByText('Bloom & Co is archived. It is under Archived.')).toBeDefined();
    expect(
      sent.some(({ method, path }) => method === 'POST' && path.endsWith('/vendors/v1/archive')),
    ).toBe(true);
  });

  it('a member is shown the page for a page they lack permission for', async () => {
    signedIn(membership({ role: MEMBER, permissions: [] }));
    const sent = answering(() => pageOf([BLOOM]));
    open();

    await waitFor(() => expect(screen.getByText('You do not have access to this')).toBeDefined());
    expect(sent.filter(({ path }) => path.includes('/vendors'))).toEqual([]);
  });
});
