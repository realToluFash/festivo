import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { routes } from '../index.tsx';

/**
 * Sign in, at the address somebody actually opens.
 *
 * Rendered through the real route tree because the arrival state is read from
 * the query string, and mounting the component directly would prove only that
 * the component renders.
 */
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

  /**
   * A password field with no way to read it back is where a typo on a phone
   * keyboard turns into "my password stopped working".
   */
  it('hides the password and reveals it on request', () => {
    at('/sign-in');

    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(password.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * Both are drawn here and neither is wired: sc-58 and sc-59 own the
   * endpoints. What the test holds is the wording and the order, because both
   * owners publish requirements about them.
   */
  it('offers Google and Apple, in their own words', () => {
    at('/sign-in');

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
  });

  /** The mark is the brand's, and it is decoration beside the wording. */
  it('keeps the brand marks out of the accessible name', () => {
    at('/sign-in');

    const google = screen.getByRole('button', { name: 'Continue with Google' });

    expect(google.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('separates the password form from the providers with a divider', () => {
    at('/sign-in');

    expect(screen.getByText('or')).toBeDefined();
  });

  /**
   * Every way a session can fail to renew sends somebody here, and they all
   * say the same thing. Which one it was tells whoever holds a stolen token
   * something, and tells the owner of the account nothing they can act on.
   */
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

  /**
   * On the one page that has to work for everybody: somebody who cannot read
   * this page cannot sign in, and cannot reach the switcher inside the product
   * either.
   */
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

/**
 * The form, against what the endpoint actually answers.
 *
 * `POST /api/auth/login` hands out a session and not a profile — no account in
 * the body — so who it belongs to is a second call, and these tests hold that
 * order because the shell is written against the second one.
 */
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

function answering(answers: Record<string, () => Response>, sent: Sent[] = []) {
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
  __setSessionState({ status: 'unknown' });
});

describe('signing in, for real', () => {
  it('signs in and lands on the product', async () => {
    answering({
      'POST /api/auth/login': () => json(ISSUED),
      'GET /api/auth/me': () => json(ACCOUNT),
    });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('link', { name: 'Events' })).toBeDefined());
    expect(screen.getByText('Signed in as Folake Ire')).toBeDefined();
  });

  /**
   * The refresh token comes back as a cookie, and a cookie only arrives if the
   * request asked for one. A forgotten `credentials` fails by signing somebody
   * out fifteen minutes later, nowhere near the code that caused it.
   */
  it('posts the address and the password, and asks for the cookie', async () => {
    const sent = answering({
      'POST /api/auth/login': () => json(ISSUED),
      'GET /api/auth/me': () => json(ACCOUNT),
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

  /** One message for both, because two messages answer "is this registered". */
  it('shows one message for a wrong address and a wrong password', async () => {
    answering({ 'POST /api/auth/login': () => problem(401, 'invalid_credentials') });

    at('/sign-in');
    fillIn();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/));
    expect(screen.getByRole('alert').textContent).not.toMatch(/address|account/i);
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
  });

  /**
   * The server also writes the time into the problem's detail, in its own
   * wording. Parsing a sentence back into a time is how a locale change breaks
   * a lock screen, so without the header this is the ordinary failure.
   */
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
