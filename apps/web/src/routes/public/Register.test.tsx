import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

const ACCOUNT = {
  id: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
  locale: 'en',
  verified: false,
  complete: false,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: false, primary: true }],
  phoneNumbers: [],
};

const ISSUED = {
  accessToken: 'an-access-token',
  refreshExpiresAt: '2026-11-14T00:00:00+00:00',
  sessionId: '018f3a4c-0001-7c3d-9e1f-2a3b4c5d6e7f',
};

function answering(answers: Record<string, () => Response>) {
  const sent: { path: string; body: string | null }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const { pathname } = new URL(String(input));
    const method = init?.method ?? 'GET';

    sent.push({ path: pathname, body: typeof init?.body === 'string' ? init.body : null });

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

function problem(
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra },
    status,
    headers,
  );
}

function typePassword(value: string) {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value } });
}

function fillIn(password = 'lagos-evening-air') {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Folake Adeyemi' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  folake@ire.events ' } });
  typePassword(password);
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('the way back from Create your account (sc-23277)', () => {
  function from(entries: string[]) {
    const router = createMemoryRouter(routes, {
      initialEntries: entries,
      initialIndex: entries.length - 1,
    });
    render(<RouterProvider router={router} />);

    return router;
  }

  it('reads ‹ Sign in, and is heard as Back to sign in', () => {
    from(['/register']);

    const back = screen.getByRole('button', { name: 'Back to sign in' });
    expect(back.textContent).toBe('‹ Sign in');
  });

  it('does what the browser’s Back does, when there is a page to go back to', async () => {
    const router = from(['/sign-in', '/forgot-password', '/register']);

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/forgot-password'));
  });

  it('opens Sign in when the account form was the first page opened', async () => {
    const router = from(['/register']);

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
  });
});

describe('creating an account', () => {
  it('asks for a name, an email and a password, and states the rule before submit', () => {
    at('/register');

    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeDefined();
    expect(
      screen.getByText('Next, we email you a code to check the address is yours.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Full name').getAttribute('autocomplete')).toBe('name');
    expect((screen.getByLabelText('Full name') as HTMLInputElement).maxLength).toBe(180);
    expect(screen.getByLabelText('Email').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByText('At least 15 characters')).toBeDefined();
    expect(screen.getByText(/That is the only rule\./)).toBeDefined();
  });

  it('marks the rule Met at fifteen characters, with a word as well as a mark', () => {
    const sent = answering({});
    at('/register');

    typePassword('lagos-evening-');
    expect(screen.getByText('Not yet')).toBeDefined();

    typePassword('lagos-evening-a');
    expect(screen.getByText('Met')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('never sends a password shorter than the rule', () => {
    const sent = answering({});
    at('/register');

    fillIn('lagos-evening-');

    expect(sent).toEqual([]);
    expect(screen.getByText('Not yet')).toBeDefined();
  });

  it('offers Google and Apple, and a way back to sign in', () => {
    at('/register');

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
    expect(screen.getByText('Already have an account?')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in');
  });

  it('is reached from sign-in', () => {
    at('/sign-in');

    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(
      '/register',
    );
  });
});

describe('creating an account, for real', () => {
  it('registers once and lands on Check your email by its handle, signed in to nothing', async () => {
    const sent = answering({
      'POST /api/auth/register': () =>
        json({ registration: 'the-handle', email: 'folake@ire.events' }, 202),
      'GET /api/auth/register/resend': () => json({ cooldownSeconds: 60 }),
    });

    at('/register');
    fillIn();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeDefined(),
    );
    expect(screen.getByText(/We sent a code to folake@ire\.events\./)).toBeDefined();

    const registrations = sent.filter((request) => request.path === '/api/auth/register');
    expect(registrations).toHaveLength(1);
    expect(JSON.parse(registrations[0]?.body ?? '{}')).toMatchObject({
      email: 'folake@ire.events',
      name: 'Folake Adeyemi',
      password: 'lagos-evening-air',
    });
    expect(sent.some((request) => request.path === '/api/auth/me')).toBe(false);
  });

  it('makes the account only when the code is entered, then goes on', async () => {
    const sent = answering({
      'POST /api/auth/register': () =>
        json({ registration: 'the-handle', email: 'folake@ire.events' }, 202),
      'GET /api/auth/register/resend': () => json({ cooldownSeconds: 0 }),
      'POST /api/auth/register/verify': () => json({ ...ISSUED, account: ACCOUNT }, 201),
      'GET /api/orgs': () => json({ organisations: [] }),
    });

    at('/register');
    fillIn();
    fireEvent.change(await screen.findByLabelText('Code from the email'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));

    await waitFor(
      () => expect(screen.getByRole('heading', { level: 1, name: 'Email verified' })).toBeDefined(),
      { timeout: 3000 },
    );
    expect(
      JSON.parse(
        sent.find((request) => request.path === '/api/auth/register/verify')?.body ?? '{}',
      ),
    ).toEqual({ registration: 'the-handle', code: '123456', refreshTokenIn: 'cookie' });
    expect(sessionStorage.getItem('soirely.registration')).toBeNull();
  });

  it('offers to register again, not to sign out, when the address is wrong', async () => {
    answering({
      'POST /api/auth/register': () =>
        json({ registration: 'the-handle', email: 'folake@ire.events' }, 202),
      'GET /api/auth/register/resend': () => json({ cooldownSeconds: 0 }),
    });

    at('/register');
    fillIn();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Register again with the right one' }),
    );

    await waitFor(() => expect(sessionStorage.getItem('soirely.registration')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(screen.queryByText(/create your account again/)).toBeNull();
  });

  /** A taken address gets no code, so its every code reads like this one: there is no "taken" to show. */
  it('says a wrong code is wrong, as it says to a taken address', async () => {
    answering({
      'POST /api/auth/register': () =>
        json({ registration: 'the-handle', email: 'folake@ire.events' }, 202),
      'GET /api/auth/register/resend': () => json({ cooldownSeconds: 0 }),
      'POST /api/auth/register/verify': () => problem(422, 'verification_code_invalid'),
    });

    at('/register');
    fillIn();
    fireEvent.change(await screen.findByLabelText('Code from the email'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'That code does not match. Check the newest email from Soirely and try again.',
        ),
      ).toBeDefined(),
    );
    expect(screen.queryByText(/already registered/)).toBeNull();
  });

  it('says a breached password is breached, under the password', async () => {
    answering({
      'POST /api/auth/register': () =>
        problem(422, 'validation_failed', {
          violations: [
            { propertyPath: 'password', message: 'Breached.', code: 'password_breached' },
          ],
        }),
    });

    at('/register');
    fillIn();

    await waitFor(() =>
      expect(
        screen.getByText('This password has appeared in a known data breach. Choose another.'),
      ).toBeDefined(),
    );
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows any other refusal in the API’s own words, under its field', async () => {
    answering({
      'POST /api/auth/register': () =>
        problem(422, 'validation_failed', {
          violations: [
            {
              propertyPath: 'email',
              message: 'Esa dirección no es válida.',
              code: 'validation_failed',
            },
          ],
        }),
    });

    at('/register');
    fillIn();

    await waitFor(() => expect(screen.getByText('Esa dirección no es válida.')).toBeDefined());
  });

  it('names the time to try again when the network is out of sign-ups', async () => {
    answering({
      'POST /api/auth/register': () =>
        problem(429, 'too_many_attempts', {}, { 'Retry-After': '900' }),
    });

    at('/register');
    fillIn();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Too many sign-ups from this network/),
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Try again at \d{2}:\d{2}\./);
  });
});
