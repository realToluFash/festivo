import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { holdProof } from '../../../recentProof.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';

const MEMBERSHIP = membership({ id: 'acc_1', name: 'Ire Events' });

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
  timezone: 'Africa/Lagos',
};

const ZONES = [
  { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria', offset: '+01:00' },
  { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'Congo - Kinshasa', offset: '+01:00' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', offset: '+01:00' },
  {
    id: 'Asia/Kolkata',
    city: 'Kolkata',
    ianaCity: 'Kolkata',
    formerNames: ['Calcutta'],
    country: 'India',
    offset: '+05:30',
  },
];

interface Sent {
  call: string;
  body: unknown;
}

function answering(answers: Record<string, () => Response> = {}): Sent[] {
  const sent: Sent[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer =
      answers[call] ??
      (call === 'GET /api/auth/timezones' ? () => json({ timezones: ZONES }) : null);
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

function open(session: Partial<Session> = {}, at = '/app/account') {
  __setSessionState({ status: 'signedIn', session: { ...FOLAKE, ...session } });

  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);
}

beforeEach(() => {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  __setSessionState({ status: 'unknown' });
  tokens.clear();
});

const ME = {
  id: 'acc_1',
  name: 'Folake Ire',
  businessName: null,
  countryCode: null,
  organisationCountry: 'NG',
  locale: 'en',
  timezone: 'Africa/Lagos',
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  providers: [],
  emailAddresses: [
    { id: 'e1', address: 'folake@ire.events', verified: true, primary: true },
    { id: 'e2', address: 'folake.adeyemi@gmail.com', verified: true, primary: false },
  ],
  phoneNumbers: [
    {
      id: 'p1',
      number: '+2348035550142',
      countryCode: 'NG',
      verified: true,
      primary: true,
      pending: false,
    },
  ],
};

function problem(code: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

describe('email addresses and phone numbers', () => {
  it('lists each with its state in a word, the primary marked, and how many more fit', async () => {
    answering({ 'GET /api/auth/me': () => json(ME) });
    open();

    expect(await screen.findByText('folake.adeyemi@gmail.com')).toBeDefined();
    expect(screen.getAllByText('Verified')).toHaveLength(3);
    expect(screen.getAllByText('Primary')).toHaveLength(2);
    expect(
      screen.getByText('You have the most you can add: 2. Remove one to add another.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add an email address' })).toBeNull();
    expect(
      screen.getByText('You can add 1 more. Primary included, an account holds 2 numbers.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add a phone number' })).toBeDefined();
  });

  it('says what making an address primary changes, then asks the person to prove it is them', async () => {
    const sent = answering({
      'GET /api/auth/me': () => json(ME),
      'GET /api/orgs': () => json({ organisations: [] }),
      'POST /api/auth/proof': () =>
        json({ proof: 'p-1', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
      'PATCH /api/auth/emails/e2/primary': () =>
        json({ id: 'e2', address: 'folake.adeyemi@gmail.com', verified: true, primary: true }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Make primary' }));
    expect(
      screen.getByText(
        'You will sign in with it from now on, and account mail goes there. folake@ire.events stays linked and stops signing you in.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Make it primary' }));

    expect(
      await screen.findByText("Confirm it's you before changing the address you sign in with."),
    ).toBeDefined();
    expect(sent.some((s) => s.call.startsWith('PATCH'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        'folake.adeyemi@gmail.com is now your primary address. Sign in with it from now on.',
      ),
    ).toBeDefined();
    expect(sent.find((s) => s.call === 'PATCH /api/auth/emails/e2/primary')?.body).toEqual({
      proof: 'p-1',
    });
  });

  it('uses a proof this tab still holds, without asking again', async () => {
    holdProof({ proof: 'held', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    const sent = answering({
      'GET /api/auth/me': () => json(ME),
      'GET /api/orgs': () => json({ organisations: [] }),
      'PATCH /api/auth/emails/e2/primary': () =>
        json({ id: 'e2', address: 'folake.adeyemi@gmail.com', verified: true, primary: true }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Make primary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make it primary' }));

    await waitFor(() =>
      expect(sent.find((s) => s.call === 'PATCH /api/auth/emails/e2/primary')?.body).toEqual({
        proof: 'held',
      }),
    );
    expect(sent.some((s) => s.call === 'POST /api/auth/proof')).toBe(false);
  });

  it('proves with Google for an account with no password, and finishes back on Account', async () => {
    sessionStorage.setItem(
      'soirely.google.attempt',
      JSON.stringify({
        state: 's',
        nonce: 'n',
        codeVerifier: 'v',
        purpose: { kind: 'makePrimary', address: 'e2' },
      }),
    );
    window.history.replaceState(null, '', '/oauth/google?state=s&code=the-code');
    const sent = answering({
      'GET /api/auth/me': () =>
        json({
          ...ME,
          hasPassword: false,
          providers: [{ provider: 'google', email: 'folake@gmail.com' }],
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
      'POST /api/auth/proof': () =>
        json({ proof: 'p-g', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
      'PATCH /api/auth/emails/e2/primary': () =>
        json({ id: 'e2', address: 'folake.adeyemi@gmail.com', verified: true, primary: true }),
    });
    __setSessionState({ status: 'signedIn', session: { ...FOLAKE, hasPassword: false } });
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/oauth/google'] })} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }, { timeout: 3000 }));

    await waitFor(() =>
      expect(sent.find((s) => s.call === 'PATCH /api/auth/emails/e2/primary')?.body).toEqual({
        proof: 'p-g',
      }),
    );
    expect(sent.find((s) => s.call === 'POST /api/auth/proof')?.body).toEqual(
      expect.objectContaining({ provider: 'google' }),
    );
  });

  it('asks before removing a verified address, and removes an unverified one at once', async () => {
    const unverified = {
      ...ME,
      emailAddresses: [ME.emailAddresses[0], { ...ME.emailAddresses[1], verified: false }],
    };
    const sent = answering({
      'GET /api/auth/me': () => json(unverified),
      'DELETE /api/auth/emails/e2': () => new Response(null, { status: 204 }),
    });
    open();

    expect(await screen.findByRole('link', { name: 'Send a code' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Send a code' }).getAttribute('href')).toBe(
      '/verify-email?address=e2',
    );
    expect(screen.queryByRole('button', { name: 'Make primary' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove folake.adeyemi@gmail.com' }));

    await waitFor(() =>
      expect(sent.some((s) => s.call === 'DELETE /api/auth/emails/e2')).toBe(true),
    );
    expect(screen.queryByText('Remove this address?')).toBeNull();
  });

  it('never offers to remove the primary', async () => {
    answering({ 'GET /api/auth/me': () => json(ME) });
    open();

    await screen.findByText('folake.adeyemi@gmail.com');
    expect(screen.queryByRole('button', { name: 'Remove folake@ire.events' })).toBeNull();
  });

  it('checks an added address before sending, and says when it is linked already', async () => {
    const oneAddress = { ...ME, emailAddresses: [ME.emailAddresses[0]] };
    const sent = answering({
      'GET /api/auth/me': () => json(oneAddress),
      'POST /api/auth/emails': () => problem('already_linked', 409),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Add an email address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
    expect(screen.getByText('Enter your email address.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Email address to add'), {
      target: { value: 'folake.adeyemi@gmail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();
    expect(sent.some((s) => s.call === 'POST /api/auth/emails')).toBe(false);

    fireEvent.change(screen.getByLabelText('Email address to add'), {
      target: { value: 'someone@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
    expect(await screen.findByText('That address is already linked to an account.')).toBeDefined();
  });

  it('makes a verified number primary without asking first', async () => {
    const twoPhones = {
      ...ME,
      phoneNumbers: [
        ME.phoneNumbers[0],
        { ...ME.phoneNumbers[0], id: 'p2', number: '+2347015550188', primary: false },
      ],
    };
    const sent = answering({
      'GET /api/auth/me': () => json(twoPhones),
      'PATCH /api/auth/phones/p2/primary': () =>
        json({ ...twoPhones.phoneNumbers[1], primary: true }),
    });
    open();

    await screen.findByText('folake.adeyemi@gmail.com');
    const makePrimary = screen.getAllByRole('button', { name: 'Make primary' });
    fireEvent.click(makePrimary[makePrimary.length - 1]!);

    await waitFor(() =>
      expect(sent.some((s) => s.call === 'PATCH /api/auth/phones/p2/primary')).toBe(true),
    );
  });
});

describe('back from verifying an address or number', () => {
  it('says the row is verified, once, and leaves it an alternative', async () => {
    answering({ 'GET /api/auth/me': () => json(ME) });
    const { container } = open({}, '/app/account?verified=e2');

    expect(await screen.findByText('folake.adeyemi@gmail.com is verified.')).toBeDefined();
    expect(container.querySelectorAll('.notice-done')).toHaveLength(1);
  });

  it('says nothing for a row that is not verified', async () => {
    const unverified = {
      ...ME,
      emailAddresses: [ME.emailAddresses[0], { ...ME.emailAddresses[1], verified: false }],
    };
    answering({ 'GET /api/auth/me': () => json(unverified) });
    open({}, '/app/account?verified=e2');

    await screen.findByText('folake.adeyemi@gmail.com');
    expect(screen.queryByText('folake.adeyemi@gmail.com is verified.')).toBeNull();
  });
});
