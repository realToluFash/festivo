import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { browser } from '../../../providerSignIn.ts';
import { holdProof } from '../../../recentProof.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';

const HERE = '018f3a4c-0001-7c3d-9e1f-2a3b4c5d6e7f';
const MEMBERSHIP = membership({ id: 'acc_1', name: 'Ire Events' });
const GMAIL = 'folake.adeyemi@gmail.com';

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
  organisationCountry: null,
  timezone: null,
};

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake Ire',
  businessName: null,
  countryCode: null,
  locale: 'en',
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

interface Sent {
  call: string;
  body: unknown;
}

function answering(answers: Record<string, () => Response>, twoFactorOn = false): Sent[] {
  const sent: Sent[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const fallback: Record<string, () => Response> = {
      'GET /api/auth/sessions': () => json({ sessions: [] }),
      'GET /api/auth/two-factor': () => json({ on: twoFactorOn, recoveryCodesLeft: 10 }),
      'GET /api/orgs': () => json({ organisations: [] }),
    };
    const answer = answers[call] ?? fallback[call];
    if (answer == null) throw new Error(`Nothing stubbed for ${call}`);

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

function problem(code: string, status: number, members: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...members }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function open(path = '/app/account/security') {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function ways() {
  return within(screen.getByRole('region', { name: /Ways to sign in|Confirm it's you|Unlink/ }));
}

function signedInAs(session: Partial<Session>): void {
  __setSessionState({ status: 'signedIn', session: { ...FOLAKE, ...session } });
}

/** As if this tab had left for Google from Security and come back with a code. */
function backFromGoogle(purpose: unknown): void {
  sessionStorage.setItem(
    'soirely.google.attempt',
    JSON.stringify({ state: 's', nonce: 'n', codeVerifier: 'v', purpose }),
  );
  window.history.replaceState(null, '', '/oauth/google?state=s&code=the-code');
}

beforeEach(() => {
  signedInAs({});
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: HERE });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  __setSessionState({ status: 'unknown' });
  tokens.clear();
});

describe('the ways an account signs in', () => {
  it('lists the password and each provider, with the address a linked one vouched for', () => {
    signedInAs({ providers: [{ provider: 'google', email: GMAIL }] });
    answering({});

    open();

    const list = within(screen.getByRole('list', { name: 'Ways to sign in' }));
    expect(list.getByText('Set up')).toBeDefined();
    expect(list.getByText(`· ${GMAIL}`)).toBeDefined();
    expect(list.getByRole('button', { name: 'Unlink Google' })).toBeDefined();
    expect(list.getByRole('button', { name: 'Link Apple' })).toBeDefined();
    expect(list.getByText('Not linked')).toBeDefined();
  });

  it('never offers to unlink the last way in, and offers a password instead', () => {
    signedInAs({ hasPassword: false, providers: [{ provider: 'google', email: GMAIL }] });
    answering({});

    open();

    const list = within(screen.getByRole('list', { name: 'Ways to sign in' }));
    expect(list.queryByRole('button', { name: 'Unlink Google' })).toBeNull();
    expect(
      list.getByText(
        "Google is your only way to sign in, so it can't be removed. Set a password or link another account before removing this one.",
      ),
    ).toBeDefined();
  });
});

describe('linking a provider', () => {
  it('checks a blank password before asking anything', async () => {
    const sent = answering({});
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Enter your password.')).toBeDefined();
    expect(sent.filter((s) => s.call === 'POST /api/auth/proof')).toEqual([]);
  });

  it('says a wrong password is wrong, and nothing leaves for Google', async () => {
    answering({ 'POST /api/auth/proof': () => problem('invalid_credentials', 401) });
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'nope' } });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText('That is not your password. Try again, or reset it by email.'),
    ).toBeDefined();
    expect(leave).not.toHaveBeenCalled();
  });

  it('confirms with the password, then leaves for Google to choose the account', async () => {
    const sent = answering({
      'POST /api/auth/proof': () =>
        json({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
    });
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    expect(
      screen.getByText("To link Google, confirm it's you. You won't be asked again for 5 minutes."),
    ).toBeDefined();
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    expect(sent.find((s) => s.call === 'POST /api/auth/proof')?.body).toEqual({
      password: 'a decent passphrase',
    });
    const saved = JSON.parse(sessionStorage.getItem('soirely.google.attempt') ?? '{}');
    expect(saved.purpose).toEqual({ kind: 'link' });
    expect(new URL(String(leave.mock.calls[0]?.[0])).searchParams.get('prompt')).toBe(
      'select_account',
    );
  });

  it('back from Google, links with the proof and says which account', async () => {
    holdProof({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    backFromGoogle({ kind: 'link' });
    const sent = answering({
      'POST /api/auth/providers/google': () => json({ provider: 'google', email: GMAIL }, 201),
      'GET /api/auth/me': () =>
        json({ ...ACCOUNT, providers: [{ provider: 'google', email: GMAIL }] }),
    });

    open('/oauth/google');

    expect(await screen.findByText('Google is linked.', {}, { timeout: 3000 })).toBeDefined();
    expect(
      screen.getByText(
        `Next time, sign in with Google as ${GMAIL}, or as before. We emailed your verified addresses to say so.`,
      ),
    ).toBeDefined();
    expect(sent.find((s) => s.call === 'POST /api/auth/providers/google')?.body).toEqual({
      proof: 'the-proof',
      providerSignIn: {
        code: 'the-code',
        codeVerifier: 'v',
        redirectUri: `${window.location.origin}/oauth/google`,
        nonce: 'n',
      },
    });
  });

  it("refuses a Google account that is another Soirely account's, and changes nothing", async () => {
    holdProof({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    backFromGoogle({ kind: 'link' });
    answering({ 'POST /api/auth/providers/google': () => problem('provider_taken', 409) });

    open('/oauth/google');

    expect(
      await screen.findByText(
        'That Google account is already linked to another Soirely account.',
        {},
        { timeout: 3000 },
      ),
    ).toBeDefined();
  });

  it('says the Google account was refused, not that Google did not finish, when the proof is turned down', async () => {
    signedInAs({ hasPassword: false, providers: [{ provider: 'google', email: GMAIL }] });
    backFromGoogle({ kind: 'prove', then: { action: 'link', provider: 'apple' } });
    answering({ 'POST /api/auth/proof': () => problem('invalid_credentials', 401) });

    open('/oauth/google');

    expect(
      await screen.findByText(
        "That Google account isn't the one linked here, or it was signed in too long ago. Try again.",
        {},
        { timeout: 3000 },
      ),
    ).toBeDefined();
  });

  it('a Google-only account confirms with Google, and links Apple after', async () => {
    signedInAs({ hasPassword: false, providers: [{ provider: 'google', email: GMAIL }] });
    answering({});
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Link Apple' }));
    expect(
      screen.getByText('You sign in with Google, so confirm with Google instead.'),
    ).toBeDefined();
    fireEvent.click(ways().getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    const saved = JSON.parse(sessionStorage.getItem('soirely.google.attempt') ?? '{}');
    expect(saved.purpose).toEqual({ kind: 'prove', then: { action: 'link', provider: 'apple' } });
    const url = new URL(String(leave.mock.calls[0]?.[0]));
    expect([url.searchParams.get('prompt'), url.searchParams.get('max_age')]).toEqual([
      'login',
      '0',
    ]);
  });

  it('with two-factor on, asks for the code with the password', async () => {
    const sent = answering(
      {
        'POST /api/auth/proof': () =>
          json({ proof: 'p', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
      },
      true,
    );
    vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    open();

    await waitFor(() => expect(sent.some((s) => s.call === 'GET /api/auth/two-factor')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Enter a code from your app, or a recovery code.'),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(sent.find((s) => s.call === 'POST /api/auth/proof')?.body).toEqual({
        password: 'a decent passphrase',
        code: '123456',
      }),
    );
  });

  it('counts the recovery code it spent on the two-factor card, without leaving the page', async () => {
    let left = 9;
    answering(
      {
        'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: left }),
        'POST /api/auth/proof': () => {
          left = 8;

          return json({ proof: 'p', expiresAt: new Date(Date.now() + 300_000).toISOString() });
        },
      },
      true,
    );
    vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    open();

    expect(await screen.findByText('9 of 10 unused · each works once')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('8 of 10 unused · each works once')).toBeDefined();
  });

  it('leaves the count as it was when the code is refused', async () => {
    const sent = answering(
      {
        'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 9 }),
        'POST /api/auth/proof': () => problem('two_factor_code_invalid', 422),
      },
      true,
    );
    open();

    expect(await screen.findByText('9 of 10 unused · each works once')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '000000' } });
    const asked = () => sent.filter((s) => s.call === 'GET /api/auth/two-factor').length;
    const before = asked();
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(sent.some((s) => s.call === 'POST /api/auth/proof')).toBe(true));
    expect(await screen.findByLabelText('Code')).toBeDefined();
    expect(screen.getByText('9 of 10 unused · each works once')).toBeDefined();
    expect(asked()).toBe(before);
  });
});

describe('a wrong code after Google', () => {
  it('retries with the kept proof, never sending Google’s single-use sign-in again', async () => {
    signedInAs({ hasPassword: false, providers: [{ provider: 'google', email: GMAIL }] });
    backFromGoogle({ kind: 'prove', then: { action: 'link', provider: 'apple' } });
    const answers = [
      () => problem('two_factor_code_invalid', 422, { pendingProof: 'kept-1' }),
      () => json({ proof: 'p', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
    ];
    const sent = answering(
      { 'POST /api/auth/proof': () => (answers.shift() ?? answers[0])!() },
      true,
    );
    vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});

    open('/oauth/google');

    fireEvent.change(await screen.findByLabelText('Code', {}, { timeout: 3000 }), {
      target: { value: '000000' },
    });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('That code did not work. Check your app and try again.'),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(sent.filter((s) => s.call === 'POST /api/auth/proof').map((s) => s.body)).toEqual([
        expect.objectContaining({ provider: 'google', code: '000000' }),
        { pendingProof: 'kept-1', code: '123456' },
      ]),
    );
  });
});

describe('a kept sign-in that ran out', () => {
  it('goes back to the first step, the change kept, and says the Google sign-in was too long ago', async () => {
    signedInAs({ hasPassword: false, providers: [{ provider: 'google', email: GMAIL }] });
    backFromGoogle({ kind: 'prove', then: { action: 'link', provider: 'apple' } });
    const answers = [
      () => problem('two_factor_code_invalid', 422, { pendingProof: 'kept-1' }),
      () => problem('proof_required', 403),
    ];
    answering({ 'POST /api/auth/proof': () => (answers.shift() ?? answers[0])!() }, true);
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});

    open('/oauth/google');
    fireEvent.change(await screen.findByLabelText('Code', {}, { timeout: 3000 }), {
      target: { value: '000000' },
    });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));
    await screen.findByText('That code did not work. Check your app and try again.');
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(ways().getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        'Your Google sign-in was more than 5 minutes ago, so nothing has changed yet. Continue with Google again to carry on.',
      ),
    ).toBeDefined();
    expect(screen.queryByLabelText('Code')).toBeNull();
    fireEvent.click(ways().getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    const saved = JSON.parse(sessionStorage.getItem('soirely.google.attempt') ?? '{}');
    expect(saved.purpose).toEqual({ kind: 'prove', then: { action: 'link', provider: 'apple' } });
  });
});

describe('unlinking a provider', () => {
  it('asks first, says what remains, then unlinks and says so', async () => {
    signedInAs({ providers: [{ provider: 'google', email: GMAIL }] });
    holdProof({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    const sent = answering({
      'POST /api/auth/providers/google/unlink': () => json({ signedOut: 1, thisDevice: false }),
      'GET /api/auth/me': () => json({ ...ACCOUNT, providers: [] }),
    });
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Unlink Google' }));

    expect(screen.getByRole('heading', { name: 'Unlink Google?' })).toBeDefined();
    expect(
      screen.getByText(
        `You'll no longer be able to sign in with Google as ${GMAIL}. You can still sign in with your password.`,
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Google' }));

    expect(
      await screen.findByText('Google is unlinked. Devices signed in with it are signed out.'),
    ).toBeDefined();
    expect(sent.find((s) => s.call === 'POST /api/auth/providers/google/unlink')?.body).toEqual({
      proof: 'the-proof',
    });
  });

  it('keeps it linked when asked to', () => {
    signedInAs({ providers: [{ provider: 'google', email: GMAIL }] });
    holdProof({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    const sent = answering({});
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Unlink Google' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it linked' }));

    expect(screen.getByRole('button', { name: 'Unlink Google' })).toBeDefined();
    expect(sent.some((s) => s.call.endsWith('/unlink'))).toBe(false);
  });

  it('says why the server would not remove the last way in', async () => {
    signedInAs({ providers: [{ provider: 'google', email: GMAIL }] });
    holdProof({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    answering({
      'POST /api/auth/providers/google/unlink': () => problem('last_sign_in_method', 409),
    });
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Unlink Google' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Google' }));

    expect(
      await screen.findByText('Set a password or link another account before removing this one.'),
    ).toBeDefined();
  });
});
