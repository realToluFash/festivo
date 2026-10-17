import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';
import { membership } from '../../../test-memberships.ts';

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

const MEMBERSHIP = membership({ id: 'acc_1', name: 'Ire Events' });

const FOLAKE: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  timezone: null,
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

    // The two-factor card asks for its state on every visit; these tests are about devices.
    const answer =
      answers[`${method} ${pathname}`] ??
      (`${method} ${pathname}` === 'GET /api/auth/two-factor'
        ? () => json({ on: false, recoveryCodesLeft: 0 })
        : null);

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

  it('lists this device first, even when another signed in after it', async () => {
    answering({
      'GET /api/auth/sessions': () => json({ sessions: [...SESSIONS.sessions].reverse() }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());

    const [first] = screen
      .getByRole('list', { name: 'Devices signed in to this account' })
      .querySelectorAll('li');

    expect(first?.textContent).toMatch(/This device/);
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

  it('takes the devices card off the page while two-factor is being set up', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/two-factor/enrol': () =>
        json({
          secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          otpauthUri: 'otpauth://totp/Soirely:folake@ire.events?secret=JBSW&issuer=Soirely',
          qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }));
    await screen.findByRole('heading', { name: 'Turn on two-factor authentication' });

    // Absent, not merely hidden: a `.card` sets its own display, which beats `hidden`.
    await waitFor(() => expect(document.getElementById('devices-title')).toBeNull());
  });
});

describe('changing the password', () => {
  function fillIn(current: string, next: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
  }

  it('comes first on the page, and says what changing it does', () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Password');
    expect(
      screen.getByText(
        'Used with your email to sign in. Changing it signs out your other devices; this one stays signed in.',
      ),
    ).toBeDefined();
  });

  it('sends the current and the new password with this session, then says how many were signed out', async () => {
    let sent: unknown = null;
    const calls = answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'PATCH /api/auth/password': () => json({ signedOut: 2 }),
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const { pathname } = new URL(String(input));
      calls.push({ method: init?.method ?? 'GET', path: pathname });
      if (pathname === '/api/auth/password') {
        sent = JSON.parse(String(init?.body));
        return json({ signedOut: 2 });
      }
      if (pathname === '/api/auth/two-factor') return json({ on: false, recoveryCodesLeft: 0 });
      return json(SESSIONS);
    });

    openSecurity();
    fillIn('the old passphrase', 'a brand new passphrase');

    await waitFor(() =>
      expect(
        screen.getByText(
          'Password changed. Your 2 other devices are signed out; they may keep working for up to 15 minutes while that reaches them, then they have to sign in again.',
        ),
      ).toBeDefined(),
    );
    expect(sent).toEqual({
      currentPassword: 'the old passphrase',
      newPassword: 'a brand new passphrase',
      sessionId: HERE,
    });
    expect(calls.filter((call) => call.path === '/api/auth/sessions').length).toBe(2);
  });

  it('checks both fields and the length before sending anything', () => {
    const calls = answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();
    fillIn('', '');

    expect(screen.getByText('Enter your current password.')).toBeDefined();
    expect(screen.getByText('Enter a new password.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old one' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'too short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('says a wrong current password is wrong, under that field', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'PATCH /api/auth/password': () =>
        json(
          { type: 'https://soirely.com/errors/invalid_credentials', title: 'No', status: 401 },
          401,
        ),
    });

    openSecurity();
    fillIn('not the password', 'a brand new passphrase');

    await waitFor(() =>
      expect(
        screen.getByText('That is not your current password. Try again, or reset it by email.'),
      ).toBeDefined(),
    );
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true');
  });

  it('says the same password is already the password, under the new one', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'PATCH /api/auth/password': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'No',
            status: 422,
            violations: [
              { propertyPath: 'newPassword', message: 'Same.', code: 'password_unchanged' },
            ],
          },
          422,
        ),
    });

    openSecurity();
    fillIn('the old passphrase', 'the old passphrase');

    await waitFor(() =>
      expect(
        screen.getByText('That is already your password. Choose a different one.'),
      ).toBeDefined(),
    );
  });

  it('says until when it is paused, and that nothing changed', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'PATCH /api/auth/password': () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/too_many_attempts',
            title: 'No',
            status: 429,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '600' },
          },
        ),
    });

    openSecurity();
    fillIn('not the password', 'a brand new passphrase');

    await waitFor(() => expect(screen.getByText('Too many tries')).toBeDefined());
    expect(screen.getByText(/^Try again at .+\. Nothing was changed\.$/)).toBeDefined();
  });

  it('offers a Google-only account a password, and says why', () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: ['google'] },
    });
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    expect(
      screen.getByText(
        'You sign in with Google. Add a password so you can also sign in with your email if you ever lose that Google account.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Set a password' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change password' })).toBeNull();
  });
});

describe('adding a password to a Google account', () => {
  beforeEach(() => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: ['google'] },
    });
  });

  it('sends a code, takes it, then the password, and comes back as a password account', async () => {
    const calls = answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
      'POST /api/auth/password/set/code': () => json({ stepUp: 'the-step-up' }),
      'POST /api/auth/password/set': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () =>
        json({
          id: 'acc_1',
          name: 'Folake Ire',
          businessName: null,
          countryCode: null,
          locale: 'en',
          timezone: null,
          verified: true,
          complete: true,
          needsOrganisation: false,
          hasPassword: true,
          providers: ['google'],
          emailAddresses: [
            { id: 'a1', address: 'folake@ire.events', verified: true, primary: true },
          ],
          phoneNumbers: [],
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });

    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Set a password' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 1:00' })).toBeDefined(),
    );
    expect(
      screen.getByText("We sent a 6-digit code to folake@ire.events to make sure it's you."),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Choose a password' })).toBeDefined(),
    );
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    await waitFor(() =>
      expect(
        screen.getByText('Password added. You can sign in with it or with Google.'),
      ).toBeDefined(),
    );
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDefined();
    expect(calls.filter((call) => call.path === '/api/auth/password/set/start')).toHaveLength(1);
  });

  it('checks the code before sending it, and says a wrong one is wrong', async () => {
    const calls = answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
      'POST /api/auth/password/set/code': () =>
        json(
          {
            type: 'https://soirely.com/errors/verification_code_invalid',
            title: 'No',
            status: 422,
          },
          422,
        ),
    });

    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Set a password' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter the 6-digit code from the email.')).toBeDefined();
    expect(calls.some((call) => call.path === '/api/auth/password/set/code')).toBe(false);

    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'That code did not match. Check the newest email from Soirely and try again.',
        ),
      ).toBeDefined(),
    );
  });
});

function endOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  const button = row?.querySelector('button');

  if (button == null) throw new Error(`No sign-out control in the row for ${name}.`);

  return button;
}
