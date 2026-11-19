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
  const router = createMemoryRouter(routes, { initialEntries: ['/app/settings/vendors'] });
  render(<RouterProvider router={router} />);
  return router;
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

  it('an archived row reads its short date, and restoring the last one stays on Archived with its own line', async () => {
    signedIn(membership());
    const gone = vendor({
      id: 'v9',
      name: 'Éclat Catering',
      archivedAt: '2026-10-12T12:00:00+00:00',
    });
    let restored = false;
    answering(
      (search) =>
        !search.includes('view=archived')
          ? pageOf([BLOOM, DELTA], { archived: restored ? 0 : 1 })
          : restored
            ? pageOf([], { inUse: 2, archived: 0 })
            : pageOf([gone], { inUse: 2 }),
      () => {
        restored = true;
        return new Response(JSON.stringify({ vendor: { ...gone, archivedAt: null } }), {
          status: 200,
        });
      },
    );
    open();

    fireEvent.click(await screen.findByRole('button', { name: /In use/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Archived/ }));
    const line = await screen.findByText(/· Archived /);
    expect(line.textContent).toMatch(/Mon/);
    expect(line.textContent).not.toMatch(/Monday/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    });

    expect(await screen.findByText('No archived vendors.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clear the search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show every category' })).toBeNull();
    expect(screen.getByRole('button', { name: /Archived/ })).toBeDefined();
  });

  it('a search the API does not answer shows the failed state, not the list it had', async () => {
    signedIn(membership());
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).search.includes('q=')
        ? Promise.reject(new TypeError('Failed to fetch'))
        : new Response(JSON.stringify(pageOf([BLOOM, DELTA])), { status: 200 }),
    );
    open();

    fireEvent.change(await screen.findByRole('searchbox', { name: 'Search vendors' }), {
      target: { value: 'tulip' },
    });

    expect(await screen.findByText('We could not load the vendors.')).toBeDefined();
    expect(screen.queryByText('Bloom & Co')).toBeNull();
  });

  it('trying a failed search again puts the person back in the search box', async () => {
    signedIn(membership());
    let reachable = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).search.includes('q=') && !reachable
        ? Promise.reject(new TypeError('Failed to fetch'))
        : new Response(JSON.stringify(pageOf([BLOOM, DELTA])), { status: 200 }),
    );
    open();

    fireEvent.change(await screen.findByRole('searchbox', { name: 'Search vendors' }), {
      target: { value: 'tulip' },
    });
    const again = await screen.findByRole('button', { name: 'Try again' });
    reachable = true;
    fireEvent.click(again);

    const box = await screen.findByRole('searchbox', { name: 'Search vendors' });
    await waitFor(() => expect(document.activeElement).toBe(box));
    expect((box as HTMLInputElement).value).toBe('tulip');
  });

  it('a search typed while the API is unreachable keeps every letter for Try again', async () => {
    signedIn(membership());
    let reachable = true;
    const searched: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const q = new URL(String(input)).searchParams.get('q');
      if (q != null) searched.push(q);
      return reachable
        ? new Response(JSON.stringify(pageOf([BLOOM, DELTA])), { status: 200 })
        : Promise.reject(new TypeError('Failed to fetch'));
    });
    open();

    const box = await screen.findByRole('searchbox', { name: 'Search vendors' });
    reachable = false;
    for (const typed of ['t', 'tu', 'tul', 'tuli', 'tulip']) {
      fireEvent.change(box, { target: { value: typed } });
    }
    const again = await screen.findByRole('button', { name: 'Try again' });
    expect(searched).toEqual(['tulip']);

    reachable = true;
    fireEvent.click(again);

    const back = await screen.findByRole('searchbox', { name: 'Search vendors' });
    expect((back as HTMLInputElement).value).toBe('tulip');
    expect(searched).toEqual(['tulip', 'tulip']);
  });

  it('an older list answer arriving after a newer one is dropped, and its request stopped', async () => {
    signedIn(membership());
    let photography: ((answer: Response) => void) | null = null;
    let photographySignal: AbortSignal | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const category = new URL(String(input)).searchParams.get('category');
      if (category === 'photography') {
        photographySignal = init?.signal ?? null;
        return new Promise<Response>((resolve) => {
          photography = resolve;
        });
      }
      const shown = category === 'flowers' ? [BLOOM] : [BLOOM, DELTA];
      return new Response(JSON.stringify(pageOf(shown)), { status: 200 });
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /All categories/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Photography/ }));
    await waitFor(() => expect(photography).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Photography/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Flowers/ }));
    await waitFor(() => expect(screen.queryByText('Delta Frames')).toBeNull());

    await act(async () => {
      photography?.(new Response(JSON.stringify(pageOf([DELTA])), { status: 200 }));
    });

    expect(screen.getByText('Bloom & Co')).toBeDefined();
    expect(screen.queryByText('Delta Frames')).toBeNull();
    expect((photographySignal as AbortSignal | null)?.aborted).toBe(true);
  });

  it('saving a vendor archived elsewhere shows the API’s words and keeps the form', async () => {
    signedIn(membership());
    const words =
      'This vendor is archived, so your changes were not saved. To edit it, restore it under Archived.';
    answering(
      () => pageOf([BLOOM]),
      () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: words,
          }),
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    );
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bloom & Co/ }));
    const form = within(await screen.findByRole('dialog'));
    fireEvent.change(form.getByLabelText('Name'), { target: { value: 'Bloom and Co' } });
    fireEvent.click(form.getByRole('button', { name: 'Save' }));

    expect(await form.findByText(words)).toBeDefined();
    expect(form.queryByText('Check your connection and try again.')).toBeNull();
    expect((form.getByLabelText('Name') as HTMLInputElement).value).toBe('Bloom and Co');
  });

  it('a member is shown the page for a page they lack permission for', async () => {
    signedIn(membership({ role: MEMBER, permissions: [] }));
    const sent = answering(() => pageOf([BLOOM]));
    const router = open();

    await waitFor(() => expect(screen.getByText('You do not have access to this')).toBeDefined());
    expect(
      screen.getByText(
        'Your account does not have permission for this page. If you believe it should, ask an admin of this organisation.',
      ),
    ).toBeDefined();
    expect(sent.filter(({ path }) => path.includes('/vendors'))).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Back to the dashboard' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });
});
