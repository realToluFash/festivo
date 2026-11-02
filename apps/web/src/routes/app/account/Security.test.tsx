import { act, render, screen, waitFor, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { renderInterrupted } from '../../../test-interrupted.tsx';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';
import { membership } from '../../../test-memberships.ts';

const HERE = '018f3a4c-0001-7c3d-9e1f-2a3b4c5d6e7f';
const ELSEWHERE = '018f3a4c-0002-7c3d-9e1f-2a3b4c5d6e7f';

const SESSIONS = {
  sessions: [
    {
      id: HERE,
      thisDevice: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ipAddress: '102.89.33.14',
      startedAt: '2026-10-15T08:40:00+00:00',
      renewedAt: '2026-10-15T08:40:00+00:00',
      expiresAt: '2026-11-14T08:40:00+00:00',
    },
    {
      id: ELSEWHERE,
      thisDevice: false,
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
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  organisationCountry: null,
  timezone: null,
  waitingFor: null,
};

interface Call {
  method: string;
  path: string;
}

function answering(
  answers: Record<string, () => Response | Promise<Response>>,
  calls: Call[] = [],
) {
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

/** The Password row alone: the last way in offers Set a password too. */
function passwordRow() {
  return within(screen.getAllByRole('listitem')[0]!);
}

function openSecurity() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/account/security'] })}
    />,
  );
}

const scrolled = vi.fn();

beforeEach(() => {
  scrolled.mockClear();
  Element.prototype.scrollIntoView = scrolled;
  __setSessionState({ status: 'signedIn', session: FOLAKE });
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: HERE });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
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

  it("names the app's own sessions by device, without a version", async () => {
    answering({
      'GET /api/auth/sessions': () =>
        json({
          sessions: [{ ...SESSIONS.sessions[0], userAgent: 'Soirely/1.4.0 (iPadOS 18.1; iPad)' }],
        }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Soirely app on iPad')).toBeDefined());
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

  it('ends Sign out with an ellipsis only where it asks first (sc-23282)', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    expect(endOf('Chrome on Windows').textContent).toBe('Sign out…');
    expect(endOf('This device').textContent).toBe('Sign out');
  });

  it('asks before ending another device, naming it and what follows', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Sign out Chrome on Windows?' }),
    );
    expect(screen.getByText(/Whoever has it is signed out/)).toBeDefined();
    expect(document.body.textContent).toMatch(/has to sign in again before it can carry on/);
    expect(document.body.textContent).toMatch(/change your password as well/);
    expect(document.body.textContent).not.toMatch(/15 minutes/);
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

  it('ends the named session, drops its row, and says it is signed out', async () => {
    const calls = answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toMatch(/Chrome on Windows is signed out\.$/),
    );
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

    await waitFor(() => expect(document.activeElement?.textContent).toMatch(/was not signed out/));
    expect(document.activeElement?.textContent).toMatch(/check the list afterwards\.$/);
    expect(screen.queryByRole('alert')).toBeNull();
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

  it('keeps this device signed in, and says so, when its sign-out cannot reach Soirely', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());
    const button = endOf('Chrome on macOS');
    button.focus();
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/You are still signed in/),
    );
    expect(screen.getByRole('alert').textContent).toMatch(/this device was not signed out/);
    expect(document.activeElement).toBe(button);
    await waitFor(() => expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' }));
    expect(screen.getByText('This device')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    expect(tokens.access()).toBe('live');
  });

  it("counts an error of Soirely on this device's sign-out as not reached", async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/logout': () => new Response(null, { status: 500 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());
    fireEvent.click(endOf('Chrome on macOS'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/You are still signed in/),
    );
    expect(tokens.access()).toBe('live');
  });

  it('shows one notice at a time, the newer in place of the older', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () =>
        json({ type: 'https://soirely.com/errors/not_found', title: 'Gone.', status: 404 }, 404),
      'POST /api/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));
    await waitFor(() =>
      expect(document.activeElement?.textContent).toMatch(/That device was not signed out/),
    );

    fireEvent.click(endOf('Chrome on macOS'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/You are still signed in/),
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('That device was not signed out')).toBeNull();
  });

  it('takes the notice away while a second press tries, and says it again when that fails too', async () => {
    let fail: (() => void) | null = null;
    let presses = 0;
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/logout': () => {
        presses += 1;
        if (presses === 1) throw new TypeError('Failed to fetch');

        return new Promise<Response>((_, reject) => {
          fail = () => reject(new TypeError('Failed to fetch'));
        });
      },
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());
    fireEvent.click(endOf('Chrome on macOS'));
    const first = await screen.findByRole('alert');
    scrolled.mockClear();

    fireEvent.click(endOf('Chrome on macOS'));

    await waitFor(() => expect(fail).not.toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();

    fail!();

    const second = await screen.findByRole('alert');
    expect(second.textContent).toMatch(/You are still signed in/);
    expect(second).not.toBe(first);
    await waitFor(() => expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' }));
  });

  it("keeps one answer per press, dropping another device's sign-out once this one's fails", async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
      'POST /api/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));
    await waitFor(() => expect(screen.getByText('Chrome on Windows is signed out.')).toBeDefined());

    fireEvent.click(endOf('Chrome on macOS'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/You are still signed in/),
    );
    expect(screen.queryByText('Chrome on Windows is signed out.')).toBeNull();
  });

  it('signs out on the next press once Soirely answers', async () => {
    let offline = true;
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/logout': () => {
        if (offline) throw new TypeError('Failed to fetch');

        return new Response(null, { status: 204 });
      },
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('This device')).toBeDefined());
    fireEvent.click(endOf('Chrome on macOS'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());

    offline = false;
    fireEvent.click(endOf('Chrome on macOS'));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(tokens.access()).toBeNull();
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

    const words = screen.getByText('The devices could not be listed').parentElement;
    const retry = screen.getByRole('button', { name: 'Try again' });

    expect(words?.nextElementSibling).toBe(retry);
    expect(retry.parentElement?.className).toBe('notice-body');

    fireEvent.click(retry);

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

    await waitFor(() => expect(document.activeElement?.className).toBe('status-done'));
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

  it('leaves focus where it is when the card comes back still asking about a device', async () => {
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
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }));
    await screen.findByRole('heading', { name: 'Turn on two-factor authentication' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const check = await screen.findByRole('heading', { name: 'Sign out Chrome on Windows?' });

    expect(document.activeElement).not.toBe(check);
  });
});

describe('signing out everywhere else', () => {
  const THIRD = '018f3a4c-0003-7c3d-9e1f-2a3b4c5d6e7f';
  const THREE = {
    sessions: [
      ...SESSIONS.sessions,
      {
        id: THIRD,
        thisDevice: false,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        ipAddress: '105.112.4.9',
        startedAt: '2026-10-12T09:00:00+00:00',
        renewedAt: '2026-10-16T21:10:00+00:00',
        expiresAt: '2026-11-11T09:00:00+00:00',
      },
    ],
  };

  interface Sent {
    call: string;
    body: unknown;
  }

  function stub(answers: Record<string, () => Response>, twoFactorOn = false): Sent[] {
    const sent: Sent[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

      const fallback: Record<string, () => Response> = {
        'GET /api/auth/sessions': () =>
          sent.some((entry) => entry.call === 'POST /api/auth/sessions/others')
            ? json({ sessions: [SESSIONS.sessions[0]] })
            : json(THREE),
        'GET /api/auth/two-factor': () => json({ on: twoFactorOn, recoveryCodesLeft: 10 }),
      };
      const answer = answers[call] ?? fallback[call];
      if (answer == null) throw new Error(`Nothing stubbed for ${call}`);

      return answer();
    });

    return sent;
  }

  function problem(code: string, status: number, headers: Record<string, string> = {}): Response {
    return new Response(
      JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
      { status, headers: { 'Content-Type': 'application/problem+json', ...headers } },
    );
  }

  async function openCheck(): Promise<void> {
    openSecurity();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere else…' }));
    await screen.findByRole('heading', { name: 'Sign out everywhere else?' });
  }

  function password(): HTMLInputElement {
    return screen.getByLabelText('Your password');
  }

  it('ends the devices card with the action while another device is listed', async () => {
    stub({});

    openSecurity();

    expect(await screen.findByRole('button', { name: 'Sign out everywhere else…' })).toBeDefined();
    expect(
      screen.getByText('Every device except this one. Asks you to confirm it is you first.'),
    ).toBeDefined();
  });

  it('is not offered when this device is the only one', async () => {
    stub({ 'GET /api/auth/sessions': () => json({ sessions: [SESSIONS.sessions[0]] }) });

    openSecurity();

    await screen.findByText('This device');
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else…' })).toBeNull();
  });

  it('asks for the password, counts the others, and says they are signed out at once', async () => {
    stub({});

    await openCheck();

    expect(document.body.textContent).toMatch(
      'This signs out your 2 other devices, whoever has them. This device stays signed in.',
    );
    expect(
      screen.getByText('So that nobody who picks up this device can do this without you.'),
    ).toBeDefined();
    expect(screen.getByText('Whoever has them is signed out')).toBeDefined();
    expect(screen.getByText('They have to sign in again before they can carry on.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign them out' })).toBeDefined();
    expect(document.body.textContent).not.toMatch(/15 minutes|immediate/i);
  });

  it('puts the dismissive button before the confirming one', async () => {
    stub({});

    await openCheck();
    const keep = screen.getByRole('button', { name: 'Keep them signed in' });
    const signOut = screen.getByRole('button', { name: 'Sign them out' });

    expect(keep.compareDocumentPosition(signOut)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps every device when the check is declined', async () => {
    const sent = stub({});

    await openCheck();
    fireEvent.click(screen.getByRole('button', { name: 'Keep them signed in' }));

    expect(await screen.findByText('Chrome on Windows')).toBeDefined();
    expect(sent.filter((entry) => entry.call.startsWith('POST'))).toEqual([]);
  });

  it('sends nothing without a password', async () => {
    const sent = stub({});

    await openCheck();
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    expect(await screen.findByText('Enter your password.')).toBeDefined();
    expect(sent.filter((entry) => entry.call.startsWith('POST'))).toEqual([]);
  });

  it('proves it is you, keeps this session, and says how many were signed out', async () => {
    const sent = stub({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '2026-10-17T12:05:00+00:00' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toMatch('Your 2 other devices are signed out.'),
    );
    expect(sent.filter((entry) => entry.call.startsWith('POST'))).toEqual([
      { call: 'POST /api/auth/proof', body: { password: 'a decent passphrase' } },
      { call: 'POST /api/auth/sessions/others', body: { proof: 'p-1', sessionId: HERE } },
    ]);
    expect(await screen.findByText('Chrome on macOS')).toBeDefined();
    expect(screen.queryByText('Chrome on Windows')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else…' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/15 minutes/);
  });

  it('keeps this device and counts it alone when a refresh renewed its id while the step was open', async () => {
    const sent = stub({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    await openCheck();
    tokens.save({
      accessToken: 'renewed',
      refreshExpiresAt: '',
      sessionId: '018f3a4c-0009-7c3d-9e1f-2a3b4c5d6e7f',
    });
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    expect(await screen.findByText('Your 2 other devices are signed out.')).toBeDefined();
    expect(await screen.findByText('1 device')).toBeDefined();
    expect(screen.getByText('This device')).toBeDefined();
    expect(sent.find((entry) => entry.call === 'POST /api/auth/sessions/others')?.body).toEqual({
      proof: 'p-1',
      sessionId: HERE,
    });
  });

  it('still says they are signed out when the list cannot be read again, and lists this device on a retry', async () => {
    let failing = true;
    const sent = stub({
      'GET /api/auth/sessions': () =>
        !sent.some((entry) => entry.call === 'POST /api/auth/sessions/others')
          ? json(THREE)
          : failing
            ? new Response(null, { status: 503 })
            : json({ sessions: [SESSIONS.sessions[0]] }),
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    expect(await screen.findByText('The devices could not be listed')).toBeDefined();
    expect(screen.getByText('Your 2 other devices are signed out.')).toBeDefined();
    expect(screen.queryByText('0 devices')).toBeNull();

    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('1 device')).toBeDefined();
    expect(screen.getByText('This device')).toBeDefined();
  });

  it('reads the failed list after the success, as a status already waiting on the page', async () => {
    let answer: (response: Response) => void = () => {};
    const sent = stub({
      'GET /api/auth/sessions': () =>
        !sent.some((entry) => entry.call === 'POST /api/auth/sessions/others')
          ? json(THREE)
          : (new Promise<Response>((resolve) => {
              answer = resolve;
            }) as unknown as Response),
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('✓Your 2 other devices are signed out.'),
    );
    const waiting = screen.getAllByRole('status').find((status) => status.textContent === '');
    expect(waiting).toBeDefined();

    answer(new Response(null, { status: 503 }));

    await waitFor(() => expect(waiting?.textContent).toMatch('The devices could not be listed'));
    expect(screen.getByRole('status')).toBe(waiting);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement?.textContent).toBe('✓Your 2 other devices are signed out.');
  });

  it('says so when there was nothing left to sign out', async () => {
    stub({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 0, thisDevice: false }),
    });

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toMatch('No other devices were signed in.'),
    );
  });

  it('says a wrong password is wrong, and signs nobody out', async () => {
    const sent = stub({ 'POST /api/auth/proof': () => problem('invalid_credentials', 401) });

    await openCheck();
    fireEvent.change(password(), { target: { value: 'not it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    expect(
      await screen.findByText('That is not your password. Try again, or reset it by email.'),
    ).toBeDefined();
    expect(sent.map((entry) => entry.call)).not.toContain('POST /api/auth/sessions/others');
  });

  it('says until when it is paused, and that nothing was signed out', async () => {
    stub({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () =>
        problem('too_many_attempts', 429, { 'Retry-After': '600' }),
    });

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Too many tries/));
    expect(screen.getByRole('alert').textContent).toMatch(
      /Try again at .+\. Nothing was signed out\./,
    );
    const paused = screen.getByRole('button', { name: /^Try again at / });
    expect(paused.getAttribute('aria-disabled')).toBe('true');
  });

  it('asks for the code as well when two-factor is on', async () => {
    const sent = stub(
      {
        'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
        'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
      },
      true,
    );

    await openCheck();
    const code = await screen.findByLabelText('Code');
    expect(
      screen.getByText(
        'From your authenticator app, or one of your recovery codes. Two-factor protects this the way it protects signing in.',
      ),
    ).toBeDefined();

    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));
    expect(
      await screen.findByText('Enter a code from your app, or a recovery code.'),
    ).toBeDefined();
    expect(sent.filter((entry) => entry.call.startsWith('POST'))).toEqual([]);

    fireEvent.change(code, { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    await waitFor(() => expect(document.activeElement?.className).toBe('status-done'));
    expect(sent.find((entry) => entry.call === 'POST /api/auth/proof')?.body).toEqual({
      password: 'a decent passphrase',
      code: 'abcd-efgh',
    });
  });

  it('counts the recovery code it spent on the two-factor card, without leaving the page', async () => {
    let left = 9;
    stub(
      {
        'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: left }),
        'POST /api/auth/proof': () => {
          left = 8;

          return json({ proof: 'p-1', expiresAt: '' });
        },
        'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
      },
      true,
    );

    await openCheck();
    expect(await screen.findByText('9 of 10 unused · each works once')).toBeDefined();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    expect(await screen.findByText('8 of 10 unused · each works once')).toBeDefined();
  });

  it('leaves the count as it was when the code is refused', async () => {
    const sent = stub(
      {
        'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 9 }),
        'POST /api/auth/proof': () => problem('two_factor_code_invalid', 422),
      },
      true,
    );

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '000000' } });
    const asked = () => sent.filter((entry) => entry.call === 'GET /api/auth/two-factor').length;
    const before = asked();
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    await screen.findByText(
      'That code did not work. Enter the code your app shows now, or an unused recovery code.',
    );
    expect(screen.getByText('9 of 10 unused · each works once')).toBeDefined();
    expect(asked()).toBe(before);
  });

  it('says a wrong code is wrong, under the code', async () => {
    stub({ 'POST /api/auth/proof': () => problem('two_factor_code_invalid', 422) }, true);

    await openCheck();
    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign them out' }));

    expect(
      await screen.findByText(
        'That code did not work. Enter the code your app shows now, or an unused recovery code.',
      ),
    ).toBeDefined();
  });

  it('sends a Google-only account to Google instead', async () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: [{ provider: 'google', email: null }] },
    });
    stub({});

    await openCheck();

    expect(
      screen.getByText('You sign in with Google, so confirm with Google instead.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.queryByLabelText('Your password')).toBeNull();
  });

  it('back from Google, proves with what Google sent and signs the others out', async () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: [{ provider: 'google', email: null }] },
    });
    const signIn = { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' };
    sessionStorage.setItem(
      'soirely.provider.returned',
      JSON.stringify({ provider: 'google', purpose: { kind: 'signOutOthers' }, signIn }),
    );
    const sent = stub({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    openSecurity();

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(
        'Your 2 other devices are signed out.',
      ),
    );
    expect(document.activeElement).toBe(document.body);
    expect(sent.filter((entry) => entry.call.startsWith('POST'))).toEqual([
      { call: 'POST /api/auth/proof', body: { provider: 'google', providerSignIn: signIn } },
      { call: 'POST /api/auth/sessions/others', body: { proof: 'p-1', sessionId: HERE } },
    ]);
    sessionStorage.clear();
  });

  it('back from Google, reads the success and then the failed list, both as statuses', async () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: [{ provider: 'google', email: null }] },
    });
    const signIn = { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' };
    sessionStorage.setItem(
      'soirely.provider.returned',
      JSON.stringify({ provider: 'google', purpose: { kind: 'signOutOthers' }, signIn }),
    );
    const sent = stub({
      'GET /api/auth/sessions': () =>
        sent.some((entry) => entry.call === 'POST /api/auth/sessions/others')
          ? new Response(null, { status: 503 })
          : json(THREE),
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    const heard: string[][] = [];
    const listening = new MutationObserver(() => {
      heard.push(screen.queryAllByRole('status').map((status) => status.textContent ?? ''));
    });
    listening.observe(document.body, { childList: true, subtree: true, characterData: true });

    openSecurity();

    await waitFor(() =>
      expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual([
        '✓Your 2 other devices are signed out.',
        expect.stringContaining('The devices could not be listed'),
      ]),
    );
    listening.disconnect();
    const failedYet = (statuses: string[]) =>
      statuses.some((words) => words.includes('The devices could not be listed'));
    expect(heard.some((statuses) => statuses[0] === '' && !failedYet(statuses))).toBe(true);
    expect(heard.filter((statuses) => statuses[0] === '' && failedYet(statuses))).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
    sessionStorage.clear();
  });

  it('signs the others out once, back from Google, when React abandons the render it arrives in', async () => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: [{ provider: 'google', email: null }] },
    });
    const signIn = { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' };
    const returned = JSON.stringify({
      provider: 'google',
      purpose: { kind: 'signOutOthers' },
      signIn,
    });
    sessionStorage.setItem('soirely.provider.returned', returned);
    const sent = stub({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 2, thisDevice: false }),
    });

    const { release } = await renderInterrupted(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/account/security'] })}
      />,
    );
    expect(
      sessionStorage.getItem('soirely.provider.returned'),
      'an abandoned render leaves it in place',
    ).toBe(returned);

    await release();

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(
        'Your 2 other devices are signed out.',
      ),
    );
    expect(document.activeElement).toBe(document.body);
    expect(sent.filter((entry) => entry.call === 'POST /api/auth/sessions/others')).toHaveLength(1);
    expect(sessionStorage.getItem('soirely.provider.returned')).toBeNull();
  });

  it('without this device in the list, says it signs out all of them and lands on sign-in', async () => {
    const sent = stub({
      'GET /api/auth/sessions': () =>
        json({ sessions: THREE.sessions.map((session) => ({ ...session, thisDevice: false })) }),
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 3, thisDevice: true }),
    });

    await openCheck();
    expect(document.body.textContent).toMatch(
      'Soirely cannot tell which of these is this device, so this signs out all 3, including this one. You will sign in again straight after.',
    );

    fireEvent.change(password(), { target: { value: 'a decent passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out all 3' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
    expect(sent.find((entry) => entry.call === 'POST /api/auth/sessions/others')?.body).toEqual({
      proof: 'p-1',
      sessionId: null,
    });
  });
});

describe('changing the password', () => {
  function fillIn(current: string, next: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
  }

  it('is the first row of the first card, and says what changing it does', () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Ways to sign in');
    expect(passwordRow().getByText('Password')).toBeDefined();
    expect(
      passwordRow().getByText(
        'Used with your email to sign in. Changing it signs out your other devices; this one stays signed in.',
      ),
    ).toBeDefined();
    expect(passwordRow().getByRole('button', { name: 'Change password' })).toBeDefined();
  });

  it('names Your account in the back control of Reset your password, and goes back to it (sc-23279)', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });
    openSecurity();

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.click(screen.getByRole('link', { name: 'Forgot it?' }));
    await screen.findByRole('heading', { level: 1, name: 'Reset your password' });

    expect(screen.queryByRole('button', { name: 'Back to sign in' })).toBeNull();
    const back = screen.getByRole('button', { name: 'Your account' });
    expect(back.textContent).toBe('‹Your account');
    fireEvent.click(back);

    expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeDefined();
  });

  it('takes focus to Change your password when it opens', () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });
    openSecurity();

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Change your password' }),
    );
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
        screen.getByText('Password changed. Your 2 other devices are signed out.'),
      ).toBeDefined(),
    );
    expect(sent).toEqual({
      currentPassword: 'the old passphrase',
      newPassword: 'a brand new passphrase',
      sessionId: HERE,
    });
    await waitFor(() =>
      expect(calls.filter((call) => call.path === '/api/auth/sessions').length).toBe(2),
    );
  });

  it('reads the whole Password changed line before the devices that failed to load', async () => {
    let saved = false;
    answering({
      'GET /api/auth/sessions': () =>
        saved ? new Response(null, { status: 503 }) : json(SESSIONS),
      'PATCH /api/auth/password': () => {
        saved = true;

        return json({ signedOut: 1 });
      },
    });

    openSecurity();
    fillIn('the old passphrase', 'a brand new passphrase');

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch('The devices could not be listed'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement?.textContent).toBe(
      '✓Password changed. Your other device is signed out.',
    );
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

  it('keeps focus in New password while it saves after Enter, then moves it to a refused Current password (sc-11588)', async () => {
    let answer: (response: Response) => void = () => {};
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'PATCH /api/auth/password': () => new Promise<Response>((resolve) => (answer = resolve)),
    });

    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'not the password' },
    });
    const next = screen.getByLabelText<HTMLInputElement>('New password');
    fireEvent.change(next, { target: { value: 'a brand new passphrase' } });
    next.focus();
    fireEvent.submit(next);

    await waitFor(() => expect(next.readOnly).toBe(true));
    expect(document.activeElement).toBe(next);

    answer(
      json(
        { type: 'https://soirely.com/errors/invalid_credentials', title: 'No', status: 401 },
        401,
      ),
    );

    expect(
      await screen.findByText(
        'That is not your current password. Try again, or reset it by email.',
      ),
    ).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Current password'));
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
      session: { ...FOLAKE, hasPassword: false, providers: [{ provider: 'google', email: null }] },
    });
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    expect(
      screen.getByText(
        'You sign in with Google. Add a password so you can also sign in with your email if you ever lose that Google account.',
      ),
    ).toBeDefined();
    expect(passwordRow().getByRole('button', { name: 'Set a password' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change password' })).toBeNull();
  });
});

describe('adding a password to a Google account', () => {
  beforeEach(() => {
    __setSessionState({
      status: 'signedIn',
      session: { ...FOLAKE, hasPassword: false, providers: [{ provider: 'google', email: null }] },
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
          organisationCountry: null,
          locale: 'en',
          timezone: null,
          waitingFor: null,
          verified: true,
          complete: true,
          userId: 'u1',
          needsOrganisation: false,
          hasPassword: true,
          providers: [{ provider: 'google', email: null }],
          emailAddresses: [
            { id: 'a1', address: 'folake@ire.events', verified: true, primary: true },
          ],
          phoneNumbers: [],
        }),
      'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
    });

    openSecurity();
    fireEvent.click(passwordRow().getByRole('button', { name: 'Set a password' }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Check your email' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 1:00' })).toBeDefined(),
    );
    expect(
      screen.getByText("We sent a 6-digit code to folake@ire.events to make sure it's you."),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Choose a password' }),
      ),
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

  it('reads the countdown once after Send a new code, and not as the code step opens', async () => {
    let starts = 0;
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/password/set/start': () => json({ cooldownSeconds: ++starts === 1 ? 1 : 60 }),
    });
    const said = () => screen.queryAllByRole('status').map(({ textContent }) => textContent);

    openSecurity();
    fireEvent.click(passwordRow().getByRole('button', { name: 'Set a password' }));

    expect(await screen.findByRole('button', { name: 'Send a new code in 0:01' })).toBeDefined();
    expect(said()).not.toContain('Send a new code in 0:01');

    const resend = await screen.findByRole(
      'button',
      { name: 'Send a new code' },
      { timeout: 2000 },
    );
    resend.focus();
    fireEvent.click(resend);

    expect(await screen.findByRole('button', { name: 'Send a new code in 1:00' })).toBeDefined();
    expect(said()).toContain('Send a new code in 1:00');
    expect(document.activeElement).toBe(resend);
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
    fireEvent.click(passwordRow().getByRole('button', { name: 'Set a password' }));
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

describe('where focus carries on (sc-11369)', () => {
  const ME = {
    id: 'acc_1',
    name: 'Folake Ire',
    businessName: null,
    countryCode: null,
    organisationCountry: null,
    locale: 'en',
    timezone: null,
    waitingFor: null,
    verified: true,
    complete: true,
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    providers: [{ provider: 'google', email: null }],
    emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
    phoneNumbers: [],
  };

  function problem(code: string, status: number): Response {
    return new Response(
      JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }

  it('goes back to Sign out beside the device kept signed in, then to the line saying it is signed out', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it signed in' }));

    expect(document.activeElement).toBe(endOf('Chrome on Windows'));

    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('✓Chrome on Windows is signed out.'),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('goes to Signed in on when the device kept signed in has gone from the list meanwhile', async () => {
    let lists = 0;
    answering({
      'GET /api/auth/sessions': () =>
        json(++lists === 1 ? SESSIONS : { sessions: [SESSIONS.sessions[0]] }),
      'PATCH /api/auth/password': () => json({ signedOut: 1 }),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());
    fireEvent.click(endOf('Chrome on Windows'));
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old one' } });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(lists).toBe(2));
    await screen.findByText('Password changed. Your other device is signed out.');

    fireEvent.click(screen.getByRole('button', { name: 'Keep it signed in' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Signed in on' }),
      ),
    );
  });

  it('goes back to Sign out everywhere else when that check is declined', async () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });

    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere else…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it signed in' }));

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Sign out everywhere else…' }),
    );
  });

  it('takes focus to the line saying the others are signed out', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 1, thisDevice: false }),
    });

    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere else…' }));
    fireEvent.change(await screen.findByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign it out' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('✓Your other device is signed out.'),
    );
  });

  it('takes Try again to Signed in on once the list loads, and to the notice when it fails again', async () => {
    let failing = true;
    answering({
      'GET /api/auth/sessions': () =>
        failing ? json({ type: 'x', title: 'No.', status: 500 }, 500) : json(SESSIONS),
    });

    openSecurity();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be/));
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        'The devices could not be listedThis is about reaching the API rather than about your account. Nothing has changed.',
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();

    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Signed in on' }),
      ),
    );
    expect(screen.getByText('Chrome on Windows')).toBeDefined();
  });

  it('goes back to Change password after Cancel', () => {
    answering({ 'GET /api/auth/sessions': () => json(SESSIONS) });
    openSecurity();

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change password' }));
  });

  it('takes Save new password to the line saying what it did, read once', async () => {
    answering({
      'GET /api/auth/sessions': () => json(SESSIONS),
      'PATCH /api/auth/password': () => json({ signedOut: 0 }),
    });
    openSecurity();

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old one' } });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        '✓Password changed. No other device was signed in.',
      ),
    );
    expect(
      within(screen.getByRole('region', { name: 'Ways to sign in' })).queryByRole('status'),
    ).toBeNull();
  });

  describe('on an account with Google and no password', () => {
    beforeEach(() => {
      __setSessionState({
        status: 'signedIn',
        session: {
          ...FOLAKE,
          hasPassword: false,
          providers: [{ provider: 'google', email: null }],
        },
      });
    });

    it("goes back to the Password row's Set a password after Cancel", async () => {
      answering({
        'GET /api/auth/sessions': () => json(SESSIONS),
        'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
      });
      openSecurity();

      fireEvent.click(passwordRow().getByRole('button', { name: 'Set a password' }));
      await screen.findByRole('button', { name: 'Send a new code in 1:00' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(document.activeElement).toBe(
        passwordRow().getByRole('button', { name: 'Set a password' }),
      );
    });

    it('takes Save password to the line saying it was added', async () => {
      answering({
        'GET /api/auth/sessions': () => json(SESSIONS),
        'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
        'POST /api/auth/password/set/code': () => json({ stepUp: 'the-step-up' }),
        'POST /api/auth/password/set': () => new Response(null, { status: 204 }),
        'GET /api/auth/me': () => json(ME),
        'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
      });
      openSecurity();

      fireEvent.click(passwordRow().getByRole('button', { name: 'Set a password' }));
      fireEvent.change(screen.getByLabelText('Code from the email'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      fireEvent.change(await screen.findByLabelText('Password'), {
        target: { value: 'a brand new passphrase' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

      await waitFor(() =>
        expect(document.activeElement?.textContent).toBe(
          '✓Password added. You can sign in with it or with Google.',
        ),
      );
    });

    it('takes Save password with an expired code to the line that says so', async () => {
      answering({
        'GET /api/auth/sessions': () => json(SESSIONS),
        'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
        'POST /api/auth/password/set/code': () => json({ stepUp: 'the-step-up' }),
        'POST /api/auth/password/set': () => problem('verification_code_expired', 410),
      });
      openSecurity();

      fireEvent.click(passwordRow().getByRole('button', { name: 'Set a password' }));
      fireEvent.change(screen.getByLabelText('Code from the email'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      fireEvent.change(await screen.findByLabelText('Password'), {
        target: { value: 'a brand new passphrase' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

      await waitFor(() =>
        expect(document.activeElement?.textContent).toBe('✕This code has expired. Send a new one.'),
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Check your email' })).toBeDefined();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});

describe('offline (sc-27088)', () => {
  it('keeps the devices under the band, and drops one signed out elsewhere once Try again answers', async () => {
    let reachable = true;
    let signedOutElsewhere = false;
    answering({
      'GET /api/auth/sessions': () => {
        if (!reachable) throw new TypeError('Failed to fetch');

        return json(
          signedOutElsewhere
            ? { sessions: SESSIONS.sessions.filter((s) => s.thisDevice) }
            : SESSIONS,
        );
      },
    });
    openSecurity();
    await waitFor(() => expect(screen.getByText('Chrome on Windows')).toBeDefined());

    reachable = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await waitFor(() =>
      expect(document.querySelector('.offline-band')?.textContent).toMatch(/^Offline · as of /),
    );
    expect(screen.getByText('Chrome on Windows')).toBeDefined();

    signedOutElsewhere = true;
    reachable = true;
    const band = document.querySelector('.offline-band') as HTMLElement;
    fireEvent.click(within(band).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(document.querySelector('.offline-band')).toBeNull());
    expect(screen.queryByText('Chrome on Windows')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Your account' }),
      ),
    );
  });
});

function endOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  const button = row?.querySelector('button');

  if (button == null) throw new Error(`No sign-out control in the row for ${name}.`);

  return button;
}
