import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: true,
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
  providers: [],
};

function at(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function answering(answers: Record<string, () => Response | Promise<Response>>) {
  const sent: { path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    sent.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[`${init?.method ?? 'GET'} ${path}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(code: string, status: number, headers: Record<string, string> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status },
    status,
    headers,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('asking for a reset link', () => {
  it('is reached from sign-in', async () => {
    at('/sign-in');

    fireEvent.click(screen.getByRole('link', { name: 'Forgot your password?' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeDefined(),
    );
  });

  it('goes back to sign-in from ‹ Sign in, heard as Back to sign in (sc-23279)', async () => {
    at('/sign-in');

    fireEvent.click(screen.getByRole('link', { name: 'Forgot your password?' }));
    const back = await screen.findByRole('button', { name: 'Back to sign in' });
    expect(back.textContent).toBe('‹ Sign in');
    fireEvent.click(back);

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
  });

  it('goes to sign-in from ‹ Sign in when the page was opened on its own', async () => {
    at('/forgot-password');

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
  });

  it('checks the address before sending, and sends nothing while it fails', async () => {
    const sent = answering({});
    at('/forgot-password');

    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(screen.getByText('Enter your email address.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();

    await settled();
    expect(sent).toEqual([]);
  });

  it('says the same thing whether or not the address has an account', async () => {
    const sent = answering({ 'POST /api/auth/password/forgot': () => json({}, 202) });
    at('/forgot-password');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Check your email' }),
      ),
    );
    expect(
      screen.getByText(/If that address has an account, we have sent it a link/),
    ).toBeDefined();
    expect(screen.getByText(/Signed up with Google or Apple\?/)).toBeDefined();
    expect(sent).toEqual([
      { path: '/api/auth/password/forgot', body: { email: 'folake@ire.events' } },
    ]);
  });

  it('gives a time when there have been too many requests', async () => {
    answering({
      'POST /api/auth/password/forgot': () =>
        problem('too_many_attempts', 429, { 'Retry-After': '600' }),
    });
    at('/forgot-password');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    await waitFor(() => expect(screen.getByText('Too many requests')).toBeDefined());
    expect(
      screen.getByText(/^Try again at \d\d:\d\d\. Any link already sent still works\.$/),
    ).toBeDefined();
    // The button that was pressed is still there, so focus stays and the notice is read out.
    expect(screen.getByRole('alert').textContent).toMatch(/Too many requests/);
  });

  async function sentOnce(again: () => Response) {
    let sends = 0;
    answering({
      'POST /api/auth/password/forgot': () => (++sends === 1 ? json({}, 202) : again()),
    });
    at('/forgot-password');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send it again' }));
  }

  it('takes focus back to Check your email once Send it again has sent', async () => {
    await sentOnce(() => json({}, 202));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Check your email' }),
      ),
    );
  });

  it('takes focus to the notice when Send it again fails, read once rather than announced too', async () => {
    await sentOnce(() => {
      throw new TypeError('Failed to fetch');
    });

    const notice = await screen.findByText('That did not work');
    await waitFor(() => expect(document.activeElement).toBe(notice.closest('.notice')));
    expect(document.activeElement?.textContent).toMatch(/Something went wrong on the way/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes focus to the notice when Send it again is refused for too many', async () => {
    await sentOnce(() => problem('too_many_attempts', 429, { 'Retry-After': '600' }));

    const notice = await screen.findByText('Too many requests');
    await waitFor(() => expect(document.activeElement).toBe(notice.closest('.notice')));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('sending the link again', () => {
  function sentOnce(again: () => Response | Promise<Response>) {
    let answered = 0;
    const sent = answering({
      'POST /api/auth/password/forgot': () => (answered++ === 0 ? json({}, 202) : again()),
    });
    at('/forgot-password');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Folake@ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    return sent;
  }

  async function sendAgain(): Promise<void> {
    fireEvent.click(await screen.findByRole('button', { name: 'Send it again' }));
  }

  it('keeps the address as it was typed when the send fails', async () => {
    sentOnce(() => {
      throw new TypeError('Failed to fetch');
    });
    await sendAgain();

    await waitFor(() => expect(screen.getByText('That did not work')).toBeDefined());
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('Folake@ire.events');
  });

  it('keeps the address when the send is refused for too many', async () => {
    sentOnce(() => problem('too_many_attempts', 429, { 'Retry-After': '600' }));
    await sendAgain();

    await waitFor(() => expect(screen.getByText('Too many requests')).toBeDefined());
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('Folake@ire.events');
  });

  it('shows the address while it sends again', async () => {
    sentOnce(() => new Promise<never>(() => {}));
    await sendAgain();

    await waitFor(() =>
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('Folake@ire.events'),
    );
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDefined();
  });

  it('sends to the address the field shows, unchanged, and to a changed one instead of the earlier', async () => {
    const sent = sentOnce(() => {
      throw new TypeError('Failed to fetch');
    });
    await sendAgain();
    await waitFor(() => expect(screen.getByText('That did not work')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    await waitFor(() => expect(sent).toHaveLength(3));
    await waitFor(() => expect(screen.getByText('That did not work')).toBeDefined());

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ade@ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    await waitFor(() => expect(sent).toHaveLength(4));
    expect(sent.map(({ body }) => body)).toEqual([
      { email: 'Folake@ire.events' },
      { email: 'Folake@ire.events' },
      { email: 'Folake@ire.events' },
      { email: 'ade@ire.events' },
    ]);
  });

  it('asks for an address emptied by hand, and sends nothing', async () => {
    const sent = sentOnce(() => {
      throw new TypeError('Failed to fetch');
    });
    await sendAgain();
    await waitFor(() => expect(screen.getByText('That did not work')).toBeDefined());

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    expect(screen.getByText('Enter your email address.')).toBeDefined();
    await settled();
    expect(sent).toHaveLength(2);
  });
});

describe('setting a new password from the link', () => {
  function checked(answers: Record<string, () => Response> = {}) {
    return answering({
      'POST /api/auth/password/reset/check': () => json({ email: 'folake@ire.events' }),
      ...answers,
    });
  }

  it('says whose link it is, and that every other device will be signed out', async () => {
    checked();
    at('/reset-password?token=t1');

    await waitFor(() => expect(screen.getByText('For folake@ire.events.')).toBeDefined());
    expect(screen.getByText(/signs you out on every other device/)).toBeDefined();
    expect(screen.getByText('At least 15 characters')).toBeDefined();
  });

  it('sends nothing for a blank or short password', async () => {
    const sent = checked();
    at('/reset-password?token=t1');
    await screen.findByLabelText('New password');

    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    expect(screen.getByText('Enter a new password.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'too short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    expect(sent.filter((request) => request.path === '/api/auth/password/reset')).toEqual([]);
  });

  it('says a breached password is breached, in the design’s words', async () => {
    checked({
      'POST /api/auth/password/reset': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'No.',
            status: 422,
            violations: [
              { propertyPath: 'password', message: 'Breached.', code: 'password_breached' },
            ],
          },
          422,
        ),
    });
    at('/reset-password?token=t1');
    await screen.findByLabelText('New password');

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'password1234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    await waitFor(() =>
      expect(
        screen.getByText('This password has appeared in a known data breach. Choose another.'),
      ).toBeDefined(),
    );
  });

  it('sets it, says this device is signed in, and goes on to Soirely', async () => {
    const sent = checked({
      'POST /api/auth/password/reset': () =>
        json({
          accessToken: 'a',
          expiresIn: 900,
          refreshTokenExpiresIn: 2592000,
          account: ACCOUNT,
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    at('/reset-password?token=t1');
    await screen.findByLabelText('New password');

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    await waitFor(
      () =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { level: 1, name: 'Password changed' }),
        ),
      { timeout: 3000 },
    );
    expect(
      screen.getByText(/We have emailed folake@ire.events to say it was changed/),
    ).toBeDefined();
    expect(sent.find((request) => request.path === '/api/auth/password/reset')?.body).toMatchObject(
      {
        token: 't1',
        password: 'a brand new passphrase',
      },
    );
  });

  it('under a Google-or-Apple-only rule, sets it and ends at the provider buttons, as a sign-in would (sc-69)', async () => {
    checked({
      'POST /api/auth/password/reset': () =>
        json(
          {
            type: 'https://soirely.com/errors/oauth_only',
            title: 'No.',
            status: 403,
            organisation: 'Ìrè Events',
            providers: ['google'],
            email: 'folake@ire.events',
          },
          403,
        ),
    });
    at('/reset-password?token=t1');
    await screen.findByLabelText('New password');

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /Ìrè Events signs in with Google or Apple only/,
      ),
    );
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('folake@ire.events');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
  });

  it('with two-factor on, asks for the code before the new password, and changes nothing first', async () => {
    const sent = answering({
      'POST /api/auth/password/reset/check': () =>
        json({ email: 'folake@ire.events', twoFactor: true }),
      'POST /api/auth/password/reset/code': () => new Response(null, { status: 204 }),
      'POST /api/auth/password/reset': () =>
        json({
          accessToken: 'a',
          refreshExpiresAt: '2026-11-17T12:00:00+00:00',
          sessionId: 's',
          account: ACCOUNT,
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    at('/reset-password?token=t1');

    await screen.findByRole('heading', { level: 1, name: 'Enter your code' });
    expect(screen.getByText(/Nothing changes until it passes\./)).toBeDefined();
    expect(screen.queryByLabelText('New password')).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to a new password' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Set a new password' }),
      ),
    );
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    await waitFor(
      () =>
        expect(screen.getByRole('heading', { level: 1, name: 'Password changed' })).toBeDefined(),
      { timeout: 3000 },
    );
    expect(sent.map((request) => request.path)).toEqual([
      '/api/auth/password/reset/check',
      '/api/auth/password/reset/code',
      '/api/auth/password/reset',
      '/api/orgs',
    ]);
    expect(sent[1]?.body).toEqual({ token: 't1', code: '123456' });
  });

  it.each([
    ['reset_link_used', 410, 'This link has already been used'],
    ['reset_link_expired', 410, 'This link has expired'],
    ['reset_link_invalid', 404, "This link doesn't work"],
  ])('shows its own page for %s, with a way to send a new link', async (code, status, title) => {
    answering({ 'POST /api/auth/password/reset/check': () => problem(code, status) });
    at('/reset-password?token=t1');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeDefined(),
    );
    expect(screen.getByRole('link', { name: 'Send a new link' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
    // Shown as the page opens: nobody clicked, so focus is not moved.
    expect(document.activeElement).toBe(document.body);
  });

  it('names the dead link in the back control of the page it sends to, and goes back to it (sc-23279)', async () => {
    answering({
      'POST /api/auth/password/reset/check': () => problem('reset_link_expired', 410),
    });
    at('/reset-password?token=t1');

    fireEvent.click(await screen.findByRole('link', { name: 'Send a new link' }));
    await screen.findByRole('heading', { level: 1, name: 'Reset your password' });
    fireEvent.click(screen.getByRole('button', { name: 'This link has expired' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeDefined();
  });

  it.each([
    ['reset_link_used', 410, 'This link has already been used'],
    ['reset_link_expired', 410, 'This link has expired'],
  ])(
    'takes focus to its page for %s once the link dies under a click',
    async (code, status, title) => {
      checked({ 'POST /api/auth/password/reset': () => problem(code, status) });
      at('/reset-password?token=t1');

      fireEvent.change(await screen.findByLabelText('New password'), {
        target: { value: 'a brand new passphrase' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: title })),
      );
    },
  );

  it.each([
    ['reset_link_used', 410, 'This link has already been used'],
    ['two_factor_challenge_invalid', 401, 'This link has expired'],
  ])('takes focus to its page for %s once the code is checked', async (code, status, title) => {
    answering({
      'POST /api/auth/password/reset/check': () =>
        json({ email: 'folake@ire.events', twoFactor: true }),
      'POST /api/auth/password/reset/code': () => problem(code, status),
      // A 401 is retried after a refresh; signed out, the refresh is refused.
      'POST /api/auth/refresh': () => problem('invalid_refresh_token', 401),
    });
    at('/reset-password?token=t1');

    await screen.findByRole('heading', { level: 1, name: 'Enter your code' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to a new password' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: title })),
    );
  });
});

describe('the reset code step failing on the way', () => {
  it.each([
    ['an app code', null, '123456'],
    ['a recovery code', 'Use a recovery code instead', 'abcd-efgh'],
  ])('says the reset did not work, for %s', async (_, switchTo, code) => {
    answering({
      'POST /api/auth/password/reset/check': () =>
        json({ email: 'folake@ire.events', twoFactor: true }),
      'POST /api/auth/password/reset/code': () => problem('internal_error', 503),
    });
    at('/reset-password?token=t1');

    await screen.findByRole('heading', { level: 1, name: 'Enter your code' });
    if (switchTo != null) fireEvent.click(screen.getByRole('button', { name: switchTo }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: code } });
    fireEvent.click(
      screen.getByRole('button', {
        name: switchTo == null ? 'Continue to a new password' : 'Use this code',
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain('That did not work');
    expect(
      screen.getByText('Something went wrong on the way. Try again in a moment.'),
    ).toBeDefined();
    expect(screen.queryByText('Signing in did not work')).toBeNull();
  });
});
