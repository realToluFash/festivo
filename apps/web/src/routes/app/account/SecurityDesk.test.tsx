import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';

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

function answering(answers: Record<string, () => Response | Promise<Response>>): string[] {
  const calls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    calls.push(call);
    const answer = answers[call];
    if (answer == null) throw new Error(`Nothing stubbed for ${call}`);

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

function section(name: string) {
  return within(screen.getByRole('heading', { name }).closest('section') as HTMLElement);
}

beforeEach(() => {
  __setSessionState({ status: 'signedIn', session: FOLAKE });
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: HERE });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  tokens.clear();
});

describe('Security at a desk (sc-30411)', () => {
  it('draws the summary card, the ways in, two-factor and the devices', async () => {
    answering({
      'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
      'GET /api/auth/sessions': () => json(SESSIONS),
    });
    openSecurity();

    await screen.findByRole('heading', { level: 1, name: 'Security' });
    expect(await screen.findByText('Two-factor is off')).toBeDefined();
    expect(screen.getByText('1 way to sign in · 2 devices')).toBeDefined();
    expect(
      section('Ways to sign in').getByText('Set up · used with your email to sign in'),
    ).toBeDefined();
    expect(section('Two-factor authentication').getByText('Authenticator app')).toBeDefined();
    expect(section('Signed in on').getByText('This device · in use now')).toBeDefined();
    expect(section('Signed in on').getByText('Chrome on Windows')).toBeDefined();
  });

  it('hides the card and says two-factor did not load, until Try again reads it', async () => {
    let fails = true;
    answering({
      'GET /api/auth/two-factor': () =>
        fails ? json({ title: 'Down' }, 500) : json({ on: true, recoveryCodesLeft: 8 }),
      'GET /api/auth/sessions': () => json(SESSIONS),
    });
    openSecurity();

    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    expect(screen.queryByText('Two-factor is off')).toBeNull();
    expect(screen.queryByText('Two-factor is on')).toBeNull();

    fails = false;
    fireEvent.click(
      section('Two-factor authentication').getByRole('button', { name: 'Try again' }),
    );

    expect(await screen.findByText('Two-factor is on')).toBeDefined();
    expect(screen.getByText('On · every sign-in asks for a code')).toBeDefined();
  });

  it('says the devices could not be listed', async () => {
    answering({
      'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
      'GET /api/auth/sessions': () => json({ title: 'Down' }, 500),
    });
    openSecurity();

    expect(await screen.findByText('The devices could not be listed')).toBeDefined();
  });

  it('asks before signing another device out, then signs it out and says so', async () => {
    const calls = answering({
      'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
      'GET /api/auth/sessions': () => json(SESSIONS),
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
    });
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: /Chrome on Windows/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign it out' }));

    expect(await screen.findByText('Chrome on Windows is signed out.')).toBeDefined();
    expect(calls).toContain(`DELETE /api/auth/sessions/${ELSEWHERE}`);
    await waitFor(() =>
      expect(
        section('Signed in on').queryByRole('button', { name: /Chrome on Windows/ }),
      ).toBeNull(),
    );
  });

  it('keeps the device when the ask is declined', async () => {
    const calls = answering({
      'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
      'GET /api/auth/sessions': () => json(SESSIONS),
    });
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: /Chrome on Windows/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it signed in' }));

    expect(calls.filter((call) => call.startsWith('DELETE'))).toEqual([]);
  });
});
