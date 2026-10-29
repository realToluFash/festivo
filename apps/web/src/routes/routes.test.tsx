import { type Account } from '@soirely/api-client';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { api } from '../api.ts';
import { followAccount } from '../accountLanguage.ts';
import { setLanguage } from '../i18n/index.ts';
import { __setSessionState, type Session } from '../session.ts';
import { routes } from './index.tsx';
import { membership } from '../test-memberships.ts';

const MEMBERSHIP = membership({ id: 'org_1', name: 'Okonkwo Events' });

const ADA_ACCOUNT: Account = {
  id: 'acc_1',
  name: 'Ada Okonkwo',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: null,
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  twoFactorSetupPrompt: false,
  waitingFor: null,
  providers: [],
  emailAddresses: [],
  phoneNumbers: [],
};

const ADA: Session = {
  name: 'Ada Okonkwo',
  email: 'ada@example.com',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  organisationCountry: null,
  timezone: null,
  waitingFor: null,
};

/**
 * The shell, through the router, at the addresses people actually open.
 *
 * Rendered through the real route tree rather than by mounting components
 * directly: the thing being tested is that an address resolves to a page, and
 * mounting the component proves only that the component renders.
 */
function at(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  return render(<RouterProvider router={router} />);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await followAccount(ADA_ACCOUNT);
  await setLanguage(null);
});

describe('the public tree', () => {
  it('serves the start page with no account', () => {
    at('/');

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  /** Somebody who cannot read the marketing copy cannot sign up. */
  it('offers the language switcher on a public page', () => {
    at('/');

    expect(screen.getByLabelText('Language')).toBeDefined();
  });

  it('renders a real page for an address that does not exist', () => {
    at('/no-such-page');

    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeDefined();
  });
});

describe('the application tree', () => {
  beforeEach(() => {
    __setSessionState({ status: 'signedIn', session: ADA });
  });

  it('renders the shell with navigation and the organisation', () => {
    at('/app');

    expect(
      screen.getByRole('button', { name: /Organisation: Okonkwo Events, your role Owner/ }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Events' })).toBeDefined();
    expect(screen.getByText('Signed in as Ada Okonkwo')).toBeDefined();
  });

  it('opens in the account language, with no Automatic, after Automatic was picked outside (sc-9797)', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await followAccount({ ...ADA_ACCOUNT, locale: 'es' });
    await setLanguage(null);

    at('/app');

    const picker = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Idioma' });
    expect(picker.value).toBe('es');
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);
    expect(screen.getByRole('link', { name: 'Eventos' })).toBeDefined();
  });

  it('shows an account in no organisation where it stands, with no product page to open', () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...ADA, organisation: null, organisations: [] },
    });

    at('/app/settings');

    expect(screen.getByRole('heading', { name: 'You are not in an organisation' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('sends somebody with no session to sign in, saying nothing about being signed out', async () => {
    __setSessionState({ status: 'signedOut', ended: false });

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sends a sign-up still waiting on its code back to the code, not to sign in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    sessionStorage.setItem(
      'soirely.registration',
      JSON.stringify({ registration: 'the-handle', email: 'ada@example.com' }),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cooldownSeconds: 0, codeState: 'live' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeDefined(),
    );
    sessionStorage.clear();
  });

  it('clears a sign-up that has run out, and opens on sign in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    sessionStorage.setItem(
      'soirely.registration',
      JSON.stringify({ registration: 'spent', email: 'ada@example.com' }),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://soirely.com/errors/registration_expired',
          title: 'Gone',
          status: 410,
        }),
        { status: 410, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(sessionStorage.getItem('soirely.registration')).toBeNull();
  });

  it('says they were signed out when a session was lost on the way', async () => {
    __setSessionState({ status: 'signedOut', ended: true });

    at('/app');

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/signed out/i));
  });

  it('says they were signed out, not Check your email, for a sign-up held before somebody signed in (sc-19634)', async () => {
    sessionStorage.setItem(
      'soirely.registration',
      JSON.stringify({ registration: 'the-handle', email: 'ada@example.com' }),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'fresh',
          refreshExpiresAt: '2026-11-14T00:00:00+00:00',
          sessionId: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
          account: ADA_ACCOUNT,
        }),
        { status: 200 },
      ),
    );
    await api.signIn('bola@example.com', 'a decent passphrase');
    __setSessionState({ status: 'signedOut', ended: true });

    at('/app');

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/signed out/i));
    expect(screen.queryByRole('heading', { level: 1, name: 'Check your email' })).toBeNull();
  });

  it('keeps the session when a reload cannot reach the API, and comes back with it', async () => {
    __setSessionState({ status: 'unknown' });
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    at('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Cannot reach Soirely' })).toBeDefined(),
    );
    expect(screen.getByRole('status').textContent).toMatch(/You are still signed in/);
    expect(screen.queryByRole('heading', { level: 1, name: 'Sign in' })).toBeNull();
    expect(screen.queryByLabelText('Email')).toBeNull();

    let answer: (response: Response) => void = () => {};
    const account = new Promise<Response>((resolve) => (answer = resolve));
    fetch.mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/orgs'
        ? new Response(JSON.stringify({ organisations: [MEMBERSHIP] }), { status: 200 })
        : account,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const trying = await screen.findByRole('button', { name: 'Trying again…' });
    expect(trying.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Cannot reach Soirely' })).toBeDefined();

    answer(
      new Response(
        JSON.stringify({
          id: 'acc_1',
          name: 'Ada Okonkwo',
          businessName: 'Okonkwo Events',
          countryCode: 'NG',
          organisationCountry: null,
          locale: 'en',
          timezone: null,
          waitingFor: null,
          verified: true,
          complete: true,
          needsOrganisation: false,
          hasPassword: true,
          emailAddresses: [{ id: 'a1', address: 'ada@example.com', verified: true, primary: true }],
          phoneNumbers: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await waitFor(() => expect(screen.getByText('Signed in as Ada Okonkwo')).toBeDefined());
  });

  it('waits rather than redirecting while the session is being checked', async () => {
    __setSessionState({ status: 'unknown' });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    at('/app');

    await waitFor(() => expect(screen.getByText('Loading…')).toBeDefined());
    expect(screen.queryByRole('heading', { level: 1, name: 'Sign in' })).toBeNull();
  });

  it("stacks the sidebar from a tablet's width down only as tall as what it holds (sc-17608)", () => {
    const styles = readFileSync(join(import.meta.dirname, '../styles.css'), 'utf8');
    const stacked = /@media \(width <= 60rem\) \{[^@]*?\n {2}\.shell \{([^}]*)\}/u.exec(
      styles,
    )?.[1];

    expect(stacked).toMatch(/grid-template-columns: minmax\(0, 1fr\);/u);
    expect(stacked).toMatch(/grid-template-rows: auto 1fr;/u);
  });

  describe("at a phone's width, the menu (sc-13413)", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    });

    function openMenu(): HTMLElement {
      const menu = screen.getByRole('button', { name: 'Menu' });
      menu.focus();
      fireEvent.click(menu);

      return screen.getByRole('dialog', { name: 'Menu' });
    }

    it("holds the links in the sidebar's order, then the account, then the language", () => {
      at('/app/settings');

      const dialog = openMenu();
      const links = [...dialog.querySelectorAll('a')];

      expect(links.map((link) => link.textContent)).toEqual([
        'Dashboard',
        'Events',
        'Guests',
        'Settings',
        'Your account',
      ]);
      expect(links[3]!.getAttribute('aria-current')).toBe('page');
      expect(dialog.textContent).toContain('ada@example.com');
      expect(dialog.querySelector('select[aria-label="Language"]')).not.toBeNull();
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: 'Close menu' }),
      );
    });

    it('closes on a link to another page, focus where that page puts it', async () => {
      at('/app/settings/members');

      const dialog = openMenu();
      fireEvent.click(within(dialog).getByRole('link', { name: 'Settings' }));

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { level: 1, name: 'General' }),
        ),
      );
      await act(() => new Promise((resolve) => setTimeout(resolve)));
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'General' }),
      );
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    });

    it('closes on the link to the page already showing, focus back on Menu', async () => {
      at('/app/settings');

      const dialog = openMenu();
      fireEvent.click(within(dialog).getByRole('link', { name: 'Settings' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull());
      await act(() => new Promise((resolve) => setTimeout(resolve)));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
    });

    it("closes when widened past a phone's width, focus on the sidebar's current link", () => {
      const listeners: (() => void)[] = [];
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          ({
            matches: false,
            media: query,
            addEventListener: (_: string, listener: () => void) => listeners.push(listener),
            removeEventListener() {},
          }) as never,
      );
      at('/app/settings/members');

      openMenu();
      act(() => listeners.forEach((listener) => listener()));

      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
      expect(document.activeElement).toBe(
        document.querySelector('.shell-sidebar .shell-nav [aria-current="page"]'),
      );
      expect(document.activeElement?.textContent).toBe('Settings');
    });

    it('closes on a link, opening its page', async () => {
      at('/app/settings');

      const dialog = openMenu();
      fireEvent.click([...dialog.querySelectorAll('a')].find((a) => a.textContent === 'Events')!);

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull());
      expect(screen.getAllByRole('link', { name: 'Events' })[0]!.getAttribute('aria-current')).toBe(
        'page',
      );
    });

    it('closes on Escape and on its close button, focus back on Menu', () => {
      at('/app');

      openMenu();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));

      fireEvent.click(within(openMenu()).getByRole('button', { name: 'Close menu' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
    });

    it('stays open on a language chosen in it, and the menu changes language', async () => {
      at('/app');

      const dialog = openMenu();
      const select = dialog.querySelector('select')!;
      select.focus();
      fireEvent.change(select, { target: { value: 'fr' } });

      await waitFor(() =>
        expect(within(dialog).getByRole('link', { name: 'Tableau de bord' })).toBeDefined(),
      );
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(document.activeElement).toBe(select);
    });

    it('says on Menu whether it is open, and which dialog it opens', () => {
      at('/app');

      const menu = screen.getByRole('button', { name: 'Menu' });
      expect(menu.getAttribute('aria-expanded')).toBe('false');

      const dialog = openMenu();
      expect(menu.getAttribute('aria-expanded')).toBe('true');
      expect(menu.getAttribute('aria-controls')).toBe(dialog.id);
    });

    it('makes the page behind it inert while it is open', () => {
      const { container } = at('/app');
      const behind = () => [
        container.querySelector('.skip-link')!,
        container.querySelector('.shell-sidebar')!,
        container.querySelector('main#content')!,
      ];

      openMenu();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(behind().every((element) => !element.hasAttribute('inert'))).toBe(true);

      openMenu();
      expect(behind().every((element) => element.hasAttribute('inert'))).toBe(true);
    });

    it('keeps Tab inside while it is open', () => {
      at('/app');

      const dialog = openMenu();
      const select = dialog.querySelector('select')!;
      select.focus();
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBe(dialog.querySelector('button'));
    });
  });

  it('keeps the shell usable when a screen throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const Boom = () => {
      throw new Error('a screen failed');
    };

    const router = createMemoryRouter(
      [
        {
          path: '/app',
          element: routes[0]!.children.find((route) => route.path === '/app')!.element,
          children: [{ index: true, element: <Boom /> }],
        },
      ],
      { initialEntries: ['/app'] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Guests' })).toBeDefined();
  });
});

describe('the guest tree', () => {
  it('serves an invitation with no account and no application navigation', () => {
    at('/i/abcdefghijklmnop1234');

    expect(screen.getByRole('heading', { name: 'You are invited' })).toBeDefined();
    expect(screen.queryByLabelText('Switch organisation')).toBeNull();
  });

  /**
   * The person reading this has no account, did not choose the link and cannot
   * debug anything. A blank screen is the worst possible answer.
   */
  it('renders a real page for a malformed token', () => {
    at('/i/nope');

    expect(
      screen.getByRole('heading', { name: 'This invitation link does not work' }),
    ).toBeDefined();
  });

  it('tells them what to do about it', () => {
    at('/i/nope');

    expect(screen.getByRole('alert').textContent).toMatch(/fresh link/);
  });
});

describe('the status page', () => {
  it('renders what the API answered, read through the shared client', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', checks: { postgres: { status: 'ok' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    at('/status');

    await waitFor(() => expect(screen.getByText('All services are responding.')).toBeDefined());
    expect(screen.getByText('postgres')).toBeDefined();
  });

  /** The base URL came from runtime configuration, so the request proves it. */
  it('calls the configured base URL rather than a relative path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', checks: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    at('/status');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('http://api.test/api/health');
  });

  it('shows a degraded API as degraded rather than as unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'degraded',
          checks: { postgres: { status: 'ok' }, redis: { status: 'error' } },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    at('/status');

    await waitFor(() =>
      expect(screen.getByText('Some services are not responding.')).toBeDefined(),
    );
    expect(screen.getByText('redis')).toBeDefined();
    expect(screen.queryByText('The API could not be reached.')).toBeNull();
  });

  it('says so when the API cannot be reached, and offers a retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    at('/status');

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('The API could not be reached.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  /** A host and a port are internal detail on a page anybody can open. */
  it('does not leak the thrown message onto the page', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.7:8080'),
    );

    at('/status');

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(document.body.textContent).not.toMatch(/10\.0\.0\.7/);
  });
});
