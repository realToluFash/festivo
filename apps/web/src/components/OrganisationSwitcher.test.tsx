import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, adoptAccount } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { BREAKS_ANYWHERE } from '../test-wrapping.ts';
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

/** Presses Create organisation with focus on it, as a click or Enter on the button leaves it. */
function pressCreate(): void {
  const create = screen.getByRole('button', { name: 'Create organisation' });

  create.focus();
  fireEvent.click(create);
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

describe('switching away from a paused organisation (sc-564)', () => {
  it('opens the switcher with nothing marked current, then works in the one chosen', () => {
    const { id, name, countryCode, currency, timezone, contactAddress, locale } = membership({
      id: 'org_3',
      name: 'Lagos Weddings',
    });
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
        pausedIn: {
          id,
          name,
          countryCode,
          currency,
          timezone,
          contactAddress,
          locale,
          suspension: {
            reason: 'address_gone',
            domain: 'lagosweddings.ng',
            since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
            removesAt: null,
            onlyOwner: false,
          },
        },
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ invitations: [] }, 200));
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: 'Switch organisation' }));

    const options = within(
      screen.getByRole('listbox', { name: 'Your organisations' }),
    ).getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
    ]);

    fireEvent.click(screen.getByRole('option', { name: /Ìrè Events/ }));

    expect(screen.getByRole('status').textContent).toMatch(/Now working in Ìrè Events\./);
    expect(screen.queryByRole('button', { name: 'Switch organisation' })).toBeNull();
  });
});

describe('a 100-character name (sc-486)', () => {
  const SPACED = 'Adeyemi Okafor Events '.repeat(5).slice(0, 99).concat('X');
  const WORD = 'A'.repeat(100);
  const styles = readFileSync(join(import.meta.dirname, '../styles.css'), 'utf8');
  const rule = (selector: string): string =>
    new RegExp(`(?:^|\\n)\\s*${selector.replaceAll('.', '\\.')} \\{([^}]*)\\}`, 'u').exec(
      styles,
    )?.[1] ?? '';

  function inLong(name: string): void {
    const long = membership({ id: 'org_3', name });

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
        organisation: long,
        organisations: [long, OKAFOR],
        organisationCountry: null,
        timezone: null,
        waitingFor: null,
      },
    });
  }

  it.each([
    ['with spaces', SPACED],
    ['with none', WORD],
  ])('keeps the whole name, %s, as the accessible name and the hover title at 320px', (_, name) => {
    expect(name).toHaveLength(100);
    window.innerWidth = 320;
    inLong(name);
    at('/app');

    const trigger = screen.getByRole('button', { name: /Switch organisation/ });

    expect(trigger.getAttribute('aria-label')).toContain(name);
    fireEvent.click(trigger);

    const [current] = within(screen.getByRole('listbox')).getAllByRole('option');

    expect(current?.textContent).toContain(name);
    expect(screen.getAllByTitle(name)).toHaveLength(2);
  });

  it('cuts it to one line with an ellipsis in the trigger and every row', () => {
    expect(rule('.org-name,\n.org-role')).toMatch(/white-space: nowrap;/u);
    expect(rule('.org-name,\n.org-role')).toMatch(/text-overflow: ellipsis;/u);
    expect(rule('.org-naming')).toMatch(/min-width: 0;/u);
  });

  it('never lets the frame grow past the viewport, nor the open list', () => {
    expect(rule('.shell')).toMatch(/grid-template-columns: var\(--sizeRail\) minmax\(0, 1fr\);/u);
    expect(styles).toMatch(/\.shell \{\s*grid-template-columns: minmax\(0, 1fr\);/u);
    expect(rule('.org-switcher-menu')).toMatch(/max-width: calc\(100vw - /u);
  });

  it('breaks a long word in any paragraph, heading, list, definition, button, label or span, and in a notice', () => {
    expect(BREAKS_ANYWHERE.split(', ')).toEqual([
      'h1',
      'h2',
      'h3',
      'p',
      'dt',
      'dd',
      'li',
      'button',
      'label',
      'span',
    ]);
    expect(rule('.notice')).toMatch(/overflow-wrap: anywhere;/u);
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
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Organisation: Lagos Supper Club, your role Owner/ }),
    );
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_9');
  });

  it('says when the limit lifts, from Retry-After, and keeps what was typed', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    creating(() => problem('too_many_attempts', 429, { 'Retry-After': '600' }));
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Six' } });
    pressCreate();

    const alert = await screen.findByText('Too many new organisations for now.');
    expect(alert.parentElement?.textContent).toMatch(/Try again at \d{2}:\d{2}\./);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const name = screen.getByLabelText('Organisation name') as HTMLInputElement;
    expect(name.value).toBe('Six');
    await waitFor(() => expect(document.activeElement).toBe(name));
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
    pressCreate();

    expect(
      await screen.findByText(
        'Creating the organisation did not work. Nothing was created. Try again in a moment.',
      ),
    ).toBeDefined();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const name = screen.getByLabelText('Organisation name') as HTMLInputElement;
    expect(name.value).toBe('Supper');
    await waitFor(() => expect(document.activeElement).toBe(name));
  });

  it.each([
    ['a server error', () => problem('internal_error', 500)],
    [
      'no network',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('puts focus back on the name after %s, keeping what was typed', async (_, answer) => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    creating(answer);
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Supper' } });
    pressCreate();
    expect(screen.getByLabelText('Organisation name').matches(':disabled')).toBe(true);
    expect(screen.getByLabelText('Country').matches(':disabled')).toBe(true);

    expect(
      await screen.findByText(
        'Creating the organisation did not work. Nothing was created. Try again in a moment.',
      ),
    ).toBeDefined();
    const name = screen.getByLabelText('Organisation name') as HTMLInputElement;
    expect(name.value).toBe('Supper');
    await waitFor(() => expect(document.activeElement).toBe(name));
  });

  it.each([
    [['countryCode'], 'Country'],
    [['name'], 'Organisation name'],
    [['name', 'countryCode'], 'Organisation name'],
  ])('puts focus on the first field a refusal of %j names', async (paths, focused) => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    creating(() =>
      json(
        {
          type: 'https://soirely.com/errors/validation_failed',
          title: 'No.',
          status: 422,
          violations: paths.map((propertyPath) => ({
            propertyPath,
            message: `Bad ${propertyPath}.`,
            code: 'validation_failed',
          })),
        },
        422,
      ),
    );
    inOne();
    openCreate();

    fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Supper' } });
    pressCreate();

    for (const propertyPath of paths) {
      expect(await screen.findByText(`Bad ${propertyPath}.`)).toBeDefined();
    }
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(focused)));
  });

  it('keeps Tab and Shift+Tab inside the dialog, in the drawn order', () => {
    inOne();
    openCreate();

    const dialog = screen.getByRole('dialog', { name: 'Create an organisation' });
    const name = within(dialog).getByLabelText('Organisation name');
    const create = within(dialog).getByRole('button', { name: 'Create organisation' });

    expect([...dialog.querySelectorAll('input, select, button')]).toEqual([
      name,
      within(dialog).getByLabelText('Country'),
      within(dialog).getByRole('button', { name: 'Cancel' }),
      create,
    ]);

    create.focus();
    fireEvent.keyDown(create, { key: 'Tab' });
    expect(document.activeElement).toBe(name);

    fireEvent.keyDown(name, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(create);
  });

  it('brings focus back into the dialog from the page behind, and the scrim still closes it', () => {
    inOne();
    openCreate();

    const scrim = screen.getAllByRole('button', { name: 'Cancel' })[0] as HTMLElement;
    expect(scrim.tabIndex).toBe(-1);

    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByLabelText('Organisation name'));

    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Create organisation' }),
    );

    fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Organisation: Ìrè Events/ }),
    );
  });

  it('returns focus to the switcher button on Cancel and on Escape', () => {
    inOne();
    openCreate();

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1] as HTMLElement);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Organisation: Ìrè Events/ }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Organisation: Ìrè Events/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create an organisation' }));
    fireEvent.keyDown(screen.getByLabelText('Organisation name'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Organisation: Ìrè Events/ }),
    );
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
