import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { dropRegistration, holdRegistration } from '../../pendingRegistration.ts';
import { __setSessionState, type Session } from '../../session.ts';
import { routes } from '../index.tsx';
import { membership } from '../../test-memberships.ts';

const MEMBERSHIP = membership({ id: 'acc_1', name: 'Ire Events' });

const FOLAKE: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: false,
  complete: false,
  awaiting: 'email' as const,
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
});

describe('verifying an email address', () => {
  it('opens on "Too many wrong tries", with no code field, when the code is already spent', async () => {
    answering({
      'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 0, codeState: 'exhausted' }),
    });

    open();

    await waitFor(() => expect(screen.getByText('Too many wrong tries')).toBeDefined());
    expect(screen.queryByLabelText('Code from the email')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeDefined();
  });

  it('opens on the expired banner when the code has run out', async () => {
    answering({
      'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 0, codeState: 'expired' }),
    });

    open();

    await waitFor(() => expect(screen.getByText('That code has expired')).toBeDefined());
    expect(screen.queryByLabelText('Code from the email')).toBeNull();
  });

  it('opens on the field when the code is live', async () => {
    const seen = answering({
      'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 30, codeState: 'live' }),
    });

    open();

    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(screen.getByLabelText('Code from the email')).toBeDefined();
    expect(screen.queryByText('Too many wrong tries')).toBeNull();
  });

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
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Email verified' }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
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
    expect(screen.getByLabelText('Code from the email').getAttribute('aria-invalid')).toBe('true');
  });

  it('offers a new code when this one has expired', async () => {
    answering({ 'POST /api/auth/verify/email': () => problem('verification_code_expired') });

    open();
    enter('123456');

    const notice = (await screen.findByText('That code has expired')).closest('.notice-body');
    expect(document.activeElement).toBe(notice);
    expect(notice?.textContent).toMatch(/Send a new one and use the code in the newest email/);
    expect(notice?.closest('[role="alert"]')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Send a new code' })).not.toEqual([]);
  });

  it('offers a new code after too many wrong tries', async () => {
    answering({ 'POST /api/auth/verify/email': () => problem('verification_code_exhausted') });

    open();
    enter('000000');

    const notice = (await screen.findByText('Too many wrong tries')).closest('.notice-body');
    expect(document.activeElement).toBe(notice);
    expect(notice?.closest('[role="alert"]')).toBeNull();
  });

  it('counts down from the seconds the resend answered with', async () => {
    answering({ 'POST /api/auth/verify/resend': () => json({ cooldownSeconds: 42 }) });

    open();
    const resend = screen.getByRole('button', { name: 'Send a new code' });
    resend.focus();
    fireEvent.click(resend);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 0:42' })).toBeDefined(),
    );
    expect(resend.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(resend);
    expect(screen.getAllByRole('status').map(({ textContent }) => textContent)).toContain(
      'Send a new code in 0:42',
    );
  });

  it('sends nothing while it counts down, and keeps the button in reach', async () => {
    const seen = answering({ 'POST /api/auth/verify/resend': () => json({ cooldownSeconds: 42 }) });

    open();
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    const counting = await screen.findByRole('button', { name: 'Send a new code in 0:42' });
    fireEvent.click(counting);

    expect(seen.filter((call) => call === 'POST /api/auth/verify/resend')).toHaveLength(1);
    expect(counting.hasAttribute('disabled')).toBe(false);
  });

  it('sends one new code while the first is unanswered, however often it is pressed', async () => {
    const seen: string[] = [];
    let answer: (response: Response) => void = () => undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      seen.push(line);
      if (line !== 'POST /api/auth/verify/resend') throw new TypeError('Failed to fetch');

      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    });

    open();
    const resend = screen.getByRole('button', { name: 'Send a new code' });
    fireEvent.click(resend);
    await waitFor(() => expect(seen).toContain('POST /api/auth/verify/resend'));
    fireEvent.click(resend);
    fireEvent.keyDown(resend, { key: 'Enter' });
    fireEvent.click(resend);

    expect(seen.filter((call) => call === 'POST /api/auth/verify/resend')).toHaveLength(1);
    expect(resend.getAttribute('aria-disabled')).toBe('false');

    answer(json({ cooldownSeconds: 60 }));

    expect(await screen.findByRole('button', { name: 'Send a new code in 1:00' })).toBeDefined();
    expect(seen.filter((call) => call === 'POST /api/auth/verify/resend')).toHaveLength(1);
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
    expect(screen.getByText('and create your account again with the right one.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('stays signed in and says so when signing out cannot reach Soirely', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    answering({});

    open();

    const button = screen.getByRole('button', { name: 'Sign out' });
    button.focus();
    fireEvent.click(button);

    expect((await screen.findByRole('alert')).textContent).toMatch(/You are still signed in/);
    expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
  });

  it('opens already counting down from a send it did not make, such as the registration email', async () => {
    const seen = answering({ 'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 57 }) });

    open();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send a new code in 0:57' })).toBeDefined(),
    );
    expect(
      screen.getByRole('button', { name: 'Send a new code in 0:57' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(seen).not.toContain('POST /api/auth/verify/resend');
    expect(screen.queryAllByRole('status').map(({ textContent }) => textContent)).not.toContain(
      'Send a new code in 0:57',
    );
  });

  it('shows a verified account that it is verified, not a code to enter', () => {
    __setSessionState({ status: 'signedIn', session: { ...FOLAKE, verified: true } });
    answering({});

    open();

    expect(screen.getByRole('heading', { level: 1, name: 'Email verified' })).toBeDefined();
    expect(screen.queryByLabelText('Code from the email')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('says the account is still signed in when it cannot reach Soirely', () => {
    __setSessionState({ status: 'unreachable', retrying: false });

    open();

    expect(screen.getByRole('status').textContent).toMatch(/You are still signed in\./);
  });

  it('sends somebody with no session to sign in', async () => {
    __setSessionState({ status: 'signedOut', ended: false });

    open();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined(),
    );
  });
});

describe('verifying an address added from Settings > Account', () => {
  const ME = {
    id: 'acc_1',
    name: 'Folake Ire',
    businessName: null,
    countryCode: null,
    organisationCountry: 'NG',
    locale: 'en',
    timezone: null,
    waitingFor: null,
    verified: true,
    complete: true,
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    providers: [],
    emailAddresses: [
      { id: 'e1', address: 'folake@ire.events', verified: true, primary: true },
      { id: 'e2', address: 'folake.adeyemi@gmail.com', verified: false, primary: false },
    ],
    phoneNumbers: [],
  };

  const VERIFIED = () =>
    json({ id: 'e2', address: 'folake.adeyemi@gmail.com', verified: true, primary: false });

  function fromAccount(me: unknown = ME, verifying: () => Response = VERIFIED) {
    const sent: { path: string; body: unknown }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const { pathname, search } = new URL(String(input));
      sent.push({
        path: `${init?.method ?? 'GET'} ${pathname}${search}`,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      });
      if (pathname === '/api/auth/me') return json(me);
      if (pathname === '/api/auth/verify/resend')
        return json({ cooldownSeconds: 0, codeState: 'live' });
      if (pathname === '/api/auth/verify/email') return verifying();
      throw new TypeError('Failed to fetch');
    });
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/verify-email?address=e2'] })}
      />,
    );

    return sent;
  }

  it('sends its id with the code, offers no sign-out, and goes back to Account', async () => {
    const sent = fromAccount();

    expect(await screen.findByText(/folake\.adeyemi@gmail\.com/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    enter('123456');

    await waitFor(() =>
      expect(sent.find((s) => s.path === 'POST /api/auth/verify/email')?.body).toEqual({
        code: '123456',
        address: 'e2',
      }),
    );
    expect(sent.some((s) => s.path === 'GET /api/auth/verify/resend?address=e2')).toBe(true);
  });

  it("shows Account's way back instead of the onboarding steps, and sends a wrong address to Account", async () => {
    fromAccount();

    expect(await screen.findByLabelText('Code from the email')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Before you start' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to Account' }).getAttribute('href')).toBe(
      '/app/account',
    );
    expect(screen.getByText('Not your address?')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Remove it in Account' }).getAttribute('href')).toBe(
      '/app/account',
    );
    expect(screen.queryByRole('button', { name: 'Register again with the right one' })).toBeNull();
  });

  it.each([
    ['a wrong code', 'verification_code_invalid', /does not match/],
    ['an expired code', 'verification_code_expired', /has expired/],
    ['too many wrong tries', 'verification_code_exhausted', /Too many wrong/],
  ])("keeps Account's way back at the top after %s", async (_, code, says) => {
    fromAccount(ME, () => problem(code));

    await screen.findByLabelText('Code from the email');
    enter('000000');

    await waitFor(() => expect(document.body.textContent).toMatch(says));
    expect(
      screen
        .getAllByRole('link', { name: 'Back to Account' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/app/account']);
  });

  it('ends on Back to Account, with the address still an alternative', async () => {
    fromAccount();

    await screen.findByLabelText('Code from the email');
    enter('123456');

    expect(await screen.findByRole('heading', { level: 1, name: 'Email verified' })).toBeDefined();
    expect(
      screen.getByText(
        'folake.adeyemi@gmail.com is verified. It stays an alternative address until you make it primary in Account.',
      ),
    ).toBeDefined();
    expect(
      screen
        .getAllByRole('link', { name: 'Back to Account' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/app/account?verified=e2']);
    expect(screen.getByRole('link', { name: 'Back to Account' }).className).toMatch(
      /button-primary/,
    );
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Before you start' })).toBeNull();
  });

  it('opens on verified, with no code to enter, for an address verified elsewhere', async () => {
    const sent = fromAccount({
      ...ME,
      emailAddresses: [ME.emailAddresses[0], { ...ME.emailAddresses[1], verified: true }],
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Email verified' })).toBeDefined();
    expect(screen.queryByLabelText('Code from the email')).toBeNull();
    expect(
      screen
        .getAllByRole('link', { name: 'Back to Account' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/app/account?verified=e2']);
    expect(sent.some((s) => s.path.startsWith('GET /api/auth/verify/resend'))).toBe(false);
  });
});

describe('a held sign-up on a device whose session has ended', () => {
  beforeEach(() => {
    __setSessionState({ status: 'signedOut', ended: true });
    holdRegistration({ registration: 'the-handle', email: 'folake@ire.events' });
  });

  afterEach(() => dropRegistration());

  it('opens on the code for that address while the sign-up is open', async () => {
    answering({
      'GET /api/auth/register/resend': () => json({ cooldownSeconds: 0, codeState: 'live' }),
    });

    open();

    expect(await screen.findByLabelText('Code from the email')).toBeDefined();
    expect(screen.getByText(/folake@ire\.events/)).toBeDefined();
  });

  it('says signed out on sign-in, and drops the sign-up, once its handle has run out', async () => {
    answering({ 'GET /api/auth/register/resend': () => problem('registration_expired', 410) });

    open();

    expect(await screen.findByText('You were signed out')).toBeDefined();
    expect(sessionStorage.getItem('soirely.registration')).toBeNull();
  });
});

describe('where focus goes once a code is refused or sent again (sc-11369)', () => {
  const expiredOnOpen = {
    'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 0, codeState: 'expired' }),
  };

  it('does not move focus to the banner the screen opens on', async () => {
    answering(expiredOnOpen);

    open();

    const notice = (await screen.findByText('That code has expired')).closest('.notice');
    expect(notice?.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(document.body);
  });

  it('takes Send a new code, in place of the code, to Code from the email', async () => {
    answering({ 'POST /api/auth/verify/email': () => problem('verification_code_expired') });

    open();
    enter('123456');
    await screen.findByText('That code has expired');
    vi.restoreAllMocks();
    answering({ 'POST /api/auth/verify/resend': () => json({ cooldownSeconds: 42 }) });
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));

    const field = await screen.findByLabelText('Code from the email');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(screen.getByRole('button', { name: 'Send a new code in 0:42' })).toBeDefined();
  });

  it('takes Send a new code to the field when the resend was too soon', async () => {
    answering({
      ...expiredOnOpen,
      'POST /api/auth/verify/resend': () =>
        problem('too_many_attempts', 429, { 'Retry-After': '30' }),
    });

    open();
    await screen.findByText('That code has expired');
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));

    const field = await screen.findByLabelText('Code from the email');
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('takes Send a new code with no connection to "That did not work", read once', async () => {
    answering(expiredOnOpen);

    open();
    await screen.findByText('That code has expired');
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));

    const notice = (await screen.findByText('That did not work')).closest('.notice-body');
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(notice?.textContent).toMatch(/Something went wrong on the way/);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
