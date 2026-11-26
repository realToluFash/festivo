import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { formatDay } from '@soirely/domain';

import { dateLocale } from '../../i18n/index.ts';
import { __setSessionState } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { tokens } from '../../tokens.ts';
import { routes } from '../index.tsx';

/** As RedeemController answers GET /api/door-codes/{code} (PR #3354's contract). */
const OPENED = {
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  event: {
    id: 'ev_1',
    name: 'Joana & Rui’s wedding',
    startsAt: '2030-11-14T15:00:00+00:00',
    endsAt: '2030-11-14T23:30:00+00:00',
    timeZone: 'Europe/Lisbon',
    organisation: 'Lumen Feiras',
    country: 'PT',
  },
  standing: null,
};

const REFUSED = {
  type: 'https://soirely.com/errors/door_code_invalid',
  title: 'That code does not work. Check it with whoever gave it to you.',
  status: 404,
  code: 'door_code_invalid',
};

/** As /api/me answers for an account the cookie signs in. */
function account(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'u_kemi',
    name: 'Kemi Okafor',
    businessName: null,
    countryCode: 'PT',
    organisationCountry: null,
    locale: 'en',
    timezone: null,
    waitingFor: null,
    verified: true,
    complete: true,
    needsOrganisation: true,
    hasPassword: true,
    emailAddresses: [{ id: 'a1', address: 'kemi@example.com', verified: true, primary: true }],
    phoneNumbers: [],
    outsideEvents: [],
    ...overrides,
  };
}

const ISSUED = {
  accessToken: 'an-access-token',
  refreshExpiresAt: '2030-11-15T00:00:00+00:00',
  sessionId: '018f3a4c-0001-7c3d-9e1f-2a3b4c5d6e7f',
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function signedIn(outsideEvents: unknown[] = [], signedOutAt: string | null = null): void {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
  const ire = membership({ id: 'org_2', name: 'Ìrè Events' });
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Kemi Okafor',
      email: 'kemi@example.com',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u_kemi',
      needsOrganisation: false,
      hasPassword: true,
      organisation: ire,
      organisations: [ire],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
      outsideEvents,
      signedOutAt,
    },
  } as never);
}

function signedOut(): void {
  tokens.clear();
  __setSessionState({ status: 'signedOut', ended: false });
}

/** Only the refresh cookie: nothing in memory, so the page has to ask who this browser is. */
function cookieOnly(): void {
  tokens.clear();
  __setSessionState({ status: 'unknown' });
}

interface Sent {
  line: string;
  body: unknown;
  bearer: string | null;
}

let router: ReturnType<typeof createMemoryRouter>;

function at(path: string, answers: Record<string, (sent: Sent) => Response>): Sent[] {
  const sent: Sent[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const bearer = new Headers(init?.headers).get('Authorization');
    const one = {
      line,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      bearer,
    };
    sent.push(one);

    return answers[line]?.(one) ?? json({});
  });
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return sent;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const OPENING = { cooldownSeconds: 60, codeState: 'live', route: 'whatsapp' };

const IN = {
  eventId: 'ev_1',
  name: 'Adébáyọ̀ Ọlá',
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  endsAt: '2030-11-14T23:30:00+00:00',
  again: false,
};

/** Signed out: the name, Portugal's code and a mobile, then Send code (sc-4235). */
async function sendTo(name: string, number = '912 344 512'): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'PT' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: number } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
}

async function typeCode(code = '123456'): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Code from WhatsApp'), {
    target: { value: code },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('the browser’s redeem pages (sc-72)', () => {
  it('checks the code before it sends anything, in any case and with spaces ignored', async () => {
    signedOut();
    const sent = at('/d', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
    });
    const field = await screen.findByLabelText('Door code');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter the door code.')).toBeDefined();

    fireEvent.change(field, { target: { value: 'k7p2 q' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('A door code is 8 letters and numbers.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('GET /api/door-codes'))).toBe(false);

    fireEvent.change(field, { target: { value: 'k7p2-qx9m' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' }),
    ).toBeDefined();
    expect(screen.getByText(/Lumen Feiras · Can check guests in · Bar and drinks$/u)).toBeDefined();
  });

  it('gives one refusal for a code that does not work, and keeps what was typed', async () => {
    signedOut();
    at('/d', { 'GET /api/door-codes/Q7KM4XP3': () => json(REFUSED, 404) });

    fireEvent.change(await screen.findByLabelText('Door code'), {
      target: { value: 'Q7KM 4XP3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That code does not work. Check it with whoever gave it to you.',
    );
    expect(screen.getByLabelText('Door code')).toHaveProperty('value', 'Q7KM 4XP3');
  });

  it.each([
    ['the minute it lifts on the reader’s clock', new Date(2030, 10, 24, 13, 30, 40), 60, '13:32'],
    [
      'the day as well, when it lifts on another',
      new Date(2030, 10, 24, 23, 59, 30),
      120,
      `${formatDay(new Date(2030, 10, 25), dateLocale())} 00:02`,
    ],
  ])('says when too many tries were made, with %s', async (_, now, seconds, when) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    signedOut();
    at('/d/Q7KM4XP3', {
      'GET /api/door-codes/Q7KM4XP3': () =>
        json(
          {
            type: 'https://soirely.com/errors/too_many_attempts',
            title: 'Too many tries. Try again Tuesday 24 Nov at 13:32 UTC.',
            status: 429,
            retryAt: 'Tuesday 24 Nov at 13:32 UTC',
            code: 'too_many_attempts',
          },
          429,
          { 'Retry-After': String(seconds) },
        ),
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Too many tries' })).toBeDefined();
    expect(screen.getByText(`Try again at ${when}.`)).toBeDefined();
  });

  it('opens a code from the address and joins a signed-in person by their account', async () => {
    signedIn();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/redeem': () =>
        json(
          {
            eventId: 'ev_1',
            name: 'Kemi Okafor',
            role: 'can_check_in',
            jobLabel: 'Bar and drinks',
            endsAt: '2030-11-14T23:30:00+00:00',
            again: false,
          },
          201,
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Join as Kemi Okafor' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
      }),
    ).toBeDefined();
    expect(screen.getByText('Your access ends when the event does.')).toBeDefined();
    expect(screen.getByText('Signed in as Kemi Okafor')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
    await waitFor(() =>
      expect(sent.some((one) => one.line === 'POST /api/door-codes/K7P2QX9M/redeem')).toBe(true),
    );
  });

  it('signed out, asks a name and a mobile, sends a code to it, and joins on the right one', async () => {
    signedOut();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () =>
        json({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () => json(OPENING),
      'POST /api/door-codes/K7P2QX9M/sign-in': () =>
        json({ ...ISSUED, account: account({ name: 'Adébáyọ̀ Ọlá' }), ...IN }),
    });

    const title = await screen.findByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.queryByRole('button', { name: /Join as/u })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Enter your full name.')).toBeDefined();
    const numberLine = screen.getByText('Enter your mobile number.');
    expect(numberLine.closest('.rd-phone')).toBeNull();
    expect(numberLine.previousElementSibling?.classList.contains('rd-phone')).toBe(true);
    expect(screen.getByLabelText('Mobile number').getAttribute('aria-describedby')).toBe(
      numberLine.id,
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Your name'));
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);

    await sendTo('  Adébáyọ̀ Ọlá ');
    expect(await screen.findByRole('heading', { level: 1, name: 'Check WhatsApp' })).toBeDefined();
    expect(screen.getByText('We sent a code to your WhatsApp on +351 912 344 512.')).toBeDefined();
    expect(
      sent.find((one) => one.line === 'POST /api/door-codes/K7P2QX9M/sign-in/send')?.body,
    ).toEqual({ name: 'Adébáyọ̀ Ọlá', countryCode: 'PT', number: '912 344 512' });

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText('Enter the 6-digit code from WhatsApp.')).toBeDefined();

    await typeCode();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
      }),
    ).toBeDefined();
    expect(screen.getByText('Signed in as Adébáyọ̀ Ọlá')).toBeDefined();
    expect(screen.getByText(/^You’ll be signed out at .*23:30\.$/u)).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/door-codes/K7P2QX9M/sign-in')?.body).toEqual(
      expect.objectContaining({ handle: 'h1', code: '123456' }),
    );
  });

  it('keeps the name and the number when the code stops working', async () => {
    signedOut();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () => json(REFUSED, 404),
    });

    await sendTo('Hugo Brandão');

    expect(
      await screen.findByText('That code does not work. Check it with whoever gave it to you.'),
    ).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Hugo Brandão');
    expect((screen.getByLabelText('Mobile number') as HTMLInputElement).value).toBe('912 344 512');
  });

  it('puts the API’s refusal of the number under the number, and clears it once it is retyped', async () => {
    signedOut();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Validation failed',
            status: 422,
            violations: [
              { propertyPath: 'number', message: 'That is not a mobile number for Portugal.' },
            ],
          },
          422,
        ),
    });

    await sendTo('Hugo Brandão');

    expect(await screen.findByText('That is not a mobile number for Portugal.')).toBeDefined();
    const number = screen.getByLabelText('Mobile number');
    expect(number.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(number);
    expect(screen.queryByText(/Something went wrong/u)).toBeNull();

    fireEvent.change(number, { target: { value: '912 344 513' } });
    expect(screen.queryByText('That is not a mobile number for Portugal.')).toBeNull();
  });

  it('says an alternative number cannot sign in, back on the number', async () => {
    signedOut();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () =>
        json({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () => json(OPENING),
      'POST /api/door-codes/K7P2QX9M/sign-in': () =>
        json(
          {
            type: 'https://soirely.com/errors/phone_alternative',
            title: 'Alternative',
            status: 409,
          },
          409,
        ),
    });

    await sendTo('Hugo Brandão');
    await typeCode();

    expect(
      await screen.findByText(/^This is an alternative number on a Soirely account/u),
    ).toBeDefined();
    expect(screen.getByLabelText('Mobile number').getAttribute('aria-invalid')).toBe('true');
  });

  it('refuses a Google-or-Apple-only member after the right code, forgetting the name (sc-94849)', async () => {
    signedOut();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () =>
        json({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () => json(OPENING),
      'POST /api/door-codes/K7P2QX9M/sign-in': () =>
        json(
          {
            type: 'https://soirely.com/errors/oauth_only',
            title: 'No',
            status: 403,
            organisation: 'Ìrè Events',
            email: 'bisi@ire.events',
            providers: ['apple', 'google'],
          },
          403,
        ),
    });

    await sendTo('Bisi');
    await typeCode();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Ìrè Events signs in with Google or Apple only',
      }),
    ).toBeDefined();
    expect(
      screen.getByText(/^A code sent to your phone cannot sign you in to this account\./u),
    ).toBeDefined();
    const buttons = screen.getAllByRole('button', { name: /^Continue with/u });
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Continue with Google',
      'Continue with Apple',
    ]);
    expect(screen.queryByLabelText('Mobile number')).toBeNull();
    expect(screen.queryByDisplayValue('Bisi')).toBeNull();
  });

  it('asks two-factor before the grant, on the code screen', async () => {
    signedOut();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () =>
        json({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () => json(OPENING),
      'POST /api/door-codes/K7P2QX9M/sign-in': () =>
        json(
          {
            twoFactorChallenge: 'c1',
            challengeExpiresAt: '2030-11-14T15:05:00+00:00',
            email: null,
            phone: { countryCode: 'PT', lastDigits: '4512' },
            factors: { app: true, passkeys: false },
          },
          202,
        ),
    });

    await sendTo('Hugo Brandão');
    await typeCode();

    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in/code'));
    expect(await screen.findByText(/\+351 ••• ••• 4512/u)).toBeDefined();
  });

  it('turns a member of the organisation away, with Open Events', async () => {
    signedIn();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json({ ...OPENED, standing: 'member' }),
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You are already a member of Lumen Feiras',
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Members open an event from its People page. Ask its lead or an admin to add you.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Events' })).toBeDefined();
    expect(document.querySelector('.rd-tile')).not.toBeNull();
  });

  it('opens a scanned code as the account the cookie signs in, and joins as it', async () => {
    cookieOnly();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/auth/me': ({ bearer }) =>
        bearer == null ? json({ status: 401 }, 401) : json(account()),
      'POST /api/auth/refresh': () => json(ISSUED),
      'GET /api/orgs': () => json({ organisations: [] }),
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
    });

    expect(await screen.findByRole('button', { name: 'Join as Kemi Okafor' })).toBeDefined();
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(sent.find((one) => one.line === 'GET /api/door-codes/K7P2QX9M')?.bearer).toBe(
      'Bearer an-access-token',
    );
  });

  it('turns away a member the cookie signs in, with no name asked', async () => {
    cookieOnly();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/auth/me': ({ bearer }) =>
        bearer == null ? json({ status: 401 }, 401) : json(account()),
      'POST /api/auth/refresh': () => json(ISSUED),
      'GET /api/orgs': () => json({ organisations: [] }),
      'GET /api/door-codes/K7P2QX9M': ({ bearer }) =>
        json({ ...OPENED, standing: bearer == null ? null : 'member' }),
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You are already a member of Lumen Feiras',
      }),
    ).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('POST /api/door-codes'))).toBe(false);
  });

  it('signed out, adopts the account the code makes, so Open the event opens it', async () => {
    cookieOnly();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/auth/me': ({ bearer }) =>
        bearer == null
          ? json({ status: 401 }, 401)
          : json(
              account({
                name: 'Hugo Brandão',
                verified: false,
                emailAddresses: [],
                hasPassword: false,
              }),
            ),
      'POST /api/auth/refresh': () => json({ status: 401 }, 401),
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': () =>
        json({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () => json(OPENING),
      'POST /api/door-codes/K7P2QX9M/sign-in': () =>
        json({
          ...ISSUED,
          account: account({ name: 'Hugo Brandão', emailAddresses: [], hasPassword: false }),
          ...IN,
          name: 'Hugo Brandão',
        }),
    });

    await sendTo('Hugo Brandão');
    await typeCode();
    fireEvent.click(await screen.findByRole('button', { name: 'Open the event' }));

    expect(
      sent.some(
        (one) => one.line === 'GET /api/auth/me' && one.bearer === 'Bearer an-access-token',
      ),
    ).toBe(true);
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
    expect(router.state.location.pathname).not.toBe('/sign-in');
  });

  it('signed in, reads the events held from outside again, so Open the event opens it outside', async () => {
    signedIn();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/redeem': () =>
        json(
          {
            eventId: 'ev_1',
            name: 'Kemi Okafor',
            role: 'can_check_in',
            jobLabel: 'Bar and drinks',
            endsAt: '2030-11-14T23:30:00+00:00',
            again: false,
          },
          201,
        ),
      'GET /api/auth/me': () =>
        json(
          account({
            needsOrganisation: false,
            outsideEvents: [
              {
                id: 'ev_1',
                name: OPENED.event.name,
                organisationName: 'Lumen Feiras',
                role: 'can_check_in',
                jobLabel: 'Bar and drinks',
                startsAt: OPENED.event.startsAt,
                endsAt: OPENED.event.endsAt,
                timeZone: 'Europe/Lisbon',
              },
            ],
          }),
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Join as Kemi Okafor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open the event' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
    await waitFor(() => expect(sent.some((one) => one.line === 'GET /api/events/ev_1')).toBe(true));
    await waitFor(() => expect(document.querySelector('.outside-person')).not.toBeNull());
    expect(sent.some((one) => one.line.startsWith('GET /api/orgs/org_2/'))).toBe(false);
  });

  it.each([
    ['the API fails', () => json({ status: 500, title: 'Internal' }, 500)],
    [
      'the request never arrives',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('says something went wrong, not that the code does not work, when %s', async (_, fails) => {
    signedOut();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/sign-in/send': fails,
    });

    await sendTo('Hugo Brandão');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong on the way. Try again in a moment.',
    );
    expect(screen.queryByText(/That code does not work/u)).toBeNull();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Hugo Brandão');
  });
});

describe('"You’re in for…" leads to check-in (sc-28230)', () => {
  const REDEEMED = (role: string) => ({
    eventId: 'ev_1',
    name: 'Kemi Okafor',
    role,
    jobLabel: 'Bar and drinks',
    endsAt: '2030-11-14T23:30:00+00:00',
    again: false,
  });

  it('offers Check-in to a code that checks guests in', async () => {
    signedIn();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/redeem': () => json(REDEEMED('can_check_in'), 201),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Join as Kemi Okafor' }));

    expect((await screen.findByRole('link', { name: 'Check-in' })).getAttribute('href')).toBe(
      '/door/ev_1',
    );
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
  });

  it('offers no Check-in to a code that can only view', async () => {
    signedIn();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json({ ...OPENED, role: 'can_view' }),
      'POST /api/door-codes/K7P2QX9M/redeem': () => json(REDEEMED('can_view'), 201),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Join as Kemi Okafor' }));

    expect(await screen.findByRole('button', { name: 'Open the event' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Check-in' })).toBeNull();
  });

  it('says when a session signed in at the door ends after it redeems another code, as /d/in/:eventId does', async () => {
    signedIn([], '2030-11-14T18:00:00+00:00');
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/redeem': () => json(REDEEMED('can_check_in'), 201),
      'GET /api/auth/me': () =>
        json(account({ needsOrganisation: false, signedOutAt: '2030-11-14T18:00:00+00:00' })),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Join as Kemi Okafor' }));

    expect(await screen.findByText(/^You’ll be signed out at .*18:00\.$/u)).toBeDefined();
  });

  it('reads /d/in/:eventId as after redeeming, and redeems nothing again', async () => {
    signedIn([
      {
        id: 'ev_1',
        name: 'Joana & Rui’s wedding',
        organisationName: 'Lumen Feiras',
        role: 'can_check_in',
        jobLabel: 'Bar and drinks',
        startsAt: '2030-11-14T15:00:00+00:00',
        endsAt: '2030-11-14T23:30:00+00:00',
        timeZone: 'Europe/Lisbon',
      },
    ]);
    const sent = at('/d/in/ev_1', {});

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
      }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Check-in' }).getAttribute('href')).toBe('/door/ev_1');
    expect(sent.filter((one) => one.line.includes('/redeem'))).toEqual([]);
    expect(screen.queryByText(/^You’ll be signed out at/u)).toBeNull();
  });

  it('reads when a session signed in at the door ends on /d/in/:eventId, as after redeeming, on the event’s clock', async () => {
    signedIn(
      [
        {
          id: 'ev_1',
          name: 'Joana & Rui’s wedding',
          organisationName: 'Lumen Feiras',
          role: 'can_check_in',
          jobLabel: 'Bar and drinks',
          startsAt: '2030-11-14T15:00:00+00:00',
          endsAt: '2030-11-14T23:30:00+00:00',
          timeZone: 'Africa/Lagos',
        },
      ],
      '2030-11-14T18:00:00+00:00',
    );
    at('/d/in/ev_1', {});

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
      }),
    ).toBeDefined();
    expect(screen.getByText(/^You’ll be signed out at .*19:00\.$/u)).toBeDefined();
  });
});
