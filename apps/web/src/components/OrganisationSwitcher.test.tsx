import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Membership } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';

import type { WaitingInvitations } from '../invitations.ts';
import { __setSessionState, adoptAccount } from '../session.ts';
import { membership } from '../test-memberships.ts';
import { BREAKS_ANYWHERE } from '../test-wrapping.ts';
import { routes } from '../routes/index.tsx';
import { STYLES, cssRule } from '../test-styles.ts';
import { OrganisationSwitcher } from './OrganisationSwitcher.tsx';

const MENU_STYLES = readFileSync(join(import.meta.dirname, 'orgMenu.css'), 'utf8');
const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const OKAFOR = membership({
  id: 'org_2',
  name: 'Okafor Family',
  role: { id: 'role_2', seededAs: 'member', name: null },
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
      userId: 'u1',
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
      userId: 'u1',
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

/** POST /api/orgs answers `created`; anything else the shell asks for on the way is empty. */
function creating(created: () => Response | Promise<Response>) {
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

const OFFER_TILE = 'Ìrè Events Kitchen, You can ask to join';

/** The offer waits behind its tile in the open menu; pressing it opens its panel. */
async function openOffer(): Promise<HTMLElement> {
  const tile = await screen.findByRole('button', { name: OFFER_TILE });
  fireEvent.click(tile);

  return tile;
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
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
    expect(okafor?.textContent).toMatch(/Okafor Family.*Your role · Member/);
    expect(screen.getByText('Soirely remembers your choice on this device.')).toBeDefined();
  });

  it('switches, says so, and remembers the choice on this device', () => {
    inTwo();
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));
    fireEvent.click(screen.getByRole('option', { name: /Okafor Family/ }));

    expect(screen.getByRole('status').textContent).toMatch(/Now working in Okafor Family\./);
    expect(
      screen.getByRole('button', { name: /Organisation: Okafor Family, your role Member/ }),
    ).toBeDefined();
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_2');
  });

  it('takes Close this notice on a sign-in rules notice above it to "Now working in"', () => {
    const changed = {
      ...OKAFOR,
      signInRules: { ...OKAFOR.signInRules, changedAt: '2026-10-20T09:00:00+00:00' },
    };
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
        organisation: IRE,
        organisations: [IRE, changed],
        organisationCountry: null,
        timezone: null,
        waitingFor: null,
      },
    });
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));
    fireEvent.click(screen.getByRole('option', { name: /Okafor Family/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close this notice' }));

    expect(document.activeElement).toBe(screen.getByText('Now working in Okafor Family.'));
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
      colourScheme: null,
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
  function pausedInLagos(organisations: Membership[]): void {
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
        userId: 'u1',
        needsOrganisation: false,
        hasPassword: true,
        organisation: IRE,
        organisations,
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
          ownerClaim: null,
        },
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ invitations: [] }, 200));
  }

  it('opens the switcher with nothing marked current, then works in the one chosen', () => {
    pausedInLagos([IRE, OKAFOR]);
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

  it('with one other organisation, works in it and takes focus to the line that says so', () => {
    pausedInLagos([IRE]);
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: 'Switch organisation' }));

    const switched = screen.getByText('Now working in Ìrè Events.');
    expect(document.activeElement).toBe(switched.closest('.sw-notice'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('a 100-character name (sc-486)', () => {
  const SPACED = 'Adeyemi Okafor Events '.repeat(5).slice(0, 99).concat('X');
  const WORD = 'A'.repeat(100);

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
        userId: 'u1',
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
    expect(screen.getAllByTitle(name)).toHaveLength(1);
  });

  it('wraps it whole in the trigger and every row, never cut with an ellipsis (sc-26270)', () => {
    expect(cssRule('.org-name,\n.org-role')).toMatch(/overflow-wrap: anywhere;/u);
    expect(cssRule('.org-name,\n.org-role')).not.toMatch(/ellipsis|nowrap/u);
    expect(cssRule('.org-naming')).toMatch(/min-width: 0;/u);
  });

  it("keeps the name and its line free of a paragraph's margins (sc-29066)", () => {
    expect(cssRule('.org-name,\n.org-role')).toMatch(/margin: 0;/u);
  });

  it('never lets the frame grow past the viewport, nor the open list', () => {
    expect(cssRule('.shell')).toMatch(
      /grid-template-columns: var\(--todaySide\) minmax\(0, 1fr\);/u,
    );
    expect(STYLES).toMatch(/\.shell \{[^}]*grid-template-columns: minmax\(0, 1fr\);/u);
    expect(MENU_STYLES).toMatch(/\.sw-menu \{[^}]*width: min\(500px, 100vw - 24px\);/u);
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
    expect(cssRule('.notice')).toMatch(/overflow-wrap: anywhere;/u);
  });
});

describe('creating an organisation from the switcher (sc-30412)', () => {
  function walk(): HTMLElement {
    return screen.getByRole('dialog', { name: 'Create an organisation' });
  }

  function toReady(name: string): void {
    fireEvent.change(within(walk()).getByLabelText('Organisation name'), {
      target: { value: name },
    });
    fireEvent.click(within(walk()).getByRole('button', { name: 'Continue' }));
    fireEvent.click(within(walk()).getByRole('button', { name: 'Continue' }));
  }

  it('opens the walk on the name, Step 1 of 3, the tile a dashed plus', () => {
    inOne();
    openCreate();

    expect(document.activeElement).toBe(within(walk()).getByLabelText('Organisation name'));
    expect(within(walk()).getByText('Step 1 of 3')).toBeDefined();
    expect(within(walk()).getByRole('heading', { level: 1 }).textContent).toBe('What’s it called?');
  });

  it('opens the country on the device’s, and on Ready says the defaults with the primary email', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    inOne();
    openCreate();

    fireEvent.change(within(walk()).getByLabelText('Organisation name'), {
      target: { value: 'Supper' },
    });
    fireEvent.click(within(walk()).getByRole('button', { name: 'Continue' }));
    expect(
      within(walk())
        .getAllByRole('option', { name: /^Nigeria/ })[0]
        ?.getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.click(within(walk()).getByRole('button', { name: 'Continue' }));
    expect(
      within(walk()).getByText(/contact address is your primary email, f@ire\.events\./),
    ).toBeDefined();
  });

  it('asks for a country when this device named none', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    inOne();
    openCreate();

    toReady('Supper');

    expect(within(walk()).getByRole('alert').textContent).toBe('Choose a country.');
  });

  it('sends the name, country and device timezone, then works in the new one and says so', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-NG']);
    const created = membership({ id: 'org_9', name: 'Lagos Supper Club' });
    const fetch = creating(() => json({ organisation: created }, 201));
    inOne();
    openCreate();

    toReady('  Lagos Supper Club ');
    fireEvent.click(within(walk()).getByRole('button', { name: 'Create organisation' }));

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

  it('keeps Tab and Shift+Tab inside the walk', () => {
    inOne();
    openCreate();

    const name = within(walk()).getByLabelText('Organisation name');
    const goOn = within(walk()).getByRole('button', { name: 'Continue' });

    goOn.focus();
    fireEvent.keyDown(goOn, { key: 'Tab' });
    expect(walk().contains(document.activeElement)).toBe(true);

    name.focus();
    fireEvent.keyDown(name, { key: 'Tab', shiftKey: true });
    expect(walk().contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the switcher button on Cancel and on Escape, with nothing created', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    inOne();
    openCreate();

    fireEvent.click(within(walk()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Organisation: Ìrè Events/ }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Organisation: Ìrè Events/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create an organisation' }));
    fireEvent.keyDown(within(walk()).getByLabelText('Organisation name'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Organisation: Ìrè Events/ }),
    );
    expect(fetch.mock.calls.some(([, sent]) => sent?.method === 'POST')).toBe(false);
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
    const tile = await openOffer();

    expect(tile.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Ìrè Events Kitchen uses Soirely' })).toBeDefined();
    expect(
      screen.getByText(
        'Your address is at ire.events, so you can ask to join. Somebody there approves you before you see anything.',
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ask to join Ìrè Events Kitchen' }));

    expect(
      await screen.findByText('we’ll email folake@ire.events when they answer.', { exact: false }),
    ).toBeDefined();
  });

  it('hides it for good on Not now', async () => {
    const sent = offering();
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    await openOffer();
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('button', { name: OFFER_TILE })).toBeNull();
    expect(screen.queryByText('Ìrè Events Kitchen uses Soirely')).toBeNull();
    await waitFor(() =>
      expect(sent.some((request) => request.path === '/api/join-offers/org_3/dismiss')).toBe(true),
    );
  });
});

describe('where focus goes as the switcher closes (sc-11369)', () => {
  function switcherButton(name = 'Ìrè Events'): HTMLElement {
    return screen.getByRole('button', { name: new RegExp(`^Organisation: ${name}`) });
  }

  function quiet(): void {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ invitations: [] }, 200));
  }

  it('puts focus back on its button when closed with Escape', () => {
    quiet();
    inTwo();
    at('/app');

    fireEvent.click(switcherButton());
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(switcherButton());
    expect(switcherButton().getAttribute('aria-label')).toBe(
      'Organisation: Ìrè Events, your role Owner. Switch organisation',
    );
  });

  it('puts focus back on its button when the current organisation is picked', () => {
    quiet();
    inTwo();
    at('/app');

    fireEvent.click(switcherButton());
    fireEvent.click(screen.getByRole('option', { name: /Ìrè Events/ }));

    expect(document.activeElement).toBe(switcherButton());
  });

  it('leaves focus where a click outside puts it', () => {
    quiet();
    inTwo();
    at('/app');

    fireEvent.click(switcherButton());
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('puts focus on its button, naming the organisation picked, and still says the switch', async () => {
    quiet();
    inTwo();
    at('/app');

    fireEvent.click(switcherButton());
    fireEvent.click(screen.getByRole('option', { name: /Okafor Family/ }));

    await waitFor(() => expect(document.activeElement).toBe(switcherButton('Okafor Family')));
    expect(screen.getByRole('status').textContent).toMatch(/Now working in Okafor Family\./);
  });

  it('forgets the organisation picked once focus goes elsewhere, as on Keep editing', () => {
    const waiting = {
      invitations: [],
      outcomes: {},
      firstJoined: null,
      answer: vi.fn(),
    } as unknown as WaitingInvitations;
    const switcher = (current: Membership) => (
      <MemoryRouter>
        <OrganisationSwitcher
          current={current}
          organisations={[IRE, OKAFOR]}
          waiting={waiting}
          onSwitch={() => {}}
          onCreate={() => {}}
        />
        <button type="button">Keep editing</button>
      </MemoryRouter>
    );
    const { rerender } = render(switcher(IRE));

    fireEvent.click(switcherButton());
    fireEvent.click(screen.getByRole('option', { name: /Okafor Family/ }));
    const keep = screen.getByRole('button', { name: 'Keep editing' });
    keep.focus();
    rerender(switcher(OKAFOR));

    expect(document.activeElement).toBe(keep);
  });
});

describe('where focus goes on an offer in the switcher (sc-11369)', () => {
  function offering(invitations: unknown[] = []) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;

      if (path === '/api/join-offers') {
        return json(
          {
            domain: 'ire.events',
            offers: [{ id: 'org_3', name: 'Ìrè Events Kitchen' }],
            request: null,
          },
          200,
        );
      }

      if (path === '/api/join-offers/org_3/ask') {
        return json(
          {
            request: {
              organisation: { id: 'org_3', name: 'Ìrè Events Kitchen' },
              askedAt: '2026-10-19T10:00:00+00:00',
            },
          },
          201,
        );
      }

      if (path === '/api/join-offers/org_3/dismiss') return new Response(null, { status: 204 });

      return json({ invitations }, 200);
    });
  }

  it('takes Ask to join to the waiting line, read once', async () => {
    offering();
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    await openOffer();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask to join Ìrè Events Kitchen' }));

    const line = await screen.findByText('we’ll email folake@ire.events when they answer.', {
      exact: false,
    });
    const asked = line.closest('.sw-asked');
    await waitFor(() => expect(document.activeElement).toBe(asked));
    expect(asked?.getAttribute('role')).toBeNull();
  });

  it('takes Not now to Create an organisation when no invitation is waiting', async () => {
    offering();
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    await openOffer();
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Create an organisation' }),
      ),
    );
  });

  it('takes Not now to the invitation’s tile when one is waiting', async () => {
    offering([
      {
        id: 'inv_1',
        organisation: { id: 'org_7', name: 'Adunni Weddings' },
        email: 'folake@ire.events',
        role: { id: 'role_3', seededAs: 'administrator', name: null },
        invitedBy: { name: 'Bisi Adeyemi' },
        expiresAt: '2026-10-23T09:00:00+00:00',
        refusal: null,
        forYou: true,
        signedInAs: 'folake@ire.events',
      },
    ]);
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    await screen.findByRole('button', { name: /^Adunni Weddings, Invitation · / });
    await openOffer();
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /^Adunni Weddings, Invitation · / }),
      ),
    );
  });
});

describe('an invitation in the switcher, answered in its panel (sc-30412)', () => {
  const INVITATION = {
    id: 'inv_1',
    organisation: { id: 'org_7', name: 'Adunni Weddings' },
    email: 'folake@ire.events',
    role: { id: 'role_3', seededAs: 'administrator', name: null },
    invitedBy: { name: 'Bisi Adeyemi' },
    expiresAt: '2026-10-23T09:00:00+00:00',
    refusal: null,
    forYou: true,
    signedInAs: 'folake@ire.events',
  };
  const ADUNNI = membership({
    id: 'org_7',
    name: 'Adunni Weddings',
    role: { id: 'role_3', seededAs: 'administrator', name: null },
  });

  function answering(reply: (path: string) => Response | null) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;

      return reply(path) ?? json({ invitations: [INVITATION] }, 200);
    });
  }

  async function openInvitation(): Promise<HTMLElement> {
    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    const tile = await screen.findByRole('button', { name: /^Adunni Weddings, Invitation · / });
    fireEvent.click(tile);

    return screen.getByRole('group', { name: 'Adunni Weddings' });
  }

  it('waits behind a dashed tile, then opens to who sent it and until when', async () => {
    answering(() => null);
    inTwo();
    at('/app');

    const panel = await openInvitation();

    expect(within(panel).getByText(/^Invitation from Bisi Adeyemi · /)).toBeDefined();
    expect(within(panel).getByText(/^Works until /)).toBeDefined();
    expect(
      within(panel).getByText('Declining tells Bisi Adeyemi you said no. Nothing else changes.'),
    ).toBeDefined();
  });

  it('accepts in place, says so on the place it made, and opens it', async () => {
    answering((path) =>
      path === '/api/invitations/inv_1/accept' ? json({ organisation: ADUNNI }, 200) : null,
    );
    inTwo();
    at('/app');

    const panel = await openInvitation();
    fireEvent.click(within(panel).getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    const joined = await screen.findByText(/^You joined Adunni Weddings as /);
    await waitFor(() => expect(document.activeElement).toBe(joined.closest('[data-lands]')));
    expect(screen.queryByRole('button', { name: /^Adunni Weddings, Invitation/ })).toBeNull();
    expect(screen.getByRole('option', { name: /^Adunni Weddings, Your role/ })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Open Adunni Weddings' }));

    expect(await screen.findByText('Now working in Adunni Weddings.')).toBeDefined();
  });

  it('declines in place, and keeps the tile saying so', async () => {
    answering((path) =>
      path === '/api/invitations/inv_1/decline' ? new Response(null, { status: 204 }) : null,
    );
    inTwo();
    at('/app');

    const panel = await openInvitation();
    fireEvent.click(
      within(panel).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    );

    expect(
      await screen.findByText('You declined. Bisi Adeyemi will see that you said no.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^Adunni Weddings, Invitation/ })).toBeDefined();
  });

  it('keeps an answered tile only in the menu it was answered in', async () => {
    answering((path) =>
      path === '/api/invitations/inv_1/decline' ? new Response(null, { status: 204 }) : null,
    );
    inTwo();
    at('/app');

    const panel = await openInvitation();
    fireEvent.click(
      within(panel).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    );
    await screen.findByText('You declined. Bisi Adeyemi will see that you said no.');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));

    expect(await screen.findByRole('option', { name: /Current/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Adunni Weddings, Invitation/ })).toBeNull();
  });

  it('keeps a tile whose answer did not reach us in the next menu', async () => {
    answering((path) => (path === '/api/invitations/inv_1/accept' ? json({}, 500) : null));
    inTwo();
    at('/app');

    const panel = await openInvitation();
    fireEvent.click(within(panel).getByRole('button', { name: 'Accept and join Adunni Weddings' }));
    await screen.findByText('Your answer did not reach us. Check your connection and try again.');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));

    expect(
      await screen.findByRole('button', { name: /^Adunni Weddings, Invitation · / }),
    ).toBeDefined();
  });

  it('says when the answer did not reach us, and keeps both answers', async () => {
    answering((path) => (path === '/api/invitations/inv_1/accept' ? json({}, 500) : null));
    inTwo();
    at('/app');

    const panel = await openInvitation();
    fireEvent.click(within(panel).getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(
      await screen.findByText('Your answer did not reach us. Check your connection and try again.'),
    ).toBeDefined();
    expect(
      within(panel).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    ).toBeDefined();
  });

  it('says Joining… on the pressed answer while it is sent, and holds the other dimmed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(String(input)).pathname;

      return path === '/api/invitations/inv_1/accept'
        ? new Promise<Response>(() => {})
        : Promise.resolve(json({ invitations: [INVITATION] }, 200));
    });
    inTwo();
    at('/app');

    const panel = await openInvitation();
    const accept = within(panel).getByRole('button', { name: 'Accept and join Adunni Weddings' });
    fireEvent.click(accept);

    await waitFor(() => expect(accept.textContent).toBe('Joining…'));
    expect(accept.getAttribute('aria-busy')).toBe('true');
    expect(accept.hasAttribute('data-off')).toBe(false);

    const decline = within(panel).getByRole('button', {
      name: 'Decline the invitation to Adunni Weddings',
    });
    expect(decline.textContent).toBe('Decline');
    expect(decline.getAttribute('aria-disabled')).toBe('true');
    expect(decline.hasAttribute('data-off')).toBe(true);
  });

  it('leaves the role out of the tile and the panel once it is gone, with no dangling dot', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json({ invitations: [{ ...INVITATION, role: null }] }, 200),
    );
    inTwo();
    at('/app');

    fireEvent.click(await screen.findByRole('button', { name: /Switch organisation/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adunni Weddings, Invitation' }));
    const panel = screen.getByRole('group', { name: 'Adunni Weddings' });

    expect(within(panel).getByText('Invitation from Bisi Adeyemi')).toBeDefined();
  });
});

describe('more than 15 organisations (sc-30412)', () => {
  const MANY = Array.from({ length: 16 }, (_, index) =>
    membership({ id: `org_${index + 1}`, name: index === 0 ? 'Ìrè Events' : `Place ${index + 1}` }),
  );

  function inMany(): void {
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
        organisation: MANY[0] ?? IRE,
        organisations: MANY,
        organisationCountry: null,
        timezone: null,
        waitingFor: null,
      },
    });
  }

  it('heads the menu with a search only past 15, narrowing by name', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ invitations: [] }, 200));
    inMany();
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));
    const search = screen.getByRole('searchbox', { name: 'Search organisations' });
    fireEvent.change(search, { target: { value: 'ire' } });

    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);

    fireEvent.change(search, { target: { value: 'Belém' } });

    expect(screen.getByText('No organisation matches “Belém”.')).toBeDefined();
  });

  it('has no search at 15 or fewer', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ invitations: [] }, 200));
    inTwo();
    at('/app');

    fireEvent.click(screen.getByRole('button', { name: /Switch organisation/ }));

    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Where are you working?' })).toBeDefined();
  });
});
