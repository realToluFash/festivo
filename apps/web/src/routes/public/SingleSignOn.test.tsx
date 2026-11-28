import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { browser } from '../../providerSignIn.ts';
import { routes } from '../index.tsx';

const START = {
  authorizationUrl: 'https://idp.example/authorize',
  organisation: 'Ìrè Events',
  provider: 'Okta',
};

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function answering(status: number, body: unknown) {
  const sent: { path: string; body: string }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    sent.push({
      path: new URL(String(input)).pathname,
      body: typeof init?.body === 'string' ? init.body : '',
    });

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return sent;
}

function typeEmail(value: string): void {
  const email = screen.getByLabelText('Email');
  fireEvent.change(email, { target: { value } });
  fireEvent.blur(email);
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('signing in through the identity provider', () => {
  it('replaces the password with the way to the provider, and leaves for it', async () => {
    answering(200, START);
    const left = vi.spyOn(browser, 'leaveFor').mockImplementation(() => undefined);
    at('/sign-in');

    typeEmail('ade@ire.events');

    expect(await screen.findByText('Ìrè Events signs in through Okta.')).toBeDefined();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Okta' }));

    await waitFor(() => expect(left).toHaveBeenCalledWith(START.authorizationUrl));
    expect(sessionStorage.getItem('soirely.sso.verifier')).not.toBeNull();
  });

  it('keeps another way to sign in', async () => {
    answering(200, START);
    at('/sign-in');
    typeEmail('ade@ire.events');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in another way' }));

    expect(screen.getByLabelText('Password')).toBeDefined();
  });

  it('keeps the password for a domain without it', async () => {
    const sent = answering(404, { type: 'https://soirely.com/errors/not_found', status: 404 });
    at('/sign-in');

    typeEmail('ade@gmail.com');

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(screen.getByLabelText('Password')).toBeDefined();
  });

  it('answers required sign-on’s refusal with the way to the provider', async () => {
    answering(403, {
      type: 'https://soirely.com/errors/sso_sign_in_required',
      title: 'Refused',
      status: 403,
      organisation: 'Ìrè Events',
      provider: 'Okta',
      email: 'ade@ire.events',
    });
    at('/sign-in');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ade@ire.events' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse' } });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ìrè Events signs you in through Okta.',
    );
    expect(screen.getByRole('button', { name: 'Continue to Okta' })).toBeDefined();
  });

  it('says signing in did not work when the provider sends back a failure', async () => {
    at('/sign-in/sso?error=failed');

    expect((await screen.findByRole('alert')).textContent).toContain('Signing in did not work');
  });

  it('sends the handle back with the verifier this tab kept', async () => {
    const sent = answering(401, { type: 'https://soirely.com/errors/oauth_token_invalid' });
    sessionStorage.setItem('soirely.sso.verifier', 'kept');
    at('/sign-in/sso?handle=h1');

    await screen.findByRole('alert');

    expect(sent[0]).toEqual({
      path: '/api/auth/sso/handle',
      body: expect.stringContaining('"codeVerifier":"kept"'),
    });
  });
});
