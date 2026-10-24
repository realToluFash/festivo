import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { browser } from '../../providerSignIn.ts';
import { __setSessionState } from '../../session.ts';
import { routes } from '../index.tsx';

const ACCOUNT = {
  id: 'acc_1',
  name: 'Dev Organiser',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: false,
  needsOrganisation: true,
  hasPassword: true,
  emailAddresses: [{ id: 'a1', address: 'organiser@example.com', verified: true, primary: true }],
  phoneNumbers: [],
  providers: [{ provider: 'google', email: null }],
};

const ISSUED = { accessToken: 'access', expiresIn: 900, refreshTokenExpiresIn: 2592000 };

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function answering(answers: Record<string, (body: string) => Response>) {
  const sent: { url: string; body: string }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const body = typeof init?.body === 'string' ? init.body : '';
    sent.push({ url: `${url.origin}${url.pathname}`, body });

    const answer = answers[`${init?.method ?? 'GET'} ${url.origin}${url.pathname}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer(body);
  });

  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** As if this tab had left for Google: the attempt it keeps, and the address Google comes back to. */
function returningFromGoogle(query: string): void {
  sessionStorage.setItem(
    'soirely.google.attempt',
    JSON.stringify({ state: 'the-state', nonce: 'the-raw-nonce', codeVerifier: 'the-verifier' }),
  );
  window.history.replaceState(null, '', `/oauth/google?${query}`);
}

// The way back from Google is several round trips, more than waitFor's default second under load.
const THE_WAY_BACK = { timeout: 3000 };

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('continue with Google', () => {
  it('leaves for Google with PKCE, sending the nonce only as its hash', async () => {
    const assign = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    at('/sign-in');

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(assign).toHaveBeenCalledOnce());
    const url = new URL(String(assign.mock.calls[0]?.[0]));
    const attempt = JSON.parse(sessionStorage.getItem('soirely.google.attempt') ?? '{}') as {
      nonce: string;
      state: string;
    };

    expect(url.origin + url.pathname).toBe('http://sandbox.test/google/authorize');
    expect(url.searchParams.get('client_id')).toBe('soirely-web.test');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(attempt.state);
    expect(url.searchParams.get('nonce')).toMatch(/^[0-9a-f]{64}$/u);
    expect(url.searchParams.get('nonce')).not.toBe(attempt.nonce);
  });

  it('signs a new account in and lands it on the details screen, with Google named', async () => {
    returningFromGoogle('code=the-code&state=the-state');
    const sent = answering({
      'POST http://api.test/api/auth/oauth/google': () =>
        json({ ...ISSUED, account: ACCOUNT, linked: false }),
      'GET http://api.test/api/orgs': () => json({ organisations: [] }),
    });
    at('/oauth/google?code=the-code&state=the-state');

    await waitFor(
      () => expect(screen.getByRole('heading', { level: 1, name: 'A few details' })).toBeDefined(),
      THE_WAY_BACK,
    );
    expect(screen.getByText('Email confirmed by Google · done')).toBeDefined();
    expect(
      screen.getByText(
        'Signed in with Google. Google has already confirmed organiser@example.com, so there is no email code to enter.',
      ),
    ).toBeDefined();

    // The browser never calls the token endpoint: the API redeems the code with the secret.
    expect(sent.some((r) => r.url.endsWith('/token'))).toBe(false);
    const signIn = JSON.parse(sent.find((r) => r.url.endsWith('/oauth/google'))?.body ?? '{}') as {
      code: string;
      codeVerifier: string;
      nonce: string;
    };
    expect(signIn).toMatchObject({
      code: 'the-code',
      codeVerifier: 'the-verifier',
      nonce: 'the-raw-nonce',
    });
  });

  it('says once that Google is now linked, on the screen the person lands on', async () => {
    returningFromGoogle('code=the-code&state=the-state');
    answering({
      'POST http://api.test/api/auth/oauth/google': () =>
        json({ ...ISSUED, account: { ...ACCOUNT, providers: [] }, linked: true }),
      'GET http://api.test/api/orgs': () => json({ organisations: [] }),
    });
    at('/oauth/google?code=the-code&state=the-state');

    await waitFor(
      () =>
        expect(
          screen.getByText('Google is now linked to your account. You can sign in with either.'),
        ).toBeDefined(),
      THE_WAY_BACK,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Google is now linked/)).toBeNull();
    expect(sessionStorage.getItem('soirely.provider.linked')).toBeNull();
  });

  it('says Google is linked only once the two-factor code has passed', async () => {
    returningFromGoogle('code=the-code&state=the-state');
    answering({
      'POST http://api.test/api/auth/oauth/google': () =>
        json(
          {
            twoFactorChallenge: 'the-challenge',
            challengeExpiresAt: '2026-10-17T12:05:00+00:00',
            email: 'organiser@example.com',
          },
          202,
        ),
      'POST http://api.test/api/auth/two-factor/verify': () =>
        json({ ...ISSUED, account: ACCOUNT, linked: true }),
      'GET http://api.test/api/orgs': () => json({ organisations: [] }),
    });
    at('/oauth/google?code=the-code&state=the-state');

    await waitFor(
      () =>
        expect(screen.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeDefined(),
      THE_WAY_BACK,
    );
    expect(screen.queryByText(/Google is now linked/)).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(
      () =>
        expect(
          screen.getByText('Google is now linked to your account. You can sign in with either.'),
        ).toBeDefined(),
      THE_WAY_BACK,
    );
  });

  it('goes back to sign-in quietly when the person closed Google', async () => {
    returningFromGoogle('error=access_denied&state=the-state');
    answering({});
    at('/oauth/google?error=access_denied&state=the-state');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(screen.queryByText('Google sign-in did not work')).toBeNull();
  });

  it('says Google sign-in did not work when the API refuses the token, and changes nothing', async () => {
    returningFromGoogle('code=the-code&state=the-state');
    answering({
      'POST http://api.test/api/auth/oauth/google': () =>
        json(
          { type: 'https://soirely.com/errors/oauth_token_invalid', title: 'No.', status: 401 },
          401,
        ),
    });
    at('/oauth/google?code=the-code&state=the-state');

    await waitFor(() => expect(screen.getByText('Google sign-in did not work')).toBeDefined());
    expect(
      screen.getByText(
        'Nothing was changed. Try Google again, or sign in with your email and password.',
      ),
    ).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
  });

  it('refuses a callback whose state is not this tab’s', async () => {
    returningFromGoogle('code=the-code&state=forged');
    const sent = answering({});
    at('/oauth/google?code=the-code&state=forged');

    await waitFor(() => expect(screen.getByText('Google sign-in did not work')).toBeDefined());
    expect(sent).toEqual([]);
  });
});
