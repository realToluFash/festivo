import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      timezone: null,
      waitingFor: null,
    },
  });
}

function inOne(): void {
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
      timezone: null,
      waitingFor: null,
    },
  });
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(code: string, status: number, headers: Record<string, string> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status },
    status,
    headers,
  );
}

/** POST /api/orgs answers `created`; anything else the shell asks for on the way is empty. */
function creating(created: () => Response) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) =>
      init?.method === 'POST' && new URL(String(input)).pathname === '/api/orgs'
        ? created()
        : json({ invitations: [] }, 200),
    );
}

function openCreate(): void {
  at('/app');
  fireEvent.click(screen.getByRole('button', { name: /Organisation: Ìrè Events/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Create an organisation' }));
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
      timezone: null,
      verified: true,
      complete: true,
      needsOrganisation: false,
      hasPassword: true,
      twoFactorSetupPrompt: false,
      waitingFor: null,
      providers: [],
      emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
      phoneNumbers: [],
    });
    at('/app');

    expect(screen.getByRole('button', { name: /Organisation: Okafor Family/ })).toBeDefined();
  });

  it('opens for somebody in one organisation, so creating another can be reached', () => {
    inOne();
    at('/app');

    fireEvent.click(
      screen.getByRole('button', { name: /Organisation: Ìrè Events, your role Owner/ }),
    );

    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Create an organisation' })).toBeDefined();
  });
});

describe('creating an organisation', () => {
  it('shows the defaults it will use, with the primary email', () => {
    inOne();
    openCreate();

    const dialog = screen.getByRole('dialog', { name: 'Create an organisation' });

    expect(
      within(dialog).getByText(/contact address is your primary email, f@ire\.events\./),
    ).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Organisation name'));
  });

  it('checks the name before sending: blank, then over 100 characters after trimming', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));
    expect(screen.getByText("Enter the organisation's name.")).toBeDefined();

    fireEvent.change(screen.getByLabelText('Organisation name'), {
      target: { value: ` ${'é'.repeat(101)} ` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));
    expect(screen.getByText('That name is 101 characters. Use 100 or fewer.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Organisation name'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks for a country when this device named none', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Supper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));

    expect(screen.getByText('Choose a country.')).toBeDefined();
  });

  it('sends the name, country and device timezone, then works in the new one and says so', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    const created = membership({ id: 'org_9', name: 'Lagos Supper Club' });
    const fetch = creating(() => json({ organisation: created }, 201));
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), {
      target: { value: '  Lagos Supper Club ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));

    expect(await screen.findByText('Now working in Lagos Supper Club.')).toBeDefined();
    const [url, init] = fetch.mock.calls.find(([, sent]) => sent?.method === 'POST') ?? [];
    expect(new URL(String(url)).pathname).toBe('/api/orgs');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Lagos Supper Club',
      countryCode: 'NG',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Organisation: Lagos Supper Club, your role Owner/ }),
    ).toBeDefined();
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_9');
  });

  it('says when the limit lifts, from Retry-After, and keeps what was typed', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    creating(() => problem('too_many_attempts', 429, { 'Retry-After': '600' }));
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Six' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));

    const alert = await screen.findByText('Too many new organisations for now.');
    expect(alert.parentElement?.textContent).toMatch(/Try again at \d{2}:\d{2}\./);
    expect((screen.getByLabelText('Organisation name') as HTMLInputElement).value).toBe('Six');
  });

  it('says it did not work when the refusal names no field the dialog has', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    creating(() =>
      json(
        {
          type: 'https://soirely.com/errors/validation_failed',
          title: 'No.',
          status: 422,
          violations: [
            { propertyPath: 'contactAddress', message: 'Bad address.', code: 'validation_failed' },
          ],
        },
        422,
      ),
    );
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Supper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }));

    expect(
      await screen.findByText(
        'Creating the organisation did not work. Nothing was created. Try again in a moment.',
      ),
    ).toBeDefined();
  });

  it('cancels with nothing created', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    inOne();
    openCreate();

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1] as HTMLElement);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('an organisation at the domain of the address (sc-561)', () => {
  function offering() {
    const sent: { method: string; path: string }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const method = init?.method ?? 'GET';
      const path = new URL(String(input)).pathname;
      sent.push({ method, path });

      if (path === '/api/join-offers') {
        return new Response(
          JSON.stringify({
            domain: 'ire.events',
            offers: [{ id: 'org_3', name: 'Ìrè Events Kitchen' }],
            request: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (path === '/api/join-offers/org_3/ask') {
        return new Response(
          JSON.stringify({
            request: {
              organisation: { id: 'org_3', name: 'Ìrè Events Kitchen' },
              askedAt: '2026-10-19T10:00:00+00:00',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (path === '/api/join-offers/org_3/dismiss') return new Response(null, { status: 204 });

      return new Response(JSON.stringify({ invitations: [] }), { status: 200 });
    });

    return sent;
  }

  it('offers it in the switcher, and asks', async () => {
    offering();
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));

    expect(await screen.findByText('Ìrè Events Kitchen uses Soirely')).toBeDefined();
    expect(
      screen.getByText(
        'Your address is at ire.events, so you can ask to join. Somebody there approves you before you see anything.',
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));

    expect(
      await screen.findByText('we’ll email folake@ire.events when they answer.', { exact: false }),
    ).toBeDefined();
  });

  it('hides it for good on Not now', async () => {
    const sent = offering();
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('Ìrè Events Kitchen uses Soirely')).toBeNull();
    await waitFor(() =>
      expect(sent.some((request) => request.path === '/api/join-offers/org_3/dismiss')).toBe(true),
    );
  });
});
