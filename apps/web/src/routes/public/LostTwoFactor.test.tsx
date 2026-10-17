import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { routes } from '../index.tsx';

const CHALLENGE = {
  twoFactorChallenge: 'the-challenge',
  challengeExpiresAt: '2026-10-17T12:05:00+00:00',
  email: 'folake@ire.events',
};

const OPENING = {
  email: 'folake@ire.events',
  phone: '+2348035550142',
  organisations: ['Ìrè Events'],
  nobody: false,
  supportAddress: 'support@soirely.com',
  recovery: null,
  state: null,
};

const PROVING = {
  status: 'proving',
  email: 'folake@ire.events',
  phone: '+2348035550142',
  organisations: ['Ìrè Events'],
  askedAt: null,
  asked: null,
  expiresAt: null,
  expires: null,
  codes: { state: 'live', cooldownSeconds: 42, route: 'sms_only' },
};

const WAITING = {
  ...PROVING,
  status: 'waiting',
  askedAt: '2026-10-17T13:20:00+00:00',
  asked: 'Saturday, Oct 17 at 14:20 WAT',
  expiresAt: '2026-10-24T13:20:00+00:00',
  expires: 'Saturday, Oct 24 at 14:20 WAT',
  codes: null,
};

// Sign-in, the challenge, then this page: more than waitFor's default second under load.
const THE_WAY_IN = { timeout: 3000 };

function answering(answers: Record<string, () => Response>) {
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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra },
    status,
    headers,
  );
}

async function atTheStart(answers: Record<string, () => Response>) {
  const sent = answering({
    'POST /api/auth/login': () => json(CHALLENGE, 202),
    'POST /api/auth/two-factor/recovery/opening': () => json(OPENING),
    ...answers,
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sign-in'] })} />);

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a decent passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: 'Lost your authenticator and your recovery codes?' },
      THE_WAY_IN,
    ),
  );
  await screen.findByRole(
    'heading',
    { level: 1, name: /Get back in|Contact Soirely support|Enter both codes|Waiting/ },
    THE_WAY_IN,
  );

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  __setSessionState({ status: 'unknown' });
});

describe('getting back in without the authenticator', () => {
  it('says what happens before sending anything, then sends the codes', async () => {
    const sent = await atTheStart({
      'POST /api/auth/two-factor/recovery': () => json({ recovery: 'handle', state: PROVING }, 201),
    });

    expect(
      screen.getByText(
        'We send a code to folake@ire.events, and one to +234 803 555 0142 if your number is verified.',
      ),
    ).toBeDefined();
    expect(screen.getByText(/An owner or admin of Ìrè Events confirms it’s you/)).toBeDefined();
    expect(sent.at(-1)).toEqual({
      path: '/api/auth/two-factor/recovery/opening',
      body: { challenge: 'the-challenge' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Enter both codes' }),
    ).toBeDefined();
    expect(screen.getByLabelText('Code from the email')).toBeDefined();
    expect(screen.getByLabelText('Code from the text')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send new codes in 0:42' })).toBeDefined();
  });

  it('checks both codes before asking, and marks only the one the server says is wrong', async () => {
    const sent = await atTheStart({
      'POST /api/auth/two-factor/recovery': () => json({ recovery: 'handle', state: PROVING }, 201),
      'POST /api/auth/two-factor/recovery/prove': () =>
        problem('verification_code_invalid', 422, {
          violations: [
            {
              propertyPath: 'phoneCode',
              message: 'That code does not match.',
              code: 'verification_code_invalid',
            },
          ],
        }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await screen.findByRole('heading', { level: 1, name: 'Enter both codes' });

    fireEvent.click(screen.getByRole('button', { name: 'Ask to get back in' }));
    expect(screen.getByText('Enter the 6-digit code from the email.')).toBeDefined();
    expect(screen.getByText('Enter the 6-digit code from the text.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Code from the email'));
    expect(sent.some((request) => request.path.endsWith('/prove'))).toBe(false);

    fireEvent.change(screen.getByLabelText('Code from the email'), {
      target: { value: '481 920' },
    });
    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '305117' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask to get back in' }));

    expect(
      await screen.findByText(
        'That code does not match. Check the newest text from Soirely and try again.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/newest email from Soirely/)).toBeNull();
    expect(sent.at(-1)?.body).toEqual({
      recovery: 'handle',
      emailCode: '481920',
      phoneCode: '305117',
    });
  });

  it('waits, signed out, until somebody answers, and cancelling ends it', async () => {
    await atTheStart({
      'POST /api/auth/two-factor/recovery': () => json({ recovery: 'handle', state: PROVING }, 201),
      'POST /api/auth/two-factor/recovery/prove': () => json({ state: WAITING }),
      'POST /api/auth/two-factor/recovery/cancel': () =>
        json({ state: { ...WAITING, status: 'cancelled' } }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await screen.findByRole('heading', { level: 1, name: 'Enter both codes' });
    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '481920' } });
    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '305117' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask to get back in' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Waiting for your organisation' }),
    ).toBeDefined();
    expect(screen.getByText('Asked Saturday, Oct 17 at 14:20 WAT.')).toBeDefined();
    expect(
      screen.getByText('If nobody answers by Saturday, Oct 24 at 14:20 WAT, the request ends.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel the request' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Request cancelled' }),
    ).toBeDefined();
  });

  it('says nobody can confirm it when the last approver left while the codes were out', async () => {
    await atTheStart({
      'POST /api/auth/two-factor/recovery': () =>
        json(
          { recovery: 'handle', state: { ...PROVING, supportAddress: 'support@soirely.com' } },
          201,
        ),
      'POST /api/auth/two-factor/recovery/prove': () => problem('recovery_nobody_to_approve', 409),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await screen.findByRole('heading', { level: 1, name: 'Enter both codes' });
    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '481920' } });
    fireEvent.change(screen.getByLabelText('Code from the text'), { target: { value: '305117' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask to get back in' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Contact Soirely support' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Email support@soirely.com' })).toBeDefined();
    expect(sessionStorage.getItem('soirely.twoFactorRecovery')).toBeNull();
  });

  it('opens the waiting screen when the codes were already proved on another device', async () => {
    await atTheStart({
      'POST /api/auth/two-factor/recovery': () =>
        json(
          {
            recovery: 'handle',
            state: { ...PROVING, codes: { ...PROVING.codes, cooldownSeconds: 0 } },
          },
          201,
        ),
      'POST /api/auth/two-factor/recovery/resend': () => problem('recovery_request_proved', 409),
      'POST /api/auth/two-factor/recovery/state': () => json({ state: WAITING }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await screen.findByRole('heading', { level: 1, name: 'Enter both codes' });

    fireEvent.click(screen.getByRole('button', { name: 'Send new codes' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Waiting for your organisation' }),
    ).toBeDefined();
  });

  it('says a request replaced on another device was started again there, and starts again here', async () => {
    const sent = await atTheStart({
      'POST /api/auth/two-factor/recovery': () =>
        json(
          {
            recovery: 'handle',
            state: { ...PROVING, codes: { ...PROVING.codes, cooldownSeconds: 0 } },
          },
          201,
        ),
      'POST /api/auth/two-factor/recovery/resend': () =>
        problem('recovery_request_replaced', 409, { requestStatus: 'replaced' }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await screen.findByRole('heading', { level: 1, name: 'Enter both codes' });

    fireEvent.click(screen.getByRole('button', { name: 'Send new codes' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Started again on another device' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'A newer request was started on another device. Start again to ask from here.',
      ),
    ).toBeDefined();
    expect(sessionStorage.getItem('soirely.twoFactorRecovery')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
    expect(await screen.findByRole('button', { name: 'Send the codes' })).toBeDefined();
    expect(sent.filter((s) => s.path === '/api/auth/two-factor/recovery')).toHaveLength(1);
  });

  it('sends nobody codes when nobody can answer', async () => {
    await atTheStart({
      'POST /api/auth/two-factor/recovery/opening': () => json({ ...OPENING, nobody: true }),
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Contact Soirely support' }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Email support@soirely.com' }).getAttribute('href'),
    ).toBe('mailto:support@soirely.com');
  });

  it('says when a fourth request today can be made', async () => {
    await atTheStart({
      'POST /api/auth/two-factor/recovery': () =>
        problem(
          'too_many_attempts',
          429,
          { retryAt: 'Sunday, Oct 18 at 17:09 WAT' },
          { 'Retry-After': '600' },
        ),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));

    expect(await screen.findByText('Too many requests')).toBeDefined();
    expect(
      screen.getByText('You can ask 3 times a day. Try again Sunday, Oct 18 at 17:09 WAT.'),
    ).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Send the codes' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('after an approved request', () => {
  it('asks to set two-factor up again first, and "Not now" carries on', async () => {
    const sent = answering({
      'POST /api/auth/login': () =>
        json({
          accessToken: 'a',
          expiresIn: 900,
          refreshToken: 'r',
          account: {
            id: 'acc_1',
            name: 'Folake',
            verified: true,
            complete: true,
            hasPassword: true,
            twoFactorSetupPrompt: true,
            emailAddresses: [
              { id: 'a1', address: 'folake@ire.events', verified: true, primary: true },
            ],
            phoneNumbers: [],
            providers: [],
          },
        }),
      'DELETE /api/auth/two-factor/setup-prompt': () => new Response(null, { status: 204 }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sign-in'] })} />,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@ire.events' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up two-factor again' }, THE_WAY_IN),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Set up two-factor' }).getAttribute('href')).toBe(
      '/app/account/security',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(sent.some((request) => request.path === '/api/auth/two-factor/setup-prompt')).toBe(
        true,
      ),
    );
  });
});

describe('"This wasn\'t me" from an email', () => {
  it('does nothing until it is pressed, then cancels and signs out everywhere', async () => {
    const sent = answering({
      'POST /api/auth/two-factor/recovery/not-me': () => new Response(null, { status: 204 }),
    });
    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ['/two-factor/not-me?request=rq_1&token=signed'],
        })}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'This wasn’t you?' })).toBeDefined();
    expect(sent).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel and sign out everywhere' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cancelled and signed out' }),
    ).toBeDefined();
    expect(sent).toEqual([
      { path: '/api/auth/two-factor/recovery/not-me', body: { request: 'rq_1', token: 'signed' } },
    ]);
  });
});
