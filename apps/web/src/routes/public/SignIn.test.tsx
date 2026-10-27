import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('signing in', () => {
  it('asks for an email and a password, and nothing else', () => {
    at('/sign-in');

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  });

  it('autocompletes as a sign-in rather than as a new account', () => {
    at('/sign-in');

    expect(screen.getByLabelText('Email').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('current-password');
  });

  it('hides the password and reveals it on request', () => {
    at('/sign-in');

    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(password.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers Google and Apple, in their own words', () => {
    at('/sign-in');

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
  });

  it('keeps the brand marks out of the accessible name', () => {
    at('/sign-in');

    const google = screen.getByRole('button', { name: 'Continue with Google' });

    expect(google.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('separates the password form from the providers with a divider', () => {
    at('/sign-in');

    expect(screen.getByText('or')).toBeDefined();
  });

  it('says so when the person was signed out, and what to do about it', () => {
    at('/sign-in?signed-out');

    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/You were signed out/);
    expect(banner.textContent).toMatch(/Sign in again to carry on/);
  });

  it('says nothing about being signed out when nobody was', () => {
    at('/sign-in');

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers all four languages, each in its own language', () => {
    at('/sign-in');

    const choice = screen.getByRole('group', { name: 'Language' });
    const names = buttonsIn(choice).map((button) => button.textContent);

    expect(names).toEqual(['English', 'Español', 'Français', 'Português']);
  });

  it('marks the language in use rather than only colouring it', () => {
    at('/sign-in');

    const english = screen.getByRole('button', { name: 'English' });

    expect(english.getAttribute('aria-pressed')).toBe('true');
  });
});

function buttonsIn(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll('button')];
}

const ORGANISATION = {
  id: 'org_1',
  name: 'Ire Events',
  countryCode: 'NG',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  contactAddress: 'hello@ire.events',
  locale: 'en',
  role: { id: 'role_1', seededAs: 'owner', name: null },
};

const ACCOUNT = {
  id: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  name: 'Folake Ire',
  businessName: 'Ire Events',
  countryCode: 'NG',
  locale: 'en',
  verified: true,
  complete: true,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

interface Sent {
  method: string;
  path: string;
  body: string | null;
  credentials: string | undefined;
}

function answering(answers: Record<string, () => Response | Promise<Response>>, sent: Sent[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const { pathname } = new URL(String(input));
    const method = init?.method ?? 'GET';

    sent.push({
      method,
      path: pathname,
      body: typeof init?.body === 'string' ? init.body : null,
      credentials: init?.credentials,
    });

    const answer = answers[`${method} ${pathname}`];

    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(status: number, code: string, headers: Record<string, string> = {}): Response {
  return json(
    {
      type: `https://soirely.com/errors/${code}`,
      title: 'No.',
      status,
    },
    status,
    headers,
  );
}

function fillIn() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'folake@ire.events' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'lagos-evenings' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const ISSUED = {
  accessToken: 'an-access-token',
  refreshExpiresAt: '2026-11-14T00:00:00+00:00',
  sessionId: '018f3a4c-0001-7c3d-9e1f-2a3b4c5d6e7f',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signing in, for real', () => {
  it('signs in and lands on the product', async () => {
    const sent = answering({
      'POST /api/auth/login': () => json({ ...ISSUED, account: ACCOUNT }),
      'GET /api/orgs': () => json({ organisations: [ORGANISATION] }),
      'GET /api/orgs/org_1/events': () => json({ events: [], total: 0 }),
      'GET /api/invitations': () => json({ invitations: [] }),
    });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('link', { name: 'Events' })).toBeDefined());
    expect(screen.getByText('Signed in as Folake Ire')).toBeDefined();
    await waitFor(() =>
      expect(sent.map((request) => request.path)).toEqual([
        '/api/auth/login',
        '/api/orgs',
        '/api/orgs/org_1/events',
        '/api/orgs/org_1/events',
        '/api/invitations',
        '/api/join-offers',
      ]),
    );
  });

  it('sends an unverified account to the verification screen instead', async () => {
    answering({
      'POST /api/auth/login': () =>
        json({
          ...ISSUED,
          account: {
            ...ACCOUNT,
            verified: false,
            emailAddresses: [{ ...ACCOUNT.emailAddresses[0], verified: false }],
          },
        }),
    });

    at('/sign-in');
    fillIn();

    // Sign-in, the account, then the gate's screen: more than waitFor's default second under load.
    await waitFor(
      () =>
        expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeDefined(),
      { timeout: 3000 },
    );
    expect(screen.queryByRole('link', { name: 'Events' })).toBeNull();
  });

  it('posts the address and the password, and asks for the cookie', async () => {
    const sent = answering({
      'POST /api/auth/login': () => json({ ...ISSUED, account: ACCOUNT }),
      'GET /api/orgs': () => json({ organisations: [ORGANISATION] }),
    });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(sent).not.toEqual([]));

    const login = sent[0];

    expect(login?.path).toBe('/api/auth/login');
    expect(JSON.parse(login?.body ?? '{}')).toEqual({
      email: 'folake@ire.events',
      password: 'lagos-evenings',
      refreshTokenIn: 'cookie',
    });
    expect(login?.credentials).toBe('include');
  });

  it('shows one message for a wrong address and a wrong password', async () => {
    answering({ 'POST /api/auth/login': () => problem(401, 'invalid_credentials') });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/));
    expect(screen.getByRole('alert').textContent).not.toMatch(/address|account/i);
    expect(screen.getByRole('link', { name: 'Reset your password' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });

  it('says when to try again after too many tries, from the header', async () => {
    answering({
      'POST /api/auth/login': () => problem(429, 'too_many_attempts', { 'Retry-After': '900' }),
    });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Too many tries/));
    expect(screen.getByRole('alert').textContent).toMatch(/\d{2}:\d{2}/);
    expect(screen.getByRole('button', { name: /Try again at/ })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Reset your password' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });

  it('lifts the lock on the minute it named, keeping the address and clearing the password', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 14, 33, 20));

    answering({
      'POST /api/auth/login': () => problem(429, 'too_many_attempts', { 'Retry-After': '80' }),
    });

    at('/sign-in');
    fillIn();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /Too many tries\s*Try again at 14:35\./,
      ),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(99_000);
    });
    expect(screen.getByRole('button', { name: /Try again at 14:35/ })).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('folake@ire.events');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();

    vi.useRealTimers();
  });

  it('falls back to the plain failure when the header is missing', async () => {
    answering({ 'POST /api/auth/login': () => problem(429, 'too_many_attempts') });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/did not work/));
  });

  it('says it did not work when the request never arrived', async () => {
    answering({});

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/did not work/));
    expect(screen.getByRole('alert').textContent).toMatch(/Try again in a moment/);
  });
});

describe('a field keeps focus while signing in, and takes it for its line (sc-11588)', () => {
  function refusedLater(): () => void {
    let answer: (response: Response) => void = () => {};
    answering({
      'POST /api/auth/login': () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });

    return () => answer(problem(401, 'invalid_credentials'));
  }

  function typeIn() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'lagos-evenings' } });
  }

  it('keeps focus in Password while it sends after Enter, and there once refused', async () => {
    const refuse = refusedLater();
    at('/sign-in');
    typeIn();
    const password = screen.getByLabelText<HTMLInputElement>('Password');
    password.focus();

    fireEvent.submit(password);

    await waitFor(() => expect(password.readOnly).toBe(true));
    expect(document.activeElement).toBe(password);
    expect(password.hasAttribute('disabled')).toBe(false);
    expect(password.getAttribute('aria-disabled')).toBe('true');

    act(refuse);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/));
    expect(document.activeElement).toBe(password);
    expect(password.readOnly).toBe(false);
  });

  it('puts focus in Password when the refusal follows a click on Sign in', async () => {
    const refuse = refusedLater();
    at('/sign-in');
    typeIn();
    const button = screen.getByRole('button', { name: 'Sign in' });
    button.focus();

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Password').readOnly).toBe(true),
    );
    act(refuse);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/));
    expect(document.activeElement).toBe(screen.getByLabelText('Password'));
  });

  it('leaves focus where the person moved it while it sent', async () => {
    const refuse = refusedLater();
    at('/sign-in');
    typeIn();
    const email = screen.getByLabelText('Email');
    email.focus();

    fireEvent.submit(email);
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Email').readOnly).toBe(true),
    );
    const forgot = screen.getByRole('link', { name: 'Forgot your password?' });
    forgot.focus();
    act(refuse);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/));
    expect(document.activeElement).toBe(forgot);
  });

  it('sends once, whatever Enter is pressed again while it sends', async () => {
    const refuse = refusedLater();
    at('/sign-in');
    typeIn();
    const password = screen.getByLabelText('Password');

    fireEvent.submit(password);
    fireEvent.submit(password);
    act(refuse);

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });
});

describe('signing in under an organisation’s sign-in rules (sc-69)', () => {
  it('says which organisation turned passwords off, leaving the address and the linked provider only', async () => {
    answering({
      'POST /api/auth/login': () =>
        json(
          {
            type: 'https://soirely.com/errors/oauth_only',
            title: 'No.',
            status: 403,
            organisation: 'Ìrè Events',
            providers: ['google'],
            email: 'folake@ire.events',
          },
          403,
        ),
    });

    at('/sign-in');
    fillIn();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toMatch(/Ìrè Events signs in with Google or Apple only/);
    expect(banner.textContent).toMatch(/Use Google instead/);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('folake@ire.events');
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Forgot your password?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(
      screen.getByText('A rule set by Ìrè Events: password sign-in is off for everyone in it.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with another account' }));

    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  });

  it('after an inactivity limit, names the rule and keeps the address, asking for the password', () => {
    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: [
            {
              pathname: '/sign-in',
              search: '?signed-out',
              state: {
                timedOut: { organisation: 'Ìrè Events', days: 30, email: 'folake@ire.events' },
              },
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('status').textContent).toMatch(
      /Ìrè Events signs people out after 30 days without use/,
    );
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('folake@ire.events');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your password.')).toBeDefined();
  });

  it('opens on the provider buttons when a reset or an ended session was turned away by the rule', () => {
    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: [
            {
              pathname: '/sign-in',
              state: {
                providerOnly: {
                  organisation: 'Ìrè Events',
                  providers: ['apple'],
                  email: 'folake@ire.events',
                },
              },
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('alert').textContent).toMatch(
      /Ìrè Events signs in with Google or Apple only/,
    );
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('folake@ire.events');
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
  });
});
