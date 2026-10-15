import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';

const HERE = '018f3a4c-0001-7c3d-9e1f-2a3b4c5d6e7f';
const ELSEWHERE = '018f3a4c-0002-7c3d-9e1f-2a3b4c5d6e7f';

const SESSIONS = {
  sessions: [
    {
      id: HERE,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ipAddress: '102.89.33.14',
      startedAt: '2026-10-15T08:40:00+00:00',
      renewedAt: '2026-10-15T08:40:00+00:00',
      expiresAt: '2026-11-14T08:40:00+00:00',
    },
    {
      id: ELSEWHERE,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ipAddress: '197.210.78.3',
      startedAt: '2026-10-05T11:22:00+00:00',
      renewedAt: '2026-10-07T18:30:00+00:00',
      expiresAt: '2026-11-06T11:22:00+00:00',
    },
  ],
};

const FOLAKE: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: true,
  organisation: { id: 'acc_1', name: 'Ire Events' },
  organisations: [{ id: 'acc_1', name: 'Ire Events' }],
  permissions: ['events.view'],
};

interface Call {
  method: string;
  path: string;
}

function answering(answers: Record<string, () => Response>, calls: Call[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const { pathname } = new URL(String(input));
    const method = init?.method ?? 'GET';

    calls.push({ method, path: pathname });

    const answer = answers[`${method} ${pathname}`];

    if (answer == null) throw new Error(`Nothing stubbed for ${method} ${pathname}`);

    return answer();
  });

  return calls;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function openSecurity() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/account/security'] })}
    />,
  );
}

beforeEach(() => {
  __setSessionState({ status: 'signedIn', session: FOLAKE });
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: HERE });
});

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
  tokens.clear();
});

describe('the devices signed in to an account', () => {
  it('lists one row per session, named from the string each client sent', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on macOS')).toBeDefined());
    expect(screen.getByText('Chrome on Windows')).toBeDefined();
    expect(screen.getByText('2 devices')).toBeDefined();
  });

  it('shows the signed-in address from the session rather than a sample', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeDefined());

    const heading = screen.getByRole('heading', { level: 1 }).closest('.account-heading');

    expect(heading?.textContent).toMatch(/folake@ire\.events/);
  });

  it('says plainly that neither the name nor the address can be checked', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() =>
      expect(document.body.textContent).toMatch(/cannot check either, or tell where a device is/),
    );
  });

  it('marks this device with words and not only with a dot, and says it is in use', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());
    expect(screen.getByText(/In use now/)).toBeDefined();
  });

  it('tells another device when it was last used and when it expires', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText(/Last used/)).toBeDefined());

    const row = screen.getByText('Chrome on Windows').closest('li');

    expect(row?.textContent).toMatch(/if not used again/);
    expect(row?.textContent).toMatch(/197\.210\.78\.3/);
  });

  it('shows an unreadable user agent exactly as it arrived', async () => {
    answering({
      'GET /api/auth/sessions': () =>
        json({ sessions: [{ ...SESSIONS.sessions[0], userAgent: 'okhttp/4.12.0' }] }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('okhttp/4.12.0')).toBeDefined());
  });

  it('says so when a client gave no name and no address', async () => {
    answering({
      'GET /api/auth/sessions': () =>
        json({ sessions: [{ ...SESSIONS.sessions[0], userAgent: null, ipAddress: null }] }),
    });

    openSecurity();

    await waitFor(() =>
      expect(screen.getByText('A device that did not name itself')).toBeDefined(),
    );
    expect(screen.getByText(/an address it did not give/)).toBeDefined();
  });

  it('asks before ending another device, naming it and what follows', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));

    expect(screen.getByRole('heading', { name: 'Sign out Chrome on Windows?' })).toBeDefined();
    expect(screen.getByText(/Whoever has it is signed out/)).toBeDefined();
    expect(document.body.textContent).toMatch(/up to 15 minutes/);
    expect(document.body.textContent).toMatch(/change your password as well/);
  });

  it('leaves the list untouched when the check is declined', async () => {
    const calls = answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it signed in' }));

    expect(screen.getByText('Chrome on Windows')).toBeDefined();
    expect(calls.filter((call) => call.method === 'DELETE')).toEqual([]);
  });

  it('ends the named session, drops its row, and says the device may keep working', async () => {
    const calls = answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/is signed out/));
    expect(screen.getByRole('status').textContent).toMatch(/up to 15 minutes/);
    expect(screen.queryByText('Chrome on Windows')).toBeNull();
    expect(calls).toContainEqual({ method: 'DELETE', path: `/api/auth/sessions/${ELSEWHERE}` });
  });

  it('says nothing was changed when ending one fails', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () =>
        json({ type: 'https://soirely.com/errors/not_found', title: 'Gone.', status: 404 }, 404),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/was not signed out/),
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Nothing has changed/);
  });

  it('signs this device out without asking, and lands on sign-in', async () => {
    const calls = answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());
    fireEvent.click(endOf('Chrome on macOS'));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(calls).toContainEqual({ method: 'POST', path: '/api/auth/logout' });
  });

  it('offers a retry when the list cannot be loaded, and says what it is about', async () => {
    let attempts = 0;

    answering({
      'GET /api/auth/sessions': () => {
        attempts += 1;

        return attempts === 1
          ? json({ type: 'x', title: 'No.', status: 500 }, 500)
          : json(SESSIONS);
      },
    });

    openSecurity();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be/));
    expect(screen.getByRole('alert').textContent).toMatch(/rather than about your account/);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Chrome on macOS')).toBeDefined());
  });

  it('never claims that any of this is immediate', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    await waitFor(() => expect(screen.getByRole('status')).toBeDefined());
    expect(document.body.textContent).not.toMatch(/immediate/i);
  });
});

function endOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  const button = row?.querySelector('button');

  if (button == null) throw new Error(`No sign-out control in the row for ${name}.`);

  return button;
}
