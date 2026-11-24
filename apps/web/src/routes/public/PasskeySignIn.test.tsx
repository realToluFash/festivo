import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

const CHALLENGE = {
  twoFactorChallenge: 'the-challenge',
  challengeExpiresAt: '2026-11-23T12:05:00+00:00',
  email: 'ines@ire.events',
  factors: { app: false, passkeys: true },
};

const OPTIONS = {
  challenge: 'AAEC',
  rpId: 'soirely.test',
  timeout: 300000,
  userVerification: 'required',
  allowCredentials: [{ type: 'public-key', id: 'AQID' }],
};

class FakeCredential {}
class FakeAssertion {}

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sheet(get: () => Promise<unknown>): void {
  vi.stubGlobal('PublicKeyCredential', FakeCredential);
  vi.stubGlobal('AuthenticatorAssertionResponse', FakeAssertion);
  vi.stubGlobal('AuthenticatorAttestationResponse', class {});
  Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });
}

function used(): FakeCredential {
  return Object.assign(new FakeCredential(), {
    id: 'AQID',
    rawId: new Uint8Array([1, 2, 3]).buffer,
    type: 'public-key',
    response: Object.assign(new FakeAssertion(), {
      clientDataJSON: new Uint8Array([4]).buffer,
      authenticatorData: new Uint8Array([5]).buffer,
      signature: new Uint8Array([6]).buffer,
    }),
  });
}

async function signIn(answers: Record<string, () => Response>) {
  const sent = answering({
    'POST /api/auth/login': () => json(CHALLENGE, 202),
    'POST /api/auth/two-factor/passkey-options': () => json(OPTIONS),
    ...answers,
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sign-in'] })} />);

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ines@ire.events' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a decent passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(
    () => expect(screen.getByRole('heading', { level: 1, name: 'Use your passkey' })).toBeDefined(),
    { timeout: 3000 },
  );

  return sent;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

describe('a passkey at sign-in (sc-86885)', () => {
  it('opens the sheet in the code’s place and sends what it signed', async () => {
    sheet(async () => used());
    const sent = await signIn({
      'POST /api/auth/two-factor/verify': () =>
        json(
          { type: 'https://soirely.com/errors/passkey_refused', title: 'No.', status: 422 },
          422,
        ),
    });

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'That passkey did not work. Use a passkey again, or use a code instead.',
    );
    expect(sent.find((one) => one.path === '/api/auth/two-factor/verify')?.body).toMatchObject({
      challenge: 'the-challenge',
      passkey: {
        id: 'AQID',
        rawId: 'AQID',
        response: { clientDataJSON: 'BA', authenticatorData: 'BQ', signature: 'Bg' },
      },
    });
  });

  it('sends nothing when the sheet is closed, and a code goes to the recovery code with passkeys only', async () => {
    sheet(async () => {
      throw new DOMException('closed', 'NotAllowedError');
    });
    const sent = await signIn({});

    await screen.findByRole('button', { name: 'Use a passkey' });
    expect(sent.some((one) => one.path === '/api/auth/two-factor/verify')).toBe(false);
    expect(screen.queryByRole('link', { name: /^Lost your passkeys/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use a code instead' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Enter a recovery code' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Use your authenticator app instead' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use a passkey instead' })).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Lost your passkeys and your recovery codes?' }),
    ).toBeDefined();
  });

  it('asks for the code where this browser has no passkeys, and says why', async () => {
    answering({
      'POST /api/auth/login': () =>
        json({ ...CHALLENGE, factors: { app: true, passkeys: true } }, 202),
    });
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sign-in'] })} />,
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ines@ire.events' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('heading', { level: 1, name: 'Enter your code' }, { timeout: 3000 });
    expect(screen.getByText('This browser can’t use passkeys.')).toBeDefined();
    expect(
      screen.getByRole('link', {
        name: 'Lost your passkeys, your authenticator and your recovery codes?',
      }),
    ).toBeDefined();
  });
});
