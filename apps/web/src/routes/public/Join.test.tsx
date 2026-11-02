import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

const TOKEN = 'ab'.repeat(32);

// Every key InvitationsController::preview writes.
const PREVIEW = {
  id: 'inv_1',
  organisation: { id: 'org_1', name: 'Ìrè Events' },
  email: 'kemi.l@gmail.com',
  role: { id: 'role_3', seededAs: 'event_manager', name: null },
  invitedBy: { name: 'Bisi Adeyemi' },
  expiresAt: '2026-10-23T09:00:00+00:00',
  refusal: null,
  forYou: null,
  signedInAs: null,
};

const ACCOUNT = {
  id: 'u1',
  name: 'Kemi Lawal',
  locale: 'en',
  verified: true,
  complete: true,
  emailAddresses: [{ id: 'a1', address: 'kemi.l@gmail.com', verified: true, primary: true }],
  phoneNumbers: [],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra },
    status,
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

function signedIn(email = 'kemi.l@gmail.com'): void {
  const session: Session = {
    name: 'Kemi Lawal',
    email,
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
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

function open() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: [`/join/${TOKEN}`] })} />,
  );
}

const LINK = 'POST /api/invitations/link';

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('an invitation, signed out', () => {
  it('names who invited whom, and locks the address it was sent to', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({ [LINK]: () => json(PREVIEW) });
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Join Ìrè Events' })).toBeDefined();
    expect(
      screen.getByText('Bisi Adeyemi invited kemi.l@gmail.com to join as Event manager.'),
    ).toBeDefined();
    expect(screen.getByText('This invitation works until Friday, Oct 23.')).toBeDefined();

    const email = screen.getByLabelText('Email') as HTMLInputElement;
    expect(email.value).toBe('kemi.l@gmail.com');
    expect(email.readOnly).toBe(true);
    expect(
      screen.getByText(/It is already confirmed, so there is no code to enter\./),
    ).toBeDefined();
  });

  it('says what is missing on the first press, and sends nothing', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    const sent = answering({ [LINK]: () => json(PREVIEW) });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Create account and join' }));

    expect(screen.getByText('Enter your full name.')).toBeDefined();
    expect(screen.getByText('Choose a password.')).toBeDefined();
    expect(document.activeElement?.id).toBe('join-name');
    expect(sent.map((one) => one.line)).toEqual([LINK]);
  });

  it('refuses a password shorter than the rule before it is sent', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    const sent = answering({ [LINK]: () => json(PREVIEW) });
    open();

    fireEvent.change(await screen.findByLabelText('Full name'), {
      target: { value: 'Kemi Lawal' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'lagos-evening-' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));

    expect(screen.getByText('Use at least 15 characters.')).toBeDefined();
    expect(sent.map((one) => one.line)).toEqual([LINK]);
  });

  it('makes the account and joins in one step, with the token', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    const sent = answering({
      [LINK]: () => json(PREVIEW),
      'POST /api/auth/register': () =>
        json(
          {
            accessToken: 'fresh',
            refreshExpiresAt: '2026-11-14T00:00:00+00:00',
            sessionId: 's1',
            account: ACCOUNT,
          },
          201,
        ),
      'GET /api/orgs': () =>
        json({
          organisations: [
            membership({ role: { id: 'role_3', seededAs: 'event_manager', name: null } }),
          ],
        }),
      'PUT /api/auth/locale': () => json({}),
    });
    open();

    fireEvent.change(await screen.findByLabelText('Full name'), {
      target: { value: ' Kemi Lawal ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'lagos-evening-air' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));

    const joined = await screen.findByRole('heading', { level: 1, name: 'You are in' });
    await waitFor(() => expect(document.activeElement).toBe(joined));
    expect(screen.getByText('You joined Ìrè Events as Event manager.')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Ìrè Events' }).getAttribute('href')).toBe('/app');
    expect(sent.find((one) => one.line === 'POST /api/auth/register')?.body).toMatchObject({
      invitationToken: TOKEN,
      email: 'kemi.l@gmail.com',
      name: 'Kemi Lawal',
    });
  });

  it('sends somebody whose address has an account to sign in, and comes back here after', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({
      [LINK]: () => json(PREVIEW),
      'POST /api/auth/register': () => problem(409, 'email_taken'),
    });
    open();

    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Kemi' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'lagos-evening-air' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));

    const signIn = await screen.findByRole('heading', { level: 1, name: 'Sign in to accept' });
    await waitFor(() => expect(document.activeElement).toBe(signIn));
    expect(screen.getByText('You already have an account')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.getByText(
        'kemi.l@gmail.com already has a Soirely account. Sign in with it, and you can accept the invitation there.',
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in to accept' }));

    expect(sessionStorage.getItem('soirely.invitation')).toBe(TOKEN);
  });

  it('heads back from Reset your password with the invitation’s title, the step Back reopens', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({
      [LINK]: () => json(PREVIEW),
      'POST /api/auth/register': () => problem(409, 'email_taken'),
    });
    open();

    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Kemi' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'lagos-evening-air' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }));

    await screen.findByRole('heading', { level: 1, name: 'Reset your password' });
    const back = screen.getByRole('button', { name: 'Join Ìrè Events' });
    expect(back.textContent).toBe('‹Join Ìrè Events');
    fireEvent.click(back);

    expect(await screen.findByRole('heading', { level: 1, name: 'Join Ìrè Events' })).toBeDefined();
  });

  it('takes focus to “We could not find that invitation” when a newer invitation replaced the link', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({
      [LINK]: () => json(PREVIEW),
      'POST /api/auth/register': () => problem(404, 'invitation_not_found'),
    });
    open();

    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Kemi' } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'lagos-evening-air' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));

    const missing = await screen.findByRole('heading', {
      level: 1,
      name: 'We could not find that invitation',
    });
    await waitFor(() => expect(document.activeElement).toBe(missing));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByLabelText('Full name')).toBeNull();
    expect(screen.queryByText('Ìrè Events')).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to Soirely' })).toBeDefined();
  });

  it('says a link that names nothing could not be found', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({ [LINK]: () => problem(404, 'invitation_not_found') });
    open();

    expect(
      await screen.findByRole('heading', { name: 'We could not find that invitation' }),
    ).toBeDefined();
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole('status')).toBeDefined();
  });
});

describe('an invitation that can no longer be answered', () => {
  const cases = [
    [
      'invitation_expired',
      'This invitation has expired',
      'This invitation has expired. Ask Bisi Adeyemi to send a new one.',
    ],
    [
      'invitation_revoked',
      'This invitation was withdrawn',
      'This invitation was withdrawn by Ìrè Events. If you think that is a mistake, ask whoever invited you.',
    ],
    ['invitation_accepted', 'Already accepted', 'You already accepted this invitation.'],
    [
      'invitation_declined',
      'Already declined',
      'You declined this invitation. Ask Bisi Adeyemi to invite you again if you changed your mind.',
    ],
    [
      'organisation_deleted',
      'This organisation is gone',
      'Ìrè Events no longer exists, so this invitation cannot be accepted.',
    ],
  ] as const;

  it.each(cases)('%s has its own heading and words', async (refusal, heading, body) => {
    __setSessionState({ status: 'signedOut', ended: false });
    answering({ [LINK]: () => json({ ...PREVIEW, refusal }) });
    open();

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeDefined();
    expect(screen.getByText(body)).toBeDefined();
    expect(screen.queryByLabelText('Full name')).toBeNull();
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole('status')).toBeDefined();
  });
});

describe('an invitation, signed in', () => {
  it('accepts, and opens the organisation it joined', async () => {
    signedIn();
    const sent = answering({
      [LINK]: () => json({ ...PREVIEW, forYou: true, signedInAs: 'kemi.l@gmail.com' }),
      'POST /api/invitations/inv_1/accept': () => json({ organisation: membership() }),
      'GET /api/auth/me': () => json(ACCOUNT),
      'GET /api/orgs': () => json({ organisations: [membership()] }),
      'PUT /api/auth/locale': () => json({}),
    });
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Join Ìrè Events?' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Signed in as kemi.l@gmail.com · this invitation works until Friday, Oct 23.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('Declining tells Bisi Adeyemi you said no. Nothing else changes.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Accept and join' }));

    const joined = await screen.findByRole('heading', { level: 1, name: 'You are in' });
    await waitFor(() => expect(document.activeElement).toBe(joined));
    expect(screen.queryByRole('status')).toBeNull();
    expect(sent.map((one) => one.line)).toContain('POST /api/invitations/inv_1/accept');
  });

  it('names the role the API joined with, which a newer invitation may have changed', async () => {
    signedIn();
    const joinedAs = membership({ role: { id: 'role_3', seededAs: 'event_manager', name: null } });
    answering({
      [LINK]: () =>
        json({
          ...PREVIEW,
          role: { id: 'role_5', seededAs: 'coordinator', name: null },
          forYou: true,
          signedInAs: 'kemi.l@gmail.com',
        }),
      'POST /api/invitations/inv_1/accept': () => json({ organisation: joinedAs }),
      'GET /api/auth/me': () => json(ACCOUNT),
      'GET /api/orgs': () => json({ organisations: [joinedAs] }),
      'PUT /api/auth/locale': () => json({}),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Accept and join' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'You are in' })).toBeDefined();
    expect(screen.getByText('Invitation from Bisi Adeyemi · Event manager')).toBeDefined();
    expect(screen.getByText('You joined Ìrè Events as Event manager.')).toBeDefined();
  });

  it('takes focus to the refusal’s heading when the invitation changed in the meantime', async () => {
    signedIn();
    answering({
      [LINK]: () => json({ ...PREVIEW, forYou: true, signedInAs: 'kemi.l@gmail.com' }),
      'POST /api/invitations/inv_1/accept': () => problem(410, 'invitation_revoked'),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Accept and join' }));

    const refused = await screen.findByRole('heading', {
      level: 1,
      name: 'This invitation was withdrawn',
    });
    await waitFor(() => expect(document.activeElement).toBe(refused));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('declines, and creates nothing', async () => {
    signedIn();
    const sent = answering({
      [LINK]: () => json({ ...PREVIEW, forYou: true, signedInAs: 'kemi.l@gmail.com' }),
      'POST /api/invitations/inv_1/decline': () => json({ status: 'declined' }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    expect(
      await screen.findByText('You declined. Bisi Adeyemi will see that you said no.'),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Invitation declined' }),
      ),
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(sent.map((one) => one.line)).not.toContain('POST /api/invitations/inv_1/accept');
  });

  it('says whose it is when the account is somebody else, and offers to switch', async () => {
    signedIn('folake@ire.events');
    let signedOut = false;
    const sent = answering({
      [LINK]: () =>
        json(signedOut ? PREVIEW : { ...PREVIEW, forYou: false, signedInAs: 'folake@ire.events' }),
      'POST /api/auth/logout': () => {
        signedOut = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This invitation is for someone else' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'This invitation is for kemi.l@gmail.com. You are signed in as folake@ire.events.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Accept and join' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out and use kemi.l@gmail.com' }));

    const join = await screen.findByRole('heading', { level: 1, name: 'Join Ìrè Events' });
    await waitFor(() => expect(document.activeElement).toBe(join));
    expect(sent.map((one) => one.line)).toContain('POST /api/auth/logout');
  });

  it('takes focus to the refusal’s heading when the switch finds the invitation changed', async () => {
    signedIn('folake@ire.events');
    let signedOut = false;
    answering({
      [LINK]: () =>
        json(
          signedOut
            ? { ...PREVIEW, refusal: 'invitation_revoked' }
            : { ...PREVIEW, forYou: false, signedInAs: 'folake@ire.events' },
        ),
      'POST /api/auth/logout': () => {
        signedOut = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Sign out and use kemi.l@gmail.com' }),
    );

    const refused = await screen.findByRole('heading', {
      level: 1,
      name: 'This invitation was withdrawn',
    });
    await waitFor(() => expect(document.activeElement).toBe(refused));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes focus to “We could not find that invitation” when the switch finds the link replaced', async () => {
    signedIn('folake@ire.events');
    let signedOut = false;
    answering({
      [LINK]: () =>
        signedOut
          ? problem(404, 'invitation_not_found')
          : json({ ...PREVIEW, forYou: false, signedInAs: 'folake@ire.events' }),
      'POST /api/auth/logout': () => {
        signedOut = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Sign out and use kemi.l@gmail.com' }),
    );

    const missing = await screen.findByRole('heading', {
      level: 1,
      name: 'We could not find that invitation',
    });
    await waitFor(() => expect(document.activeElement).toBe(missing));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays signed in as the other account, and says so, when switching cannot reach Soirely', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    signedIn('folake@ire.events');
    answering({
      [LINK]: () => json({ ...PREVIEW, forYou: false, signedInAs: 'folake@ire.events' }),
      'POST /api/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    open();

    const button = await screen.findByRole('button', {
      name: 'Sign out and use kemi.l@gmail.com',
    });
    button.focus();
    fireEvent.click(button);

    expect((await screen.findByRole('alert')).textContent).toMatch(/You are still signed in/);
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('link', { name: 'Stay signed in as folake@ire.events' })).toBeDefined();
    expect(screen.queryByText('Cannot reach Soirely')).toBeNull();
  });

  it('says whose it is when somebody else already accepted it, and offers no Open', async () => {
    signedIn('folake@ire.events');
    answering({
      [LINK]: () =>
        json({
          ...PREVIEW,
          refusal: 'invitation_accepted',
          forYou: false,
          signedInAs: 'folake@ire.events',
        }),
    });
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This invitation is for someone else' }),
    ).toBeDefined();
    expect(screen.queryByText('You already accepted this invitation.')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Open/ })).toBeNull();
  });
});

describe('an invitation whose link did not load (sc-11488)', () => {
  const SIGNED_IN = 'You are still signed in.';
  const NOT_ANSWERING =
    'Soirely is not answering, so nothing can load yet. Check your connection, then try again.';

  it('says nothing of being signed in to somebody signed out, and Try again reads the link', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    let release: (answer: Response) => void = () => undefined;
    let reachable = false;
    const sent = answering({
      [LINK]: () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return new Promise<Response>((resolve) => (release = resolve)) as unknown as Response;
      },
    });
    open();

    expect(await screen.findByText(NOT_ANSWERING)).toBeDefined();
    expect(screen.queryByText(new RegExp(SIGNED_IN))).toBeNull();

    reachable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Trying again…' })).toBeDefined();
    expect(screen.getByText(NOT_ANSWERING)).toBeDefined();

    release(json(PREVIEW));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Join Ìrè Events' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole('status')).toBeNull();
    expect(sent.map((one) => one.line)).toEqual([LINK, LINK]);
  });

  it('keeps the full words signed in, and puts focus on the notice when it fails again', async () => {
    signedIn();
    const sent = answering({});
    open();

    expect(await screen.findByText(`${SIGNED_IN} ${NOT_ANSWERING}`)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const button = await screen.findByRole('button', { name: 'Try again' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('status')));
    expect(screen.getByRole('status').textContent).toContain('Cannot reach Soirely');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(sent.map((one) => one.line)).toEqual([LINK, LINK]);
  });

  it('puts focus on the heading when Try again finds no invitation', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    let reachable = false;
    answering({
      [LINK]: () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return problem(404, 'invitation_not_found');
      },
    });
    open();

    expect(await screen.findByText(NOT_ANSWERING)).toBeDefined();

    reachable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'We could not find that invitation',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('puts focus on the heading alone when Try again finds the invitation expired', async () => {
    __setSessionState({ status: 'signedOut', ended: false });
    let reachable = false;
    answering({
      [LINK]: () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return json({ ...PREVIEW, refusal: 'invitation_expired' });
      },
    });
    open();

    expect(await screen.findByText(NOT_ANSWERING)).toBeDefined();

    reachable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'This invitation has expired',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(
      screen.getByText('This invitation has expired. Ask Bisi Adeyemi to send a new one.'),
    ).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the words true for everybody when the account did not load, and reads it then the link', async () => {
    __setSessionState({ status: 'unknown' });
    let reachable = false;
    const sent = answering({
      'GET /api/auth/me': () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return problem(401, 'unauthenticated');
      },
      'POST /api/auth/refresh': () => problem(401, 'unauthenticated'),
      [LINK]: () => json(PREVIEW),
    });
    open();

    expect(await screen.findByText(NOT_ANSWERING)).toBeDefined();
    expect(screen.queryByText(new RegExp(SIGNED_IN))).toBeNull();

    reachable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Join Ìrè Events' })).toBeDefined();
    expect(sent.map((one) => one.line).filter((line) => line !== 'POST /api/auth/refresh')).toEqual(
      ['GET /api/auth/me', 'GET /api/auth/me', LINK],
    );
  });
});
