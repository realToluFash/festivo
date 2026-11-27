import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { type Session, __setSessionState } from '../../session.ts';
import { tokens } from '../../tokens.ts';
import { routes } from '../index.tsx';

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
}

async function open(reply: () => Response, visible = true): Promise<string[]> {
  const asked: string[] = [];

  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visible ? 'visible' : 'hidden');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    asked.push(
      `${init?.method ?? 'GET'} ${new URL(String(input)).pathname} ${String(init?.body ?? '')}`,
    );

    return reply();
  });
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/w/tok_ada'] })} />,
  );
  await waitFor(() => expect(asked).not.toHaveLength(0));

  return asked;
}

describe('A person’s own link (sc-3912)', () => {
  beforeEach(() => {
    tokens.clear();
    __setSessionState({ status: 'signedOut', ended: false });
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends its token in the body of a POST, never in the address', async () => {
    const asked = await open(() => answer({ state: 'ended' }));

    expect(asked).toEqual(['POST /api/staff-links/opened {"token":"tok_ada"}']);
  });

  it('records nothing while the page is not visible', async () => {
    const asked = await open(() => answer({ state: 'ended' }), false);

    expect(asked).toEqual(['POST /api/staff-links/look {"token":"tok_ada"}']);
  });

  it('says when a link not open yet starts working, in the event’s own time', async () => {
    await open(() => answer({ state: 'not_yet', from: '2026-10-24T05:00:00+01:00' }));

    expect(
      await screen.findByRole('heading', {
        name: 'This link works from 05:00 on Saturday, Oct 24.',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('This link is yours alone. Nothing stays on this device.'),
    ).toBeTruthy();
  });

  it('says a link for someone with no shift yet is not open yet, with no time', async () => {
    await open(() => answer({ state: 'not_yet' }));

    expect(await screen.findByRole('heading', { name: 'This link is not open yet.' })).toBeTruthy();
    expect(
      screen.getByText('This link is yours alone. Nothing stays on this device.'),
    ).toBeTruthy();
  });

  it('says an ended link has ended', async () => {
    await open(() => answer({ state: 'ended' }));

    expect(await screen.findByRole('heading', { name: 'This link has ended.' })).toBeTruthy();
    expect(
      screen.getByText(
        'Staff links stop working 2 hours after your last shift, or when the event ends.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/stopped working/u)).toBeNull();
    expect(screen.getByText('Nothing stays on this device.')).toBeTruthy();
  });

  it('says only that an unknown, replaced or removed link does not work', async () => {
    await open(() =>
      answer(
        { type: 'https://soirely.com/errors/not_found', title: 'Not found', status: 404 },
        404,
      ),
    );

    expect(await screen.findByRole('heading', { name: 'This link does not work.' })).toBeTruthy();
  });

  it('says a failure is one to try again', async () => {
    await open(() =>
      answer({ type: 'https://soirely.com/errors/internal', title: 'Oops', status: 500 }, 500),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work. Try again in a moment.',
    );
  });
});

const OPEN = {
  state: 'open',
  event: { name: 'Joana & Rui’s wedding' },
  job: 'Bar and drinks',
  mobile: { countryCode: 'PT', lastDigits: '4512' },
  reader: null,
  name: null,
  signedOutAt: null,
  timeZone: null,
};

const YOURS = {
  ...OPEN,
  reader: 'yours',
  signedOutAt: '2027-03-07T02:00:00+00:00',
  timeZone: 'Europe/Lisbon',
};

const NIGHT = {
  pastAccess: false,
  clock: null as unknown,
  event: { id: 'ev-1', name: 'Joana & Rui’s wedding', timeZone: 'Europe/Lisbon' },
  endsAt: '2027-03-07T02:00:00+00:00',
  station: 'Section B',
  job: 'Waiter',
  shift: {
    job: 'Waiter',
    startsAt: '2027-03-06T17:00:00+00:00',
    endsAt: '2027-03-07T01:00:00+00:00',
  },
  later: null,
  lead: { name: 'Dayo Okafor', phone: '+351912345678', floor: false },
  timing: [{ at: '2027-03-06T18:30:00+00:00', title: 'Staff briefing', for: 'staff' }],
  doorsAt: '2020-03-06T16:00:00+00:00',
  tables: [
    {
      name: 'Table 7',
      guests: [
        {
          name: 'Folake Adeyemi',
          allergens: ['peanuts'],
          diets: ['vegetarian'],
          otherAllergy: null,
          otherDiet: null,
        },
      ],
    },
  ],
  checksIn: false,
  dishes: false,
  whosHere: false,
  rules: null,
};

const SIGNED_IN = {
  accessToken: 'a',
  refreshExpiresAt: '2027-03-07T02:00:00+00:00',
  sessionId: 's',
  account: {
    id: 'u_ana',
    userId: 'u_ana',
    name: 'Ana Sousa',
    businessName: null,
    countryCode: null,
    organisationCountry: null,
    locale: 'en',
    timezone: null,
    verified: true,
    complete: false,
    needsOrganisation: false,
    hasPassword: false,
    emailAddresses: [],
    phoneNumbers: [],
    providers: [],
  },
};

// The link, its code, then the app's code: more than findBy's default second under load.
const THE_WAY_IN = { timeout: 3000 };

const ANA: Session = {
  userId: 'u_ana',
  name: 'Ana Sousa',
  email: '',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  hasPassword: false,
  needsOrganisation: false,
  organisation: null,
  organisationCountry: null,
  organisations: [],
  timezone: null,
  waitingFor: null,
};

const CARD = {
  phase: 'on',
  opensAt: '2099-03-06T16:00:00+00:00',
  closesAt: '2099-03-06T22:00:00+00:00',
  clockedInAt: '2099-03-06T16:58:00+00:00',
  clockedOutAt: null as string | null,
  outUntil: '2099-03-07T04:00:00+00:00',
  workedMinutes: null as number | null,
};

function routed(answers: Record<string, () => Response>): string[] {
  const asked: string[] = [];
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    asked.push(`${line} ${String(init?.body ?? '')}`);

    return answers[line]?.() ?? answer({});
  });
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/w/tok_ada'] })} />,
  );

  return asked;
}

describe('A link opened signed out (sc-4235)', () => {
  beforeEach(() => {
    tokens.clear();
    __setSessionState({ status: 'signedOut', ended: false });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the event, the job and the masked number, and sends the code to it', async () => {
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(OPEN),
      'POST /api/staff-links/sign-in/send': () => answer({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () =>
        answer({ cooldownSeconds: 60, codeState: 'live', route: 'whatsapp' }),
    });

    expect(await screen.findByRole('heading', { name: 'Confirm it’s you' })).toBeTruthy();
    expect(screen.getByText('Joana & Rui’s wedding')).toBeTruthy();
    expect(screen.getByText('Bar and drinks')).toBeTruthy();
    expect(screen.getByText('We’ll send a code to +351 ••• ••• 4512.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Not your number?' }));
    expect(screen.getByText('Ask the event’s organiser to change it on the roster.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'Check WhatsApp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(asked).toContain('POST /api/staff-links/sign-in/send {"token":"tok_ada"}');
  });

  it('asks the organiser for a number when the roster has none', async () => {
    routed({ 'POST /api/staff-links/opened': () => answer({ ...OPEN, mobile: null }) });

    expect(await screen.findByRole('heading', { name: 'Joana & Rui’s wedding' })).toBeTruthy();
    expect(
      screen.getByText('Ask the event’s organiser to add your mobile number to the roster.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
  });

  it('signs in by the code and stays on the link, signed in', async () => {
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(OPEN),
      'POST /api/staff-links/sign-in/send': () => answer({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () =>
        answer({ cooldownSeconds: 60, codeState: 'live', route: 'sms_only' }),
      'POST /api/staff-links/sign-in': () => answer(SIGNED_IN),
      'POST /api/staff-links/look': () => answer(YOURS),
      'POST /api/staff-links/night': () => answer(NIGHT),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Code from the text'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Tonight you’re on Section B' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sign out' })).not.toHaveLength(0);
    expect(asked).toContain('POST /api/staff-links/look {"token":"tok_ada"}');
  });

  it('with two-factor on, signs in by the code and the app’s code, and lands back on the link', async () => {
    let verified = false;
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(verified ? YOURS : OPEN),
      'POST /api/staff-links/look': () => answer(verified ? YOURS : OPEN),
      'POST /api/staff-links/sign-in/send': () => answer({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () =>
        answer({ cooldownSeconds: 60, codeState: 'live', route: 'sms_only' }),
      'POST /api/staff-links/sign-in': () =>
        answer(
          {
            twoFactorChallenge: 'c1',
            challengeExpiresAt: '2030-11-14T15:05:00+00:00',
            email: null,
            phone: { countryCode: 'PT', lastDigits: '4512' },
            factors: { app: true, passkeys: false },
          },
          202,
        ),
      'POST /api/auth/two-factor/verify': () => {
        verified = true;
        return answer({ ...SIGNED_IN, account: { ...SIGNED_IN.account, complete: true } });
      },
      'GET /api/orgs': () => answer({ organisations: [] }),
      'POST /api/staff-links/night': () => answer(NIGHT),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Code from the text'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Enter your code' }, THE_WAY_IN),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Open your authenticator app and enter the 6-digit code for +351 ••• ••• 4512.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use a recovery code instead' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Back/u }), 'the link’s own step').toBeNull();
    expect(screen.queryByText(/Lost your authenticator/u)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(screen.getByText('Enter the 6-digit code from your app.')).toBeTruthy();
    expect(asked.some((line) => line.startsWith('POST /api/auth/two-factor/verify'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '654 321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Tonight you’re on Section B' }, THE_WAY_IN),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sign out' })).not.toHaveLength(0);
    expect(asked.find((line) => line.startsWith('POST /api/auth/two-factor/verify'))).toContain(
      '"challenge":"c1","code":"654321"',
    );
  });

  it('says an alternative number cannot sign in', async () => {
    routed({
      'POST /api/staff-links/opened': () => answer(OPEN),
      'POST /api/staff-links/sign-in/send': () => answer({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () =>
        answer({ cooldownSeconds: 60, codeState: 'live', route: 'sms_only' }),
      'POST /api/staff-links/sign-in': () =>
        answer(
          { type: 'https://soirely.com/errors/phone_alternative', title: 'No', status: 409 },
          409,
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Code from the text'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(/^This is an alternative number on a Soirely account/u),
    ).toBeTruthy();
  });

  it('refuses a Google-or-Apple-only member after the right code and offers only their providers (sc-94849)', async () => {
    routed({
      'POST /api/staff-links/opened': () => answer(OPEN),
      'POST /api/staff-links/sign-in/send': () => answer({ handle: 'h1', cooldownSeconds: 60 }),
      'POST /api/auth/phone-sign-in/state': () =>
        answer({ cooldownSeconds: 60, codeState: 'live', route: 'sms_only' }),
      'POST /api/staff-links/sign-in': () =>
        answer(
          {
            type: 'https://soirely.com/errors/oauth_only',
            title: 'No',
            status: 403,
            organisation: 'Ìrè Events',
            email: 'tope@ire.events',
            providers: ['apple'],
          },
          403,
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Code from the text'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Ìrè Events signs in with Google or Apple only',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'A code sent to your phone cannot sign you in to this account. Ìrè Events asks everyone in it to use Apple.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Staff link')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
    expect(screen.queryByLabelText('Code from the text')).toBeNull();
  });
});

describe('A link signed in as its own account (sc-4235)', () => {
  beforeEach(() => {
    tokens.clear();
    __setSessionState({ status: 'signedIn', session: ANA });
  });
  afterEach(() => vi.restoreAllMocks());

  it('opens their whole night: where, when, who to ask, the timing and their tables', async () => {
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () => answer(NIGHT),
    });

    expect(
      await screen.findByRole('heading', { name: 'Tonight you’re on Section B' }),
    ).toBeTruthy();
    expect(asked).toContain('POST /api/staff-links/night {"token":"tok_ada"}');
    expect(screen.getByText('Joana & Rui’s wedding')).toBeTruthy();
    expect(screen.getByText('Tonight only · ends 02:00')).toBeTruthy();
    expect(screen.getByText('17:00 to 01:00')).toBeTruthy();
    expect(screen.getByText('Ends on Sunday at 01:00')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Call Dayo Okafor' }).getAttribute('href')).toBe(
      'tel:+351912345678',
    );
    expect(screen.getByText('Staff briefing')).toBeTruthy();
    expect(screen.getByText('1 guest')).toBeTruthy();
    expect(screen.getByText('Folake Adeyemi')).toBeTruthy();
    expect(screen.getByText('Vegetarian, Peanuts')).toBeTruthy();
    expect(screen.getAllByText('Signed in as Ana Sousa').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /^This link is yours alone\. You are signed in until .*02:00\. Nothing stays on this device\.$/u,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('before doors says when the tables open, and names no guest', async () => {
    routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () =>
        answer({ ...NIGHT, doorsAt: '2099-03-06T19:00:00+00:00', tables: [] }),
    });

    expect(await screen.findByText('Shown when doors open, at 19:00')).toBeTruthy();
    expect(screen.queryByText('Folake Adeyemi')).toBeNull();
  });

  it('drops the update once a move leaves no station', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setInterval', 'clearInterval'] });
    const nights = [
      NIGHT,
      { ...NIGHT, station: 'Section C' },
      { ...NIGHT, station: null, tables: null },
    ];
    try {
      routed({
        'POST /api/staff-links/opened': () => answer(YOURS),
        'POST /api/staff-links/night': () => answer(nights.length > 1 ? nights.shift() : nights[0]),
      });

      await screen.findByRole('heading', { name: 'Tonight you’re on Section B' });
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(await screen.findByText('Updated: you’re now on Section C')).toBeTruthy();

      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(await screen.findByRole('heading', { name: 'Tonight you’re on Waiter' })).toBeTruthy();
      expect(screen.queryByText('Updated: you’re now on Section C')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the floor lead when they stand in, and says when there is no lead at all', async () => {
    routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () =>
        answer({ ...NIGHT, station: null, tables: null, lead: { ...NIGHT.lead, floor: true } }),
    });

    expect(await screen.findByRole('heading', { name: 'Tonight you’re on Waiter' })).toBeTruthy();
    expect(screen.getByText('Floor lead')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Call Dayo Okafor, floor lead' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your tables' })).toBeNull();
  });

  it('shows when clocking in opens before its window, and the shift after this one', async () => {
    routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () =>
        answer({
          ...NIGHT,
          shift: {
            job: 'Waiter',
            startsAt: '2099-03-06T17:00:00+00:00',
            endsAt: '2099-03-06T22:00:00+00:00',
          },
          later: { job: 'Waiter', startsAt: '2099-03-06T23:00:00+00:00' },
          clock: { ...CARD, phase: 'before', clockedInAt: null, outUntil: null },
        }),
    });

    expect(await screen.findByRole('button', { name: 'Clock in opens at 16:00' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText('Later: Waiter from 23:00')).toBeTruthy();
  });

  it('clocks in at Soirely’s time, above Your shift (sc-234)', async () => {
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () =>
        answer({ ...NIGHT, clock: { ...CARD, phase: 'ready', clockedInAt: null, outUntil: null } }),
      'POST /api/staff-links/clock': () =>
        answer({ outcome: 'recorded', clock: CARD, signedOut: false }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clock in' }));

    expect(await screen.findByText(/^Clocked in at .*16:58$/u)).toBeTruthy();
    expect(asked).toContain('POST /api/staff-links/clock {"token":"tok_ada","action":"in"}');
    expect(screen.getByRole('button', { name: 'Clock out' })).toBeTruthy();
    expect(screen.getByText('Clock out when you finish, even if it’s after 22:00.')).toBeTruthy();
  });

  it('says a second Clock out changed nothing, and keeps the helper', async () => {
    const off = {
      ...CARD,
      phase: 'off',
      clockedOutAt: '2099-03-06T22:42:00+00:00',
      workedMinutes: 344,
    };
    routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () => answer({ ...NIGHT, clock: CARD }),
      'POST /api/staff-links/clock': () =>
        answer({ outcome: 'already', clock: off, signedOut: false }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clock out' }));

    expect(
      await screen.findByText(/^You had already clocked out at .*22:42\. Nothing has changed\.$/u),
    ).toBeTruthy();
    expect(screen.getByText('5 h 44 min recorded')).toBeTruthy();
    expect(
      screen.getByText(
        'If a time is wrong, tell whoever manages staff for this event. Only they can correct it.',
      ),
    ).toBeTruthy();
  });

  it('keeps Clock in as the retry with no connection, and sends nothing later', async () => {
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () =>
        answer({ ...NIGHT, clock: { ...CARD, phase: 'ready', clockedInAt: null, outUntil: null } }),
      'POST /api/staff-links/clock': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clock in' }));

    expect(
      await screen.findByText(
        'Could not clock in because there is no connection. Try again when you are back online.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clock in' })).toBeTruthy();
    expect(asked.filter((line) => line.startsWith('POST /api/staff-links/clock'))).toHaveLength(1);
  });

  it('past their access shows the event’s name and the clock card alone', async () => {
    routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () => answer({ ...NIGHT, pastAccess: true, clock: CARD }),
    });

    expect(await screen.findByRole('heading', { name: 'Joana & Rui’s wedding' })).toBeTruthy();
    expect(
      screen.getByText(
        'Clocking out signs you out of this browser. Otherwise you will be signed out at Saturday 04:00.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your shift' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your lead' })).toBeNull();
    expect(screen.queryByText('Section B')).toBeNull();
  });

  it('a clock-out past their access ends the link in this browser', async () => {
    const off = {
      ...CARD,
      phase: 'off',
      clockedOutAt: '2099-03-07T02:12:00+00:00',
      workedMinutes: 554,
    };
    const asked = routed({
      'POST /api/staff-links/opened': () => answer(YOURS),
      'POST /api/staff-links/night': () => answer({ ...NIGHT, pastAccess: true, clock: CARD }),
      'POST /api/staff-links/clock': () =>
        answer({ outcome: 'recorded', clock: off, signedOut: true }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clock out' }));

    expect(
      await screen.findByRole('heading', { name: 'You are signed out of this browser.' }),
    ).toBeTruthy();
    expect(screen.getByText(/^Clocked out at .*02:12$/u)).toBeTruthy();
    expect(screen.queryByText('Joana & Rui’s wedding')).toBeNull();
    await waitFor(() =>
      expect(asked.some((line) => line.startsWith('POST /api/auth/logout'))).toBe(true),
    );
  });

  it('signs out back to Confirm it’s you, with Signed out. as a status', async () => {
    routed({ 'POST /api/staff-links/opened': () => answer(YOURS) });

    const [signOut] = await screen.findAllByRole('button', { name: 'Sign out' });
    fireEvent.click(signOut ?? document.body);

    expect(await screen.findByRole('heading', { name: 'Confirm it’s you' })).toBeTruthy();
    expect(screen.getAllByRole('status').map((line) => line.textContent)).toContain('Signed out.');
    expect(screen.getByRole('button', { name: 'Send code' })).toBeTruthy();
  });
});
