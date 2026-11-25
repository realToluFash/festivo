import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      'POST /api/staff-links/sign-in': () =>
        answer({
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
        }),
      'POST /api/staff-links/look': () => answer(YOURS),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Code from the text'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Joana & Rui’s wedding' })).toBeTruthy();
    expect(asked).toContain('POST /api/staff-links/look {"token":"tok_ada"}');
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
});

describe('A link signed in as its own account (sc-4235)', () => {
  beforeEach(() => {
    tokens.clear();
    __setSessionState({ status: 'signedIn', session: ANA });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the event, the card, who is signed in, when, and Sign out, and nothing of the shift', async () => {
    routed({ 'POST /api/staff-links/opened': () => answer(YOURS) });

    expect(await screen.findByRole('heading', { name: 'Joana & Rui’s wedding' })).toBeTruthy();
    expect(screen.getByText('Staff link')).toBeTruthy();
    expect(screen.getByText('Bar and drinks')).toBeTruthy();
    expect(screen.getByText('Signed in as Ana Sousa')).toBeTruthy();
    expect(screen.getByText(/^You’ll be signed out at .*02:00\.$/u)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
  });

  it('signs out back to Confirm it’s you, with Signed out. as a status', async () => {
    routed({ 'POST /api/staff-links/opened': () => answer(YOURS) });

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Confirm it’s you' })).toBeTruthy();
    expect(screen.getAllByRole('status').map((line) => line.textContent)).toContain('Signed out.');
    expect(screen.getByRole('button', { name: 'Send code' })).toBeTruthy();
  });
});
