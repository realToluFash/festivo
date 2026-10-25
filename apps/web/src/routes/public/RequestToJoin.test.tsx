import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { heldInvitation } from '../../heldInvitation.ts';
import { __setSessionState, type Session } from '../../session.ts';
import { routes } from '../index.tsx';

const TOKEN = 'cd'.repeat(16);

// Every key RequestLinksController::link writes.
const PREVIEW = {
  organisation: { name: 'Ìrè Events' },
  standing: null,
  askAgainFrom: null,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra },
    status,
    extra.retryAfter == null ? {} : { 'Retry-After': String(extra.retryAfter) },
  );
}

function answering(answers: Record<string, () => Response>) {
  const sent: { line: string; body: Record<string, unknown> | null }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({
      line,
      body:
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null,
    });

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function signedIn(): void {
  const session: Session = {
    name: 'Ada Okeke',
    email: 'ada@gmail.com',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    needsOrganisation: false,
    hasPassword: true,
    organisation: null,
    organisations: [],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function open(token = TOKEN) {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: [`/join/${token}`] })} />,
  );
}

const ACCOUNT = {
  id: 'u1',
  name: 'Ada Okeke',
  locale: 'en',
  verified: true,
  complete: true,
  emailAddresses: [{ id: 'a1', address: 'ada@gmail.com', verified: true, primary: true }],
  phoneNumbers: [],
};

const LINK = 'POST /api/request-links/link';
const ASK = 'POST /api/request-links/ask';

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a request link (sc-562)', () => {
  it('sends the token in the body and opens on the organisation, signed out', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    const sent = answering({ [LINK]: () => json(PREVIEW) });
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ask to join Ìrè Events' }),
    ).toBeDefined();
    expect(sent[0]).toEqual({ line: LINK, body: { token: TOKEN } });

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    expect(heldInvitation()).toBe(TOKEN);
  });

  it('asks with the message and says where it went', async () => {
    signedIn();
    const sent = answering({
      [LINK]: () => json(PREVIEW),
      [ASK]: () =>
        json({ request: { organisation: { id: 'org_1', name: 'Ìrè Events' }, askedAt: 'x' } }, 201),
      'GET /api/auth/me': () => json(ACCOUNT),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    open();

    fireEvent.change(await screen.findByLabelText(/Message/), {
      target: { value: 'I run the Abuja office.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));

    expect(
      await screen.findByText(
        "Your request has gone to Ìrè Events. We'll email you when they answer.",
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.line === ASK)?.body).toEqual({
      token: TOKEN,
      message: 'I run the Abuja office.',
    });
    expect(
      screen.queryByText('Ìrè Events sees your name, your email address and your message.'),
    ).toBeNull();
  });

  it('refuses a message over 500 characters before it is sent', async () => {
    signedIn();
    const sent = answering({ [LINK]: () => json(PREVIEW) });
    open();

    fireEvent.change(await screen.findByLabelText(/Message/), {
      target: { value: 'è'.repeat(501) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));

    expect(screen.getByText('Keep your message to 500 characters or fewer.')).toBeDefined();
    expect(sent.map((one) => one.line)).toEqual([LINK]);
  });

  it('tells somebody who belongs, rather than asking', async () => {
    signedIn();
    answering({ [LINK]: () => json({ ...PREVIEW, standing: 'member' }) });
    open();

    expect(await screen.findByText('You already belong to Ìrè Events.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ask to join' })).toBeNull();
  });

  it('tells somebody waiting, rather than asking twice', async () => {
    signedIn();
    answering({ [LINK]: () => json({ ...PREVIEW, standing: 'waiting' }) });
    open();

    expect(
      await screen.findByText(
        "You have already asked to join Ìrè Events. We'll email you when they answer.",
      ),
    ).toBeDefined();
  });

  it('says when somebody turned down may ask again', async () => {
    signedIn();
    answering({
      [LINK]: () =>
        json({ ...PREVIEW, standing: 'cooling_off', askAgainFrom: '2026-11-20T09:00:00+00:00' }),
    });
    open();

    expect(
      await screen.findByText(
        'Ìrè Events answered your last request. You can ask again from Friday, Nov 20.',
      ),
    ).toBeDefined();
  });

  it('says only when to try again once a limit is reached', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 18, 58, 30));
    signedIn();
    answering({
      [LINK]: () => json(PREVIEW),
      [ASK]: () => problem(429, 'too_many_attempts', { retryAfter: 600 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to join' }));

    expect(await screen.findByText(/^Too many requests for now\. Try again at /)).toBeDefined();
  });

  it('names the day too when the limit lifts after midnight (sc-7162)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 18, 58, 30));
    signedIn();
    answering({
      [LINK]: () => json(PREVIEW),
      [ASK]: () => problem(429, 'too_many_attempts', { retryAfter: 86_400 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to join' }));

    expect(
      await screen.findByText('Too many requests for now. Try again on Thursday, Oct 22 at 18:59.'),
    ).toBeDefined();
  });

  it('gives only the time when the limit lifts later today (sc-7162)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 18, 58, 30));
    signedIn();
    answering({
      [LINK]: () => json(PREVIEW),
      [ASK]: () => problem(429, 'too_many_attempts', { retryAfter: 3_600 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to join' }));

    expect(await screen.findByText('Too many requests for now. Try again at 19:59.')).toBeDefined();
  });

  it('shows one page for a dead link, naming nobody', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({ [LINK]: () => problem(404, 'request_link_dead') });
    open();

    expect(
      await screen.findByText(
        "This link doesn't work any more. Ask the organisation for a new one.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/Ìrè Events/)).toBeNull();
  });

  it('leaves an invitation link to the invitation page', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    const sent = answering({});
    open('ab'.repeat(32));

    await waitFor(() => expect(sent.length).toBeGreaterThan(0));
    expect(sent[0]?.line).toBe('POST /api/invitations/link');
  });
});
