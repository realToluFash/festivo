import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../session.ts';
import { routes } from '../index.tsx';

const FOLAKE: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: true,
  organisation: { id: 'acc_1', name: 'Ire Events' },
  organisations: [{ id: 'acc_1', name: 'Ire Events' }],
  permissions: ['events.view'],
};

function answering(answers: Record<string, () => Response>, seen: string[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const { pathname } = new URL(String(input));

    seen.push(`${init?.method ?? 'GET'} ${pathname}`);

    const answer = answers[`${init?.method ?? 'GET'} ${pathname}`];

    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return seen;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(code: string, status = 422, headers: Record<string, string> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status },
    status,
    headers,
  );
}

function open() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/verify-email'] })} />,
  );
}

function enter(code: string) {
  fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
}

beforeEach(() => {
  __setSessionState({ status: 'signedIn', session: FOLAKE });
});

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
});

describe('verifying an email address', () => {
  it('says where the code went, and asks for it', () => {
    answering({});

    open();

    expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeDefined();
    expect(screen.getByText(/folake@ire\.events/)).toBeDefined();
    expect(screen.getByLabelText('Code from the email')).toBeDefined();
  });

  it('shows both steps, with this one current and the next one not', () => {
    answering({});

    open();

    const steps = screen.getByRole('list', { name: 'Before you start' });

    expect(steps.textContent).toMatch(/Verify your email/);
    expect(steps.textContent).toMatch(/Your details/);
  });

  it('offers the code to a password manager as a one-time code', () => {
    answering({});

    open();

    expect(screen.getByLabelText('Code from the email').getAttribute('autocomplete')).toBe(
      'one-time-code',
    );
  });

  it('verifies, and then offers the way on', async () => {
    const seen = answering({
      'POST /api/auth/verify/email': () =>
        json({ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }),
    });

    open();
    enter('123456');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Email verified' })).toBeDefined(),
    );
    expect(screen.getByRole('link', { name: 'Continue' })).toBeDefined();
    expect(seen).toContain('POST /api/auth/verify/email');
  });

  it('marks the step done when it is', async () => {
    answering({
      'POST /api/auth/verify/email': () =>
        json({ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }),
    });

    open();
    enter('123456');

    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Before you start' }).textContent).toMatch(
        /Email verified · done/,
      ),
    );
  });

  it('marks the field and says what to check when the code is wrong', async () => {
    answering({ 'POST /api/auth/verify/email': () => problem('verification_code_invalid') });

    open();
    enter('000000');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/does not match/));
    expect(screen.getByLabelText('Code from the email').className).toMatch(/input-wrong/);
  });

  it('offers a new code when this one has expired', async () => {
    answering({ 'POST /api/auth/verify/email': () => problem('verification_code_expired') });

    open();
    enter('123456');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/has expired/));
    expect(screen.getAllByRole('button', { name: 'Send a new code' })).not.toEqual([]);
  });

  it('offers a new code after too many wrong tries', async () => {
    answering({ 'POST /api/auth/verify/email': () => problem('verification_code_exhausted') });

    open();
    enter('000000');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Too many wrong/));
  });

  it('counts down from the seconds the resend answered with', async () => {
    answering({ 'POST /api/auth/verify/resend': () => json({ cooldownSeconds: 42 }) });

    open();
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 0:42' })).toBeDefined(),
    );
    expect(
      screen.getByRole('button', { name: 'Send a new code in 0:42' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('counts down from the time left when the resend was too soon', async () => {
    answering({
      'POST /api/auth/verify/resend': () =>
        problem('too_many_attempts', 429, { 'Retry-After': '30' }),
    });

    open();
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 0:30' })).toBeDefined(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says plainly that a wrong address means signing out and registering again', () => {
    answering({});

    open();

    expect(screen.getByText(/Not your address\?/)).toBeDefined();
    expect(screen.getByText(/Signing out and registering again/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('sends somebody with no session to sign in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });

    open();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
  });
});
