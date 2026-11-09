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
const ELSEWHERE = '018f3a4c-0002-7c3d-9e1f-2a3b4c5d6e7f';
const GMAIL = 'folake.adeyemi@gmail.com';

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
  providers: [],
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

const ENROLMENT = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/Soirely:folake@ire.events?secret=JBSW&issuer=Soirely',
  qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
};

const CODES = [
  'a1b2-c3d4',
  'e5f6-g7h8',
  'i9j0-k1l2',
  'm3n4-o5p6',
  'q7r8-s9t0',
  'u1v2-w3x4',
  'y5z6-a7b8',
  'c9d0-e1f2',
  'g3h4-i5j6',
  'k7l8-m9n0',
];

const SIGN_IN = { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' };

interface Sent {
  call: string;
  body: unknown;
}

type Answers = Record<string, () => Response | Promise<Response>>;

function answering(answers: Answers, twoFactorOn = false): Sent[] {
  const sent: Sent[] = [];
  const all: Answers = {
    'GET /api/auth/two-factor': () => json({ on: twoFactorOn, recoveryCodesLeft: 10 }),
    'GET /api/auth/sessions': () => json(SESSIONS),
    'GET /api/auth/me': () => json(ME),
    'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
    ...answers,
  };

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    const answer = all[call];
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

function problem(code: string, status: number, members: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...members }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function posts(sent: Sent[]): Sent[] {
  return sent.filter((entry) => !entry.call.startsWith('GET'));
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

function dialog(name: string | RegExp) {
  return within(screen.getByRole('dialog', { name }));
}

function asked(name: string | RegExp) {
  return within(screen.getByRole('alertdialog', { name }));
}

function signedInAs(session: Partial<Session>): void {
  __setSessionState({ status: 'signedIn', session: { ...FOLAKE, ...session } });
}

function holdingProof(): void {
  holdProof({ proof: 'held-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() });
}

function returnedFrom(purpose: unknown, outcome: object = { signIn: SIGN_IN }): void {
  sessionStorage.setItem(
    'soirely.provider.returned',
    JSON.stringify({ provider: 'google', purpose, ...outcome }),
  );
}

const GOOGLE_ONLY: Partial<Session> = {
  hasPassword: false,
  providers: [{ provider: 'google', email: GMAIL }],
};

const BOTH: Partial<Session> = { providers: [{ provider: 'google', email: GMAIL }] };

beforeEach(() => {
  signedInAs({});
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: HERE });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  tokens.clear();
});

describe('Security at a desk (sc-30411)', () => {
  it('draws the summary card, the ways in, two-factor and the devices', async () => {
    answering({ 'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }) });
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
    });
    openSecurity();

    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    expect(section('Two-factor authentication').getByRole('alert')).toBeDefined();
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
    answering({ 'GET /api/auth/sessions': () => json({ title: 'Down' }, 500) });
    openSecurity();

    expect(await screen.findByText('The devices could not be listed')).toBeDefined();
  });
});

describe('changing the password at a desk', () => {
  async function change(current: string, next: string) {
    fireEvent.click(await section('Ways to sign in').findByRole('button', { name: /^Password/ }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } });
    fireEvent.click(dialog('Change password').getByRole('button', { name: 'Save' }));
  }

  it('sends both passwords with this session, then says how many were signed out', async () => {
    const sent = answering({ 'PATCH /api/auth/password': () => json({ signedOut: 1 }) });
    openSecurity();

    await change('the old passphrase', 'a brand new passphrase');

    expect(
      await screen.findByText('Password changed. Your other device is signed out.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      {
        call: 'PATCH /api/auth/password',
        body: {
          currentPassword: 'the old passphrase',
          newPassword: 'a brand new passphrase',
          sessionId: HERE,
        },
      },
    ]);
    await waitFor(() =>
      expect(sent.filter((entry) => entry.call === 'GET /api/auth/sessions')).toHaveLength(2),
    );
  });

  it('says a wrong current password is wrong, and the same password is already the password', async () => {
    let refusal = problem('invalid_credentials', 401);
    answering({ 'PATCH /api/auth/password': () => refusal });
    openSecurity();

    await change('not it', 'a brand new passphrase');
    expect(
      await screen.findByText(
        'That is not your current password. Try again, or reset it by email.',
      ),
    ).toBeDefined();

    refusal = problem('validation_failed', 422, {
      violations: [
        { propertyPath: 'newPassword', code: 'password_unchanged', message: 'Unchanged.' },
      ],
    });
    fireEvent.click(dialog('Change password').getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('That is already your password. Choose a different one.'),
    ).toBeDefined();
  });
});

describe('setting a password by emailed code at a desk', () => {
  beforeEach(() => signedInAs(GOOGLE_ONLY));

  it('sends a code, takes it, then the password, and says it was added', async () => {
    const sent = answering({
      'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
      'POST /api/auth/password/set/code': () => json({ stepUp: 'the-step-up' }),
      'POST /api/auth/password/set': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json({ ...ME, providers: [{ provider: 'google', email: GMAIL }] }),
    });
    openSecurity();

    fireEvent.click(await section('Ways to sign in').findByRole('button', { name: /^Password/ }));
    fireEvent.change(await screen.findByLabelText('Code from the email'), {
      target: { value: '123456' },
    });
    fireEvent.click(dialog('Check your email').getByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('Password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(dialog('Choose a password').getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Password added. You can sign in with it or with Google.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/password/set/start', body: null },
      { call: 'POST /api/auth/password/set/code', body: { code: '123456' } },
      {
        call: 'POST /api/auth/password/set',
        body: { newPassword: 'a brand new passphrase', stepUp: 'the-step-up' },
      },
    ]);
  });

  it('says a wrong code is wrong, and asks for no password', async () => {
    answering({
      'POST /api/auth/password/set/start': () => json({ cooldownSeconds: 60 }),
      'POST /api/auth/password/set/code': () => problem('verification_code_invalid', 422),
    });
    openSecurity();

    fireEvent.click(await section('Ways to sign in').findByRole('button', { name: /^Password/ }));
    fireEvent.change(await screen.findByLabelText('Code from the email'), {
      target: { value: '123456' },
    });
    fireEvent.click(dialog('Check your email').getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        'That code did not match. Check the newest email from Soirely and try again.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Choose a password' })).toBeNull();
  });
});

describe('two-factor at a desk', () => {
  it('sets it up, shows the recovery codes once, and says it is on', async () => {
    let on = false;
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ on, recoveryCodesLeft: 10 }),
      'POST /api/auth/two-factor/enrol': () => json(ENROLMENT),
      'POST /api/auth/two-factor/activate': () => {
        on = true;

        return json({ recoveryCodes: CODES });
      },
    });
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }));
    fireEvent.change(await screen.findByLabelText('Enter the 6-digit code the app shows'), {
      target: { value: '123456' },
    });
    fireEvent.click(dialog('Turn on two-factor').getByRole('button', { name: 'Turn on' }));

    const codes = await screen.findByRole('list', { name: 'Recovery codes' });
    expect(within(codes).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.click(screen.getByLabelText('I have saved these codes somewhere safe'));
    fireEvent.click(dialog('Save your recovery codes').getByRole('button', { name: 'Finish' }));

    expect(
      await screen.findByText('Two-factor is on. Every sign-in now asks for a code from your app.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/two-factor/enrol', body: null },
      { call: 'POST /api/auth/two-factor/activate', body: { code: '123456' } },
    ]);
    expect(await screen.findByText('On · every sign-in asks for a code')).toBeDefined();
  });

  it('says a setup code that does not match, and stays off', async () => {
    answering({
      'POST /api/auth/two-factor/enrol': () => json(ENROLMENT),
      'POST /api/auth/two-factor/activate': () => problem('two_factor_code_invalid', 422),
    });
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }));
    fireEvent.change(await screen.findByLabelText('Enter the 6-digit code the app shows'), {
      target: { value: '123456' },
    });
    fireEvent.click(dialog('Turn on two-factor').getByRole('button', { name: 'Turn on' }));

    expect(await screen.findByText(/That code does not match/)).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Save your recovery codes' })).toBeNull();
  });

  async function turnOff(code: string) {
    fireEvent.click(
      await section('Two-factor authentication').findByRole('button', {
        name: /Authenticator app/,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn off two-factor…' }));
    fireEvent.click(asked('Turn off two-factor?').getByRole('button', { name: 'Turn it off' }));
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: code } });
    fireEvent.click(dialog("Confirm it's you").getByRole('button', { name: 'Continue' }));
  }

  it('turns it off with a code, and says so', async () => {
    const sent = answering(
      { 'POST /api/auth/two-factor/disable': () => new Response(null, { status: 204 }) },
      true,
    );
    openSecurity();

    await turnOff('123456');

    expect(
      await screen.findByText('Two-factor is off. We emailed folake@ire.events to say so.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/two-factor/disable', body: { code: '123456' } },
    ]);
  });

  it('says a wrong code is wrong, and keeps it on', async () => {
    answering(
      { 'POST /api/auth/two-factor/disable': () => problem('two_factor_code_invalid', 422) },
      true,
    );
    openSecurity();

    await turnOff('000000');

    expect(
      await screen.findByText(
        'That code did not work. Enter the code your app shows now, or an unused recovery code.',
      ),
    ).toBeDefined();
  });

  it('lands a rule that keeps it on under the Authenticator row', async () => {
    answering(
      {
        'POST /api/auth/two-factor/disable': () =>
          problem('two_factor_kept_by_rule', 409, { organisation: 'Ire Events' }),
      },
      true,
    );
    openSecurity();

    await turnOff('123456');

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: "Confirm it's you" })).toBeNull(),
    );
    expect(
      within(screen.getByRole('group', { name: 'Authenticator app' })).getByText(
        'Ire Events requires two-factor, so you cannot turn it off.',
      ),
    ).toBeDefined();
  });

  it('makes new recovery codes with a code, shows them, and says the old ones are gone', async () => {
    const sent = answering(
      { 'POST /api/auth/two-factor/recovery-codes': () => json({ recoveryCodes: CODES }) },
      true,
    );
    openSecurity();

    fireEvent.click(
      await section('Two-factor authentication').findByRole('button', { name: /Recovery codes/ }),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Recovery codes' })).getByRole('button', {
        name: 'Make new codes',
      }),
    );
    fireEvent.click(
      asked('Make new recovery codes?').getByRole('button', { name: 'Make new codes' }),
    );
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(dialog("Confirm it's you").getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('list', { name: 'Recovery codes' })).toBeDefined();
    fireEvent.click(screen.getByLabelText('I have saved these codes somewhere safe'));
    fireEvent.click(dialog('Save your recovery codes').getByRole('button', { name: 'Finish' }));

    expect(
      await screen.findByText('New recovery codes made. Your old ones no longer work.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/two-factor/recovery-codes', body: { code: '123456' } },
    ]);
  });
});

describe("Confirm it's you at a desk, whatever two-factor's state", () => {
  it('opens on Link Google while two-factor has failed to load, and leaves for Google', async () => {
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ title: 'Down' }, 500),
      'POST /api/auth/proof': () =>
        json({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
    });
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    openSecurity();

    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    fireEvent.click(section('Ways to sign in').getByRole('button', { name: /Google/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.change(dialog("Confirm it's you").getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(dialog("Confirm it's you").getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/proof', body: { password: 'a decent passphrase' } },
    ]);
  });

  it('opens on Unlink while two-factor is still loading', async () => {
    signedInAs(BOTH);
    answering({ 'GET /api/auth/two-factor': () => new Promise<Response>(() => {}) });
    openSecurity();

    fireEvent.click(await section('Ways to sign in').findByRole('button', { name: /Google/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink…' }));
    fireEvent.click(asked('Unlink Google?').getByRole('button', { name: 'Unlink Google' }));

    expect(await screen.findByRole('dialog', { name: "Confirm it's you" })).toBeDefined();
  });

  it('asks for the code as well when the server says two-factor is on', async () => {
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ title: 'Down' }, 500),
      'POST /api/auth/proof': () => problem('two_factor_required', 403),
    });
    vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    openSecurity();

    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    fireEvent.click(section('Ways to sign in').getByRole('button', { name: /Google/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));
    fireEvent.change(dialog("Confirm it's you").getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(dialog("Confirm it's you").getByRole('button', { name: 'Continue' }));

    expect(await dialog("Confirm it's you").findByLabelText('Code')).toBeDefined();
    expect(posts(sent)).toHaveLength(1);
  });

  it('back from Google to sign out everywhere else, proves with it although two-factor failed', async () => {
    signedInAs(GOOGLE_ONLY);
    returnedFrom({ kind: 'signOutOthers' });
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ title: 'Down' }, 500),
      'POST /api/auth/proof': () =>
        json({ proof: 'the-proof', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 1, thisDevice: false }),
    });
    openSecurity();

    fireEvent.click(
      (await screen.findByRole('dialog', { name: "Confirm it's you" })).querySelector(
        '.desk-nav-verb',
      ) as HTMLElement,
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: "Confirm it's you" })).toBeNull(),
    );
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/proof', body: { provider: 'google', providerSignIn: SIGN_IN } },
      { call: 'POST /api/auth/sessions/others', body: { proof: 'the-proof', sessionId: HERE } },
    ]);
    expect(sessionStorage.getItem('soirely.provider.returned')).toBeNull();
  });
});

describe('linking and unlinking at a desk', () => {
  it('back from Google, links with the held proof and says so', async () => {
    holdingProof();
    returnedFrom({ kind: 'link' });
    const sent = answering({
      'POST /api/auth/providers/google': () => json({ provider: 'google', email: GMAIL }, 201),
      'GET /api/auth/me': () => json({ ...ME, providers: [{ provider: 'google', email: GMAIL }] }),
    });
    openSecurity();

    expect(
      await screen.findByText('Google is linked. We emailed your verified addresses to say so.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      {
        call: 'POST /api/auth/providers/google',
        body: { proof: 'held-proof', providerSignIn: SIGN_IN },
      },
    ]);
  });

  it("says it is linked in the card's place while two-factor has failed, then inside the card once it loads", async () => {
    holdingProof();
    returnedFrom({ kind: 'link' });
    let fails = true;
    answering({
      'GET /api/auth/two-factor': () =>
        fails ? json({ title: 'Down' }, 500) : json({ on: true, recoveryCodesLeft: 8 }),
      'POST /api/auth/providers/google': () => json({ provider: 'google', email: GMAIL }, 201),
      'GET /api/auth/me': () => json({ ...ME, providers: [{ provider: 'google', email: GMAIL }] }),
    });
    openSecurity();

    const words = 'Google is linked. We emailed your verified addresses to say so.';
    const line = await screen.findByText(words);
    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    expect(section('Two-factor authentication').queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Two-factor is on')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(line));

    fails = false;
    fireEvent.click(
      section('Two-factor authentication').getByRole('button', { name: 'Try again' }),
    );

    expect(await screen.findByText('Two-factor is on')).toBeDefined();
    expect(screen.getAllByText(words)).toHaveLength(1);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText(words)));
  });

  it('reads no two-factor failure while the link is still on its way', async () => {
    holdingProof();
    returnedFrom({ kind: 'link' });
    let linked: (answer: Response) => void = () => {};
    answering({
      'GET /api/auth/two-factor': () => json({ title: 'Down' }, 500),
      'POST /api/auth/providers/google': () =>
        new Promise<Response>((resolve) => {
          linked = resolve;
        }),
      'GET /api/auth/me': () => json({ ...ME, providers: [{ provider: 'google', email: GMAIL }] }),
    });
    openSecurity();

    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    expect(section('Two-factor authentication').queryByRole('alert')).toBeNull();

    linked(json({ provider: 'google', email: GMAIL }, 201));
    expect(
      await screen.findByText('Google is linked. We emailed your verified addresses to say so.'),
    ).toBeDefined();
    expect(section('Two-factor authentication').queryByRole('alert')).toBeNull();
  });

  it("reads the two-factor failure when the proof ran out and Confirm it's you is cancelled", async () => {
    returnedFrom({ kind: 'link' });
    answering({ 'GET /api/auth/two-factor': () => json({ title: 'Down' }, 500) });
    openSecurity();

    await screen.findByRole('dialog', { name: "Confirm it's you" });
    fireEvent.click(dialog("Confirm it's you").getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: "Confirm it's you" })).toBeNull(),
    );

    expect(await screen.findByText('Two-factor did not load')).toBeDefined();
    expect(section('Two-factor authentication').getByRole('alert')).toBeDefined();
  });

  it('leaves focus where the user moved it when the card arrives', async () => {
    holdingProof();
    returnedFrom({ kind: 'link' });
    let fails = true;
    answering({
      'GET /api/auth/two-factor': () =>
        fails ? json({ title: 'Down' }, 500) : json({ on: true, recoveryCodesLeft: 8 }),
      'POST /api/auth/providers/google': () => json({ provider: 'google', email: GMAIL }, 201),
      'GET /api/auth/me': () => json({ ...ME, providers: [{ provider: 'google', email: GMAIL }] }),
    });
    openSecurity();

    const line = await screen.findByText(
      'Google is linked. We emailed your verified addresses to say so.',
    );
    await screen.findByText('Two-factor did not load');
    await waitFor(() => expect(document.activeElement).toBe(line));
    const title = screen.getByRole('heading', { level: 1, name: 'Security' });
    title.focus();

    fails = false;
    fireEvent.click(
      section('Two-factor authentication').getByRole('button', { name: 'Try again' }),
    );

    expect(await screen.findByText('Two-factor is on')).toBeDefined();
    expect(document.activeElement).toBe(title);
  });

  it("refuses a Google account that is another Soirely account's, under its row", async () => {
    holdingProof();
    returnedFrom({ kind: 'link' });
    answering({ 'POST /api/auth/providers/google': () => problem('provider_taken', 409) });
    openSecurity();

    expect(
      await screen.findByText(
        /That Google account is already linked to another Soirely account\. Nothing changed\./,
      ),
    ).toBeDefined();
  });

  it("says Google didn't finish under its row when the trip failed, and nothing when it was cancelled", async () => {
    returnedFrom({ kind: 'link' }, { failed: 'failed' });
    answering({});
    const { unmount } = openSecurity();

    expect(
      await screen.findByText("Google didn't finish, so nothing changed. Try again."),
    ).toBeDefined();
    unmount();

    returnedFrom({ kind: 'link' }, { failed: 'cancelled' });
    openSecurity();
    await screen.findByText('Two-factor is off');
    expect(screen.queryByText(/didn't finish/)).toBeNull();
    expect(sessionStorage.getItem('soirely.provider.returned')).toBeNull();
  });

  async function unlink() {
    fireEvent.click(await section('Ways to sign in').findByRole('button', { name: /Google/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink…' }));
    fireEvent.click(asked('Unlink Google?').getByRole('button', { name: 'Unlink Google' }));
  }

  it('unlinks with the held proof, and says so', async () => {
    signedInAs(BOTH);
    holdingProof();
    const sent = answering({
      'POST /api/auth/providers/google/unlink': () => json({ signedOut: 0, thisDevice: false }),
    });
    openSecurity();

    await unlink();

    expect(
      await screen.findByText('Google is unlinked. Devices signed in with it are signed out.'),
    ).toBeDefined();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/providers/google/unlink', body: { proof: 'held-proof' } },
    ]);
  });

  it('lands on sign-in when unlinking signed this device out', async () => {
    signedInAs(BOTH);
    holdingProof();
    answering({
      'POST /api/auth/providers/google/unlink': () => json({ signedOut: 1, thisDevice: true }),
    });
    openSecurity();

    await unlink();

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined();
  });

  it.each([
    ['last_sign_in_method', {}, 'Set a password or link another account before removing this one.'],
    [
      'provider_kept_by_rule',
      { organisation: 'Ire Events' },
      'A rule set by Ire Events: everyone in it signs in with Google or Apple, so your last one cannot be removed. Link Apple first if you want to unlink Google.',
    ],
  ])('says the server refused it as %s, under the row', async (code, members, words) => {
    signedInAs(BOTH);
    holdingProof();
    answering({ 'POST /api/auth/providers/google/unlink': () => problem(code, 409, members) });
    openSecurity();

    await unlink();

    expect(await screen.findByText(words)).toBeDefined();
  });
});

describe('the devices at a desk', () => {
  it('asks before signing another device out, then signs it out and says so', async () => {
    const sent = answering({
      [`DELETE /api/auth/sessions/${ELSEWHERE}`]: () => new Response(null, { status: 204 }),
    });
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: /Chrome on Windows/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign it out' }));

    expect(await screen.findByText('Chrome on Windows is signed out.')).toBeDefined();
    expect(posts(sent).map((entry) => entry.call)).toEqual([
      `DELETE /api/auth/sessions/${ELSEWHERE}`,
    ]);
    await waitFor(() =>
      expect(
        section('Signed in on').queryByRole('button', { name: /Chrome on Windows/ }),
      ).toBeNull(),
    );
  });

  it('keeps the device when the ask is declined', async () => {
    const sent = answering({});
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: /Chrome on Windows/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it signed in' }));

    expect(posts(sent)).toEqual([]);
  });

  async function everywhere() {
    fireEvent.click(await screen.findByRole('button', { name: /Sign out everywhere else…/ }));
    fireEvent.click(
      asked('Sign out everywhere else?').getByRole('button', { name: 'Sign it out' }),
    );
  }

  it('proves it is you with the password, keeps this session, and says the others are out', async () => {
    const sent = answering({
      'POST /api/auth/proof': () => json({ proof: 'p-1', expiresAt: '2026-10-17T12:05:00+00:00' }),
      'POST /api/auth/sessions/others': () => json({ signedOut: 1, thisDevice: false }),
    });
    openSecurity();

    await everywhere();
    fireEvent.change(dialog("Confirm it's you").getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(dialog("Confirm it's you").getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Your other device is signed out.')).toBeDefined();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/proof', body: { password: 'a decent passphrase' } },
      { call: 'POST /api/auth/sessions/others', body: { proof: 'p-1', sessionId: HERE } },
    ]);
  });

  it('signs the others out with a held proof, without asking for it again', async () => {
    holdingProof();
    const sent = answering({
      'POST /api/auth/sessions/others': () => json({ signedOut: 1, thisDevice: false }),
    });
    openSecurity();

    await everywhere();

    expect(await screen.findByText('Your other device is signed out.')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: "Confirm it's you" })).toBeNull();
    expect(posts(sent)).toEqual([
      { call: 'POST /api/auth/sessions/others', body: { proof: 'held-proof', sessionId: HERE } },
    ]);
  });

  it('says nothing was signed out when it fails', async () => {
    holdingProof();
    answering({ 'POST /api/auth/sessions/others': () => json({ title: 'Down' }, 500) });
    openSecurity();

    await everywhere();

    expect(
      await screen.findByText(
        'This is about reaching the API rather than about your account. Try again.',
      ),
    ).toBeDefined();
    expect(section('Signed in on').getByText('Chrome on Windows')).toBeDefined();
  });

  it('keeps this device signed in, and says so, when Sign out here cannot reach Soirely', async () => {
    answering({
      'POST /api/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    openSecurity();

    fireEvent.click(await screen.findByRole('button', { name: /Chrome on macOS/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByText(
        'Soirely could not be reached, so this device was not signed out. Check your connection, then try again.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    expect(tokens.access()).toBe('live');
  });
});
