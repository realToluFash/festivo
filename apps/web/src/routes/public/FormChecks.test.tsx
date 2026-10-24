import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

// sc-334: register, sign in and verify email check before they send, and never send while a field fails.
const UNVERIFIED: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: false,
  complete: false,
  awaiting: 'email' as const,
  providers: [],
  needsOrganisation: false,
  hasPassword: true,
  organisation: membership(),
  organisations: [membership()],
  organisationCountry: null,
  timezone: null,
  waitingFor: null,
};

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function watching(answers: Record<string, () => Response> = {}) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = new URL(String(input)).pathname;
    sent.push({
      method,
      path,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });

    const answer = answers[`${method} ${path}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function posts(sent: { method: string; path: string }[], path: string) {
  return sent.filter((request) => request.method === 'POST' && request.path === path);
}

function invalid(label: string | RegExp): boolean {
  return screen.getByLabelText(label).getAttribute('aria-invalid') === 'true';
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sign in checks before it sends', () => {
  it('says what is missing under each field, focuses the first, and sends nothing', () => {
    const sent = watching();
    at('/sign-in');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email address.')).toBeDefined();
    expect(screen.getByText('Enter your password.')).toBeDefined();
    expect(invalid('Email')).toBe(true);
    expect(invalid('Password')).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    expect(screen.getByRole('button', { name: 'Sign in' }).hasAttribute('disabled')).toBe(false);
    expect(posts(sent, '/api/auth/login')).toEqual([]);
  });

  it('refuses an address with no @ or no domain, with the same words as register', () => {
    const sent = watching();
    at('/sign-in');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'lagos-evenings' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();
    expect(posts(sent, '/api/auth/login')).toEqual([]);
  });

  it('clears a message once its field is right, and re-checks a field when it is left', () => {
    watching();
    at('/sign-in');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    expect(screen.queryByText('Enter your email address.')).toBeNull();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake' } });
    fireEvent.blur(screen.getByLabelText('Email'), { target: { value: 'folake' } });
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();
  });
});

describe('register checks before it sends', () => {
  it('names every missing field at once and sends nothing', () => {
    const sent = watching();
    at('/register');

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Enter your full name.')).toBeDefined();
    expect(screen.getByText('Enter your email address.')).toBeDefined();
    expect(screen.getByText('Enter a password.')).toBeDefined();
    expect(invalid('Full name')).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Full name'));
    expect(posts(sent, '/api/auth/register')).toEqual([]);
  });

  it('refuses an address that is not one', () => {
    const sent = watching();
    at('/register');

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Folake Ire' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake.ire.events' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'lagos-evenings' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    expect(posts(sent, '/api/auth/register')).toEqual([]);
  });
});

describe('verify email checks the code before it sends', () => {
  function enter(code: string) {
    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
  }

  it('asks for the code when there is none, and for six digits when it is short', () => {
    __setSessionState({ status: 'signedIn', session: UNVERIFIED });
    const sent = watching();
    at('/verify-email');

    enter('');
    expect(screen.getByText('Enter the 6-digit code from the email.')).toBeDefined();
    expect(invalid('Code from the email')).toBe(true);

    enter('1234');
    expect(screen.getByText('The code is 6 digits.')).toBeDefined();

    expect(posts(sent, '/api/auth/verify/email'), 'no request, so no attempt spent').toEqual([]);
  });

  it('takes the spaces out of a pasted code before checking and sending it', async () => {
    __setSessionState({ status: 'signedIn', session: UNVERIFIED });
    const sent = watching({
      'POST /api/auth/verify/email': () =>
        new Response(JSON.stringify({ verified: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    at('/verify-email');

    enter(' 184 231 ');

    await waitFor(() => expect(posts(sent, '/api/auth/verify/email')).toHaveLength(1));
    expect(posts(sent, '/api/auth/verify/email')[0]).toMatchObject({ body: { code: '184231' } });
  });
});
