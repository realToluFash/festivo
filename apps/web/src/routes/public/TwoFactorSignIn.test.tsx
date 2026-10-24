import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
  providers: [],
};

const CHALLENGE = {
  twoFactorChallenge: 'the-challenge',
  challengeExpiresAt: '2026-10-17T12:05:00+00:00',
  email: 'folake@ire.events',
};

// Sign-in, the challenge, then the code: more than waitFor's default second under load.
const THE_WAY_IN = { timeout: 3000 };

function answering(answers: Record<string, () => Response>) {
  const sent: { path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    sent.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[`${init?.method ?? 'GET'} ${path}`];
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

function problem(code: string, status: number, headers: Record<string, string> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status },
    status,
    headers,
  );
}

async function atTheCodeScreen(answers: Record<string, () => Response>) {
  const sent = answering({ 'POST /api/auth/login': () => json(CHALLENGE, 202), ...answers });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sign-in'] })} />);

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a decent passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(
    () => expect(screen.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeDefined(),
    THE_WAY_IN,
  );

  return sent;
}

function enter(code: string, button = 'Verify and sign in'): void {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: button }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a sign-in that asks for a second factor', () => {
  it('asks for the code for the address, and has stored nothing yet', async () => {
    await atTheCodeScreen({});

    expect(
      screen.getByText(
        'Open your authenticator app and enter the 6-digit code for folake@ire.events.',
      ),
    ).toBeDefined();
    expect(sessionStorage.length).toBe(0);
  });

  it('checks the code before sending, and a failed check costs no attempt', async () => {
    const sent = await atTheCodeScreen({});

    enter('');
    expect(screen.getByText('Enter the 6-digit code from your app.')).toBeDefined();
    enter('12345');
    expect(screen.getByText('The code is 6 digits.')).toBeDefined();

    expect(sent.filter((r) => r.path === '/api/auth/two-factor/verify')).toEqual([]);
  });

  it('sends the code with the challenge, and signs in', async () => {
    const sent = await atTheCodeScreen({
      'POST /api/auth/two-factor/verify': () =>
        json({
          accessToken: 'a',
          refreshExpiresAt: '2026-11-17T12:00:00+00:00',
          sessionId: 's',
          account: ACCOUNT,
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });

    enter('123 456');

    await waitFor(() => expect(sent.some((r) => r.path === '/api/orgs')).toBe(true), THE_WAY_IN);
    expect(sent.find((r) => r.path === '/api/auth/two-factor/verify')?.body).toMatchObject({
      challenge: 'the-challenge',
      code: '123456',
    });
  });

  it('says a wrong code is wrong, in the design’s words', async () => {
    await atTheCodeScreen({
      'POST /api/auth/two-factor/verify': () => problem('two_factor_code_invalid', 422),
    });

    enter('000000');

    await waitFor(() =>
      expect(
        screen.getByText('That code did not work. Enter the code your app shows now.'),
      ).toBeDefined(),
    );
  });

  it('takes a recovery code instead, and says when one was already used', async () => {
    const sent = await atTheCodeScreen({
      'POST /api/auth/two-factor/verify': () => problem('recovery_code_used', 422),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code instead' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Enter a recovery code' })).toBeDefined();

    enter('', 'Use this code');
    expect(screen.getByText('Enter one of your recovery codes.')).toBeDefined();

    enter('abcd-efgh', 'Use this code');

    await waitFor(() =>
      expect(
        screen.getByText(
          'That recovery code has already been used. Try another one from your list.',
        ),
      ).toBeDefined(),
    );
    expect(sent.find((r) => r.path === '/api/auth/two-factor/verify')?.body).toMatchObject({
      recoveryCode: 'abcd-efgh',
    });
  });

  it('pauses entry until a stated time after too many wrong codes', async () => {
    await atTheCodeScreen({
      'POST /api/auth/two-factor/verify': () =>
        problem('too_many_attempts', 429, { 'Retry-After': '600' }),
    });

    enter('000000');

    await waitFor(() => expect(screen.getByText('Too many wrong codes')).toBeDefined());
    expect(
      screen.getByText(
        /^Code entry is paused until \d\d:\d\d\. Then enter the code your app shows at that moment\.$/,
      ),
    ).toBeDefined();
    const button = screen.getByRole('button', { name: /^Try again at \d\d:\d\d$/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Reset your password' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });

  it('goes back to sign-in when the challenge has run out', async () => {
    await atTheCodeScreen({
      'POST /api/auth/two-factor/verify': () => problem('two_factor_challenge_invalid', 401),
    });

    enter('123456');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
  });

  it('is not reachable without a challenge', async () => {
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sign-in/code'] })} />,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
  });
});
