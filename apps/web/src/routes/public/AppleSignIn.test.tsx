import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { browser } from '../../providerSignIn.ts';
import { __setSessionState } from '../../session.ts';
import { routes } from '../index.tsx';

const ACCOUNT = {
  id: 'acc_1',
  name: 'Ada Lovelace',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: false,
  needsOrganisation: true,
  hasPassword: true,
  emailAddresses: [
    { id: 'a1', address: 'x7k2p9@privaterelay.appleid.com', verified: true, primary: true },
  ],
  phoneNumbers: [],
  providers: [{ provider: 'apple', email: null }],
};

const ISSUED = { accessToken: 'access', expiresIn: 900, refreshTokenExpiresIn: 2592000 };

// The way back from Apple is several round trips, more than waitFor's default second under load.
const THE_WAY_BACK = { timeout: 3000 };

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function answering(answers: Record<string, () => Response>) {
  const sent: { url: string; body: string }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    sent.push({ url: `${url.origin}${url.pathname}`, body: String(init?.body ?? '') });

    const answer = answers[`${init?.method ?? 'GET'} ${url.origin}${url.pathname}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** As if this tab had left for Apple, and the API had sent it on from Apple's form_post. */
function returningFromApple(query: string): string {
  sessionStorage.setItem(
    'soirely.apple.attempt',
    JSON.stringify({ state: 'the-state', nonce: 'the-raw-nonce', codeVerifier: 'the-verifier' }),
  );
  window.history.replaceState(null, '', `/oauth/apple?${query}`);

  return `/oauth/apple?${query}`;
}

const FIRST_TIME = `code=the-code&state=the-state&user=${encodeURIComponent(
  '{"name":{"firstName":"Ada","lastName":"Lovelace"}}',
)}`;

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  __setSessionState({ status: 'unknown' });
});

describe('continue with Apple', () => {
  it('asks Apple for the name and email by form_post, answered to the API', async () => {
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    at('/sign-in');

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }));

    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    const url = new URL(String(leave.mock.calls[0]?.[0]));

    expect(url.origin + url.pathname).toBe('http://sandbox.test/apple/authorize');
    expect(url.searchParams.get('scope')).toBe('openid name email');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://api.test/api/auth/oauth/apple/return',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('sends the code with the name Apple gave once, and lands on the details screen', async () => {
    const path = returningFromApple(FIRST_TIME);
    const sent = answering({
      'POST http://api.test/api/auth/oauth/apple': () =>
        json({ ...ISSUED, account: ACCOUNT, linked: false }),
      'GET http://api.test/api/orgs': () => json({ organisations: [] }),
    });
    at(path);

    await waitFor(
      () => expect(screen.getByRole('heading', { level: 1, name: 'A few details' })).toBeDefined(),
      THE_WAY_BACK,
    );
    expect(screen.getByText('Email confirmed by Apple · done')).toBeDefined();
    expect(
      screen.getByText(
        'Signed in with Apple. Apple has already confirmed x7k2p9@privaterelay.appleid.com, so there is no email code to enter.',
      ),
    ).toBeDefined();

    const body = JSON.parse(sent.find((r) => r.url.endsWith('/oauth/apple'))?.body ?? '{}') as {
      code: string;
      redirectUri: string;
      name: string;
    };
    expect(body).toMatchObject({
      code: 'the-code',
      redirectUri: 'http://api.test/api/auth/oauth/apple/return',
      name: 'Ada Lovelace',
    });
  });

  it('says once that Apple is now linked', async () => {
    const path = returningFromApple('code=the-code&state=the-state');
    answering({
      'POST http://api.test/api/auth/oauth/apple': () =>
        json({ ...ISSUED, account: { ...ACCOUNT, providers: [] }, linked: true }),
      'GET http://api.test/api/orgs': () => json({ organisations: [] }),
    });
    at(path);

    await waitFor(
      () =>
        expect(
          screen.getByText('Apple is now linked to your account. You can sign in with either.'),
        ).toBeDefined(),
      THE_WAY_BACK,
    );
  });

  it('says Apple sign-in did not work when the API refuses, and changes nothing', async () => {
    const path = returningFromApple('code=the-code&state=the-state');
    answering({
      'POST http://api.test/api/auth/oauth/apple': () =>
        json(
          { type: 'https://soirely.com/errors/oauth_token_invalid', title: 'No.', status: 401 },
          401,
        ),
    });
    at(path);

    await waitFor(
      () => expect(screen.getByText('Apple sign-in did not work')).toBeDefined(),
      THE_WAY_BACK,
    );
    expect(screen.getByLabelText('Email')).toBeDefined();
  });
});
