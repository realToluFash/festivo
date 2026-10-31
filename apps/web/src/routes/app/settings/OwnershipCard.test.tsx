import { type Membership } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { browser } from '../../../providerSignIn.ts';
import { holdProof } from '../../../recentProof.ts';
import { __setSessionState, switchOrganisation, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { breaksAnywhere } from '../../../test-wrapping.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const OWNER = { id: 'role_1', seededAs: 'owner', name: null };
const ADMINISTRATOR = { id: 'role_2', seededAs: 'administrator', name: null };

function member(id: string, name: string, role: object, self = false) {
  return {
    id,
    user: { id: `u_${id}`, name, email: null },
    role,
    status: 'active',
    former: null,
    channel: 'invitation',
    since: null,
    invitedBy: null,
    invitedAt: null,
    self,
    history: [],
  };
}

const MEMBERS = {
  members: [
    member('m_folake', 'Folake Adeyemi', OWNER, true),
    member('m_bisi', 'Bisi Adeyemi', ADMINISTRATOR),
  ],
  invitations: [],
};

function signedIn(
  organisation = IRE,
  others: Membership[] = [],
  ways: Pick<Session, 'hasPassword' | 'providers'> = { hasPassword: true, providers: [] },
): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    userId: 'u1',
    needsOrganisation: false,
    organisation,
    organisations: [organisation, ...others],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
    ...ways,
  };

  __setSessionState({ status: 'signedIn', session });
}

const ME = {
  id: 'u_folake',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function answering(answers: Record<string, () => Response | Promise<Response>>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function settings() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/settings'] })} />,
  );
}

const DELETION = {
  events: 5,
  guests: 1204,
  members: 9,
  restoreClosesAt: '2026-11-16T13:20:00+00:00',
  restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
};

function problem(code: string, status: number, members: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...members }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('Settings > General, ownership and leaving', () => {
  it('asks who and the password before a transfer sends anything', async () => {
    signedIn();
    const sent = answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));

    expect(screen.getByText('Choose who becomes the owner.')).toBeDefined();
    expect(screen.getByText('Enter your password.')).toBeDefined();
    expect(sent.filter((one) => one.line.startsWith('POST'))).toHaveLength(0);
  });

  it('proves it is you, then makes the chosen member the owner', async () => {
    signedIn();
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => json({ proof: 'p_1', expiresAt: '2026-10-17T13:25:00+00:00' }),
      'POST /api/orgs/org_1/ownership': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json({}),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Bisi Adeyemi/ }));
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'a passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'POST /api/orgs/org_1/ownership')?.body).toEqual({
        membershipId: 'm_bisi',
        proof: 'p_1',
      }),
    );
    expect(sent.find((one) => one.line === 'POST /api/auth/proof')?.body).toEqual({
      password: 'a passphrase',
    });
  });

  it('takes focus to the line that says who is now the owner (sc-11369)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => json({ proof: 'p_1', expiresAt: '2026-10-17T13:25:00+00:00' }),
      'POST /api/orgs/org_1/ownership': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json(ME),
      'GET /api/orgs': () =>
        json({ organisations: [{ ...IRE, role: ADMINISTRATOR, permissions: [] }] }),
      'GET /api/invitations/mine': () => json({ invitations: [] }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Bisi Adeyemi/ }));
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'a passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    const notice = (
      await screen.findByText(
        'Bisi Adeyemi is now the owner of Ìrè Events. You are an Administrator. You both have an email saying so.',
      )
    ).closest('.notice');
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(notice?.getAttribute('role')).toBeNull();
  });

  it.each([
    ['Transfer ownership', 'Keep ownership'],
    ['Leave Ìrè Events', 'Stay'],
    ['Delete organisation', 'Keep Ìrè Events'],
  ])('puts focus back on %s after %s (sc-11369)', async (opener, closer) => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: opener }));
    fireEvent.click(await screen.findByRole('button', { name: closer }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: opener }));
  });

  it('puts focus on Leave after Keep ownership on a transfer opened under "You are the only owner" (sc-11369)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events' }));
    await screen.findByText('You are the only owner');
    fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep ownership' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Leave Ìrè Events' }));
  });

  it('puts focus back on Leave after Stay under "You are the only owner" (sc-11369)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events' }));
    await screen.findByText('You are the only owner');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Leave Ìrè Events' }));
  });

  it('takes focus to "You are the only owner" when leaving is refused for it (sc-11369)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () =>
        json({
          ...MEMBERS,
          members: [...MEMBERS.members, member('m_tope', 'Tope Bello', OWNER)],
        }),
      'POST /api/orgs/org_1/leave': () =>
        json(
          {
            type: 'https://soirely.com/errors/last_owner',
            title: 'You are the only owner.',
            status: 409,
          },
          409,
        ),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events' }));
    expect(screen.queryByText('You are the only owner')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));

    const title = await screen.findByText('You are the only owner');
    const body = title.closest('.notice-body');
    await waitFor(() => expect(document.activeElement).toBe(body));
    expect(body?.textContent).toContain('Make somebody else an owner, then you can leave.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      body?.closest('.settings-form')?.querySelector('.actions button:last-child')?.textContent,
    ).toBe('Transfer ownership');
  });

  it('says a wrong password changed nothing', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () =>
        json(
          {
            type: 'https://soirely.com/errors/invalid_credentials',
            title: 'That is not your password.',
            status: 401,
          },
          401,
        ),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Bisi Adeyemi/ }));
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    expect(
      await screen.findByText(
        'That is not your password. Nothing was changed. Try again, or reset it by email.',
      ),
    ).toBeDefined();
  });

  it('tells the only owner to hand it on before leaving', async () => {
    signedIn();
    const sent = answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events' }));

    expect(await screen.findByText('You are the only owner')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Leave Ìrè Events?' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sent.some((one) => one.line === 'POST /api/orgs/org_1/leave')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Leave Ìrè Events' })).toBeNull();
  });

  it('says the only owner cannot leave when the members come after Leave was pressed', async () => {
    signedIn();
    let release: () => void = () => {};
    const held = new Promise<Response>((resolve) => {
      release = () => resolve(json(MEMBERS));
    });
    answering({ 'GET /api/orgs/org_1/members': () => held });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave Ìrè Events' }));
    expect(screen.queryByText('You are the only owner')).toBeNull();
    release();

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('You are the only owner'),
    );
  });

  it('lets a member leave once they confirm', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_4', seededAs: 'coordinator', name: null },
        permissions: ['events.read'],
      }),
    );
    const sent = answering({
      'POST /api/orgs/org_1/leave': () => new Response(null, { status: 204 }),
    });
    settings();

    expect(screen.queryByRole('button', { name: 'Transfer ownership' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete organisation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Leave Ìrè Events?' }));
    expect(screen.getByText('You lose access to Ìrè Events as soon as you leave.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));

    await waitFor(() =>
      expect(sent.some((one) => one.line === 'POST /api/orgs/org_1/leave')).toBe(true),
    );
  });

  it('names a 100-character organisation in a Leave button that can break inside the word (sc-486)', () => {
    const name = 'A'.repeat(100);
    signedIn(
      membership({
        id: 'org_1',
        name,
        role: { id: 'role_4', seededAs: 'coordinator', name: null },
        permissions: ['events.read'],
      }),
    );
    answering({});
    settings();

    fireEvent.click(screen.getByRole('button', { name: `Leave ${name}` }));

    const shown = within(screen.getByRole('main')).getAllByText(new RegExp(name, 'u'));

    expect(shown.length).toBeGreaterThan(1);
    expect(shown.filter((element) => !breaksAnywhere(element))).toEqual([]);
  });

  it('wraps Leave ‹organisation› as a whole label, on the card and in its dialog (sc-15298)', () => {
    signedIn(IRE);
    answering({});
    settings();

    const card = screen.getByRole('button', { name: 'Leave Ìrè Events' });
    expect(card.querySelector('.button-label')?.textContent).toBe('Leave Ìrè Events');

    fireEvent.click(card);
    const confirm = screen.getByRole('button', { name: 'Leave Ìrè Events' });
    expect(confirm.querySelector('.button-label')?.textContent).toBe('Leave Ìrè Events');
  });

  it('lands an account that left its only organisation on the page that says so', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_4', seededAs: 'coordinator', name: null },
        permissions: ['events.read'],
      }),
    );
    answering({
      'POST /api/orgs/org_1/leave': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json(ME),
      'GET /api/orgs': () => json({ organisations: [] }),
      'GET /api/invitations/mine': () => json({ invitations: [] }),
    });
    settings();

    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));

    expect(
      await screen.findByRole('heading', { name: 'You are not in an organisation' }),
    ).toBeDefined();
  });

  it('states what deleting destroys and until when support can restore it', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () =>
        json({
          events: 5,
          guests: 1204,
          members: 9,
          restoreClosesAt: '2026-11-16T13:20:00+00:00',
          restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
        }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Delete Ìrè Events?' }),
    );
    expect(screen.getByRole('alert').textContent).toBe('');

    const counts = await screen.findByText(
      '5 events, 1,204 guests and 9 members are deleted with it. This deletes it for everybody now. Soirely support can restore it until Monday, Nov 16 at 14:20 WAT; after that it is gone for good.',
    );
    expect(screen.getByRole('alert').contains(counts)).toBe(true);
  });

  it.each([
    ['comes back', (answer: (response: Response) => void) => answer(json(DELETION))],
    ['fails', (answer: (response: Response) => void) => answer(json({ title: 'Down' }, 503))],
  ])(
    'keeps the confirm closed after Keep, when the count %s later (sc-11295)',
    async (_, settle) => {
      signedIn();
      const answers: ((response: Response) => void)[] = [];
      answering({
        'GET /api/orgs/org_1/members': () => json(MEMBERS),
        'GET /api/orgs/org_1/deletion': () =>
          new Promise<Response>((answer) => answers.push(answer)),
      });
      settings();

      fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
      expect(screen.getByText('Counting what it holds…')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Keep Ìrè Events' }));

      await waitFor(() => expect(answers).toHaveLength(1));
      settle(answers[0]!);
      await new Promise((settled) => setTimeout(settled, 0));

      expect(screen.queryByRole('heading', { name: 'Delete Ìrè Events?' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Delete organisation' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Delete organisation' }));
      expect(screen.getByRole('heading', { name: 'Delete Ìrè Events?' })).toBeDefined();
      expect(screen.getByText('Counting what it holds…')).toBeDefined();
    },
  );

  it.each([
    ['no connection', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['an answer that is not 2xx', () => json({ title: 'Down' }, 503)],
    [
      'a 2xx that is not the preview',
      () => new Response('<html>Fatal error</html>', { headers: { 'Content-Type': 'text/html' } }),
    ],
  ])('says a failed count, %s, failed and offers Try again (sc-16866)', async (_, answer) => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': answer,
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));

    const failure = await screen.findByText(
      'We could not count what it holds. Deleting it still deletes every event, guest and member in it, for everybody, now. Soirely support can restore it for 30 days.',
    );
    expect(screen.getByRole('alert').contains(failure)).toBe(true);
    expect(screen.queryByText('Counting what it holds…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('counts again on Try again, and the button goes once the counts come (sc-16866)', async () => {
    signedIn();
    const answers: (() => Response)[] = [
      () => json({ title: 'Down' }, 503),
      () => json({ title: 'Down' }, 503),
      () => json(DELETION),
    ];
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () => answers.shift()!(),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Counting what it holds…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Delete Ìrè Events?' }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(/^5 events, 1,204 guests and 9 members are deleted with it\./),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByText(/We could not count/)).toBeNull();
    expect(sent.filter((one) => one.line === 'GET /api/orgs/org_1/deletion')).toHaveLength(3);
  });

  it('still deletes while the count has failed (sc-16866)', async () => {
    signedIn();
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () => json({ title: 'Down' }, 503),
      'DELETE /api/orgs/org_1': () =>
        json({
          deletedAt: '2026-10-17T13:20:00+00:00',
          restoreClosesAt: '2026-11-16T13:20:00+00:00',
          restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
        }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    await screen.findByRole('button', { name: 'Try again' });
    fireEvent.change(screen.getByLabelText('Type Ìrè Events to confirm'), {
      target: { value: 'Ìrè Events' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ìrè Events' }));

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'DELETE /api/orgs/org_1')?.body).toEqual({
        name: 'Ìrè Events',
      }),
    );
  });

  it('opens no confirm for the organisation switched to before the count comes back (sc-11295)', async () => {
    const other = membership({ id: 'org_2', name: 'Ọ̀ṣun Weddings' });
    signedIn(IRE, [other]);
    const answers: ((response: Response) => void)[] = [];
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_2/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () => new Promise<Response>((answer) => answers.push(answer)),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    act(() => switchOrganisation('org_2'));
    await waitFor(() => expect(answers).toHaveLength(1));
    answers[0]!(json(DELETION));
    await new Promise((settled) => setTimeout(settled, 0));

    expect(screen.queryByRole('heading', { name: 'Delete Ọ̀ṣun Weddings?' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Delete Ìrè Events?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete organisation' })).toBeDefined();
  });

  it('sends nothing until the name is typed exactly, case and accents included, a curly apostrophe typing a straight one', async () => {
    signedIn(membership({ id: 'org_1', name: "Ìrè's Events" }));
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () =>
        json({
          events: 0,
          guests: 0,
          members: 2,
          restoreClosesAt: '2026-11-16T13:20:00+00:00',
          restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
        }),
      'DELETE /api/orgs/org_1': () =>
        json({
          deletedAt: '2026-10-17T13:20:00+00:00',
          restoreClosesAt: '2026-11-16T13:20:00+00:00',
          restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
        }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    const button = screen.getByRole('button', { name: "Delete Ìrè's Events" });
    expect(button.hasAttribute('disabled')).toBe(false);

    fireEvent.change(screen.getByLabelText("Type Ìrè's Events to confirm"), {
      target: { value: "ìrè's events" },
    });
    fireEvent.click(button);
    expect(screen.getByText("Type Ìrè's Events exactly as shown to delete it.")).toBeDefined();
    expect(sent.some((one) => one.line === 'DELETE /api/orgs/org_1')).toBe(false);

    fireEvent.change(screen.getByLabelText("Type Ìrè's Events to confirm"), {
      target: { value: '  Ìrè’s Events ' },
    });
    fireEvent.click(button);

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'DELETE /api/orgs/org_1')?.body).toEqual({
        name: '  Ìrè’s Events ',
      }),
    );
  });
});

describe('Transfer ownership keeps focus where the answer puts it (sc-11588)', () => {
  function proofAnswers(): (response: Response) => void {
    const waiting: ((response: Response) => void)[] = [];
    const held: Response[] = [];
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () =>
        new Promise<Response>((resolve) => {
          const ready = held.shift();
          if (ready != null) resolve(ready);
          else waiting.push(resolve);
        }),
    });

    return (response) => {
      const next = waiting.shift();
      if (next != null) next(response);
      else held.push(response);
    };
  }

  function refusal(code: string, status: number, extra: object = {}): Response {
    return json(
      {
        type: `https://soirely.com/errors/${code}`,
        title: 'That code did not work.',
        status,
        ...extra,
      },
      status,
    );
  }

  async function passwordTyped(): Promise<HTMLInputElement> {
    signedIn();
    settings();
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Bisi Adeyemi/ }));
    const password = screen.getByLabelText<HTMLInputElement>('Your password');
    fireEvent.change(password, { target: { value: 'a passphrase' } });

    return password;
  }

  const CODE = 'Code from your authenticator app, or a recovery code';

  it('keeps focus in Your password while it sends after Enter, then moves it to the code field asked for', async () => {
    const answer = proofAnswers();
    const password = await passwordTyped();
    password.focus();

    fireEvent.submit(password);
    await waitFor(() => expect(password.readOnly).toBe(true));
    expect(document.activeElement).toBe(password);

    act(() => answer(refusal('two_factor_required', 403, { pendingProof: 'pending_1' })));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(CODE)));
  });

  it('moves focus from Make ‹name› the owner to the code field asked for, then to it again once a code is refused', async () => {
    const answer = proofAnswers();
    await passwordTyped();
    const make = screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' });
    make.focus();

    fireEvent.click(make);
    act(() => answer(refusal('two_factor_required', 403, { pendingProof: 'pending_1' })));
    const code = await screen.findByLabelText<HTMLInputElement>(CODE);
    await waitFor(() => expect(document.activeElement).toBe(code));

    fireEvent.change(code, { target: { value: '000000' } });
    make.focus();
    fireEvent.click(make);
    await waitFor(() => expect(code.readOnly).toBe(true));
    act(() => answer(refusal('two_factor_code_invalid', 422)));

    expect(await screen.findByText('That code did not work.')).toBeDefined();
    expect(document.activeElement).toBe(code);
  });
});

describe('The way back is off while its request runs (sc-12511)', () => {
  const DID_NOT_GO_THROUGH = 'That did not go through. Nothing was changed. Try again in a moment.';

  function held(): { answer: () => Promise<Response>; fail: () => void } {
    let fail: () => void = () => {};
    const pending = new Promise<Response>((_, reject) => {
      fail = () => reject(new TypeError('Failed to fetch'));
    });

    return { answer: () => pending, fail };
  }

  function expectOff(button: HTMLElement, off: boolean): void {
    expect(button.getAttribute('aria-disabled')).toBe(String(off));
    expect(button.hasAttribute('data-off')).toBe(off);
  }

  it('keeps the transfer open on Keep ownership until the password is answered', async () => {
    signedIn();
    const proof = held();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': proof.answer,
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Bisi Adeyemi/ }));
    const keep = screen.getByRole('button', { name: 'Keep ownership' });
    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));
    expectOff(keep, false);

    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'a passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));
    await waitFor(() => expectOff(keep, true));
    fireEvent.click(keep);
    expect(screen.getByLabelText('Your password')).toBeDefined();

    act(() => proof.fail());
    expect(await screen.findByText(DID_NOT_GO_THROUGH)).toBeDefined();
    expectOff(keep, false);
    fireEvent.click(keep);
    expect(screen.queryByLabelText('Your password')).toBeNull();
  });

  it('keeps the leave open on Stay until it is answered', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_4', seededAs: 'coordinator', name: null },
        permissions: ['events.read'],
      }),
    );
    const leave = held();
    answering({ 'POST /api/orgs/org_1/leave': leave.answer });
    settings();

    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));
    const stay = screen.getByRole('button', { name: 'Stay' });
    fireEvent.click(screen.getByRole('button', { name: 'Leave Ìrè Events' }));
    await waitFor(() => expectOff(stay, true));
    fireEvent.click(stay);
    expect(screen.getByRole('heading', { name: 'Leave Ìrè Events?' })).toBeDefined();

    act(() => leave.fail());
    expect(await screen.findByText(DID_NOT_GO_THROUGH)).toBeDefined();
    expectOff(stay, false);
    fireEvent.click(stay);
    expect(screen.queryByRole('heading', { name: 'Leave Ìrè Events?' })).toBeNull();
  });

  it('keeps the delete open on Keep ‹organisation› until it is answered', async () => {
    signedIn();
    const deletion = held();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () => json(DELETION),
      'DELETE /api/orgs/org_1': deletion.answer,
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    const keep = screen.getByRole('button', { name: 'Keep Ìrè Events' });
    const name = screen.getByLabelText('Type Ìrè Events to confirm');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ìrè Events' }));
    expectOff(keep, false);

    fireEvent.change(name, { target: { value: 'Ìrè Events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ìrè Events' }));
    await waitFor(() => expectOff(keep, true));
    fireEvent.click(keep);
    expect(screen.getByLabelText('Type Ìrè Events to confirm')).toBeDefined();

    act(() => deletion.fail());
    expect(await screen.findByText(DID_NOT_GO_THROUGH)).toBeDefined();
    expectOff(keep, false);
    fireEvent.click(keep);
    expect(screen.queryByLabelText('Type Ìrè Events to confirm')).toBeNull();
  });
});

describe('Transfer ownership for an owner with no password (sc-18959)', () => {
  const GOOGLE_ONLY = {
    hasPassword: false,
    providers: [{ provider: 'google' as const, email: 'folake@gmail.com' }],
  };
  const SIGN_IN = { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' };
  const STANDS = () => new Date(Date.now() + 300_000).toISOString();

  function backFrom(returned: object): void {
    sessionStorage.setItem(
      'soirely.provider.returned',
      JSON.stringify({
        provider: 'google',
        purpose: { kind: 'transfer', organisation: 'org_1', owner: 'm_bisi' },
        ...returned,
      }),
    );
  }

  it('says the transfer asks for Google, and offers Continue with Google in place of the password', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    expect(
      await screen.findByText(
        'Hand Ìrè Events to another member. Asks you to confirm with Google first.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));

    expect(screen.queryByLabelText('Your password')).toBeNull();
    expect(
      screen.getByText('You sign in with Google, so confirm with Google instead.'),
    ).toBeDefined();
    expect(
      screen.getByText('So that nobody who picks up this device can give Ìrè Events away.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
  });

  it("offers Apple when it was linked first, as Confirm it's you does", async () => {
    signedIn(IRE, [], {
      hasPassword: false,
      providers: [
        { provider: 'apple', email: null },
        { provider: 'google', email: 'folake@gmail.com' },
      ],
    });
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));

    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
  });

  it('opens nothing until the new owner is chosen, then leaves for Google with them kept', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    const leave = vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(screen.getByText('Choose who becomes the owner.')).toBeDefined();
    expect(leave).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('radio', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    expect(new URL(leave.mock.calls[0]![0]).searchParams.get('max_age')).toBe('0');
    expect(JSON.parse(sessionStorage.getItem('soirely.google.attempt') ?? '{}').purpose).toEqual({
      kind: 'transfer',
      organisation: 'org_1',
      owner: 'm_bisi',
    });
  });

  it('back from Google, transfers nothing until Make ‹name› the owner is pressed', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    backFrom({ signIn: SIGN_IN });
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => json({ proof: 'p_g', expiresAt: STANDS() }),
      'POST /api/orgs/org_1/ownership': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json({}),
    });
    settings();

    expect(await screen.findByText('Signed in with Google')).toBeDefined();
    expect(sessionStorage.getItem('soirely.provider.returned')).toBeNull();
    expect(
      ((await screen.findByRole('radio', { name: /Bisi Adeyemi/ })) as HTMLInputElement).checked,
    ).toBe(true);
    expect(sent.find((one) => one.line === 'POST /api/auth/proof')?.body).toEqual({
      provider: 'google',
      providerSignIn: SIGN_IN,
    });
    expect(sent.some((one) => one.line === 'POST /api/orgs/org_1/ownership')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'POST /api/orgs/org_1/ownership')?.body).toEqual({
        membershipId: 'm_bisi',
        proof: 'p_g',
      }),
    );
  });

  it("keeps Google's words while it checks what Google brought back, off and busy (sc-22601)", async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    backFrom({ signIn: SIGN_IN });
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => new Promise<Response>(() => {}),
    });
    settings();

    const button = await screen.findByRole('button', { name: 'Continue with Google' });

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('data-off')).toBe(false);
    expect(screen.queryByText('Checking…')).toBeNull();
  });

  it('comes back from Google to Settings with Transfer ownership open and the owner chosen', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    sessionStorage.setItem(
      'soirely.google.attempt',
      JSON.stringify({
        state: 's',
        nonce: 'n',
        codeVerifier: 'v',
        purpose: { kind: 'transfer', organisation: 'org_1', owner: 'm_bisi' },
      }),
    );
    window.history.replaceState(null, '', '/oauth/google?state=s&code=the-code');
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => json({ proof: 'p_g', expiresAt: STANDS() }),
    });
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/oauth/google'] })} />,
    );

    expect(await screen.findByText('Signed in with Google')).toBeDefined();
    expect(
      ((await screen.findByRole('radio', { name: /Bisi Adeyemi/ })) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' })).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/auth/proof')?.body).toEqual({
      provider: 'google',
      providerSignIn: {
        code: 'the-code',
        codeVerifier: 'v',
        redirectUri: `${window.location.origin}/oauth/google`,
        nonce: 'n',
      },
    });
  });

  it('asks for the code after Google when two-factor is on, and a wrong one transfers nothing', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    backFrom({ signIn: SIGN_IN });
    const proofs = [
      () =>
        problem('two_factor_required', 403, {
          pendingProof: 'kept-1',
          providerEmail: 'folake@gmail.com',
        }),
      () => problem('two_factor_code_invalid', 422, { pendingProof: 'kept-1' }),
      () => json({ proof: 'p_g', expiresAt: STANDS() }),
    ];
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => proofs.shift()!(),
      'POST /api/orgs/org_1/ownership': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json({}),
    });
    settings();

    fireEvent.change(await screen.findByLabelText(/^Code from your authenticator/), {
      target: { value: '000000' },
    });
    expect(screen.getByText('Signed in with Google')).toBeDefined();
    fireEvent.click(await screen.findByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    expect(await screen.findByText('two_factor_code_invalid')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/orgs/org_1/ownership')).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Code from your authenticator/), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'POST /api/orgs/org_1/ownership')?.body).toEqual({
        membershipId: 'm_bisi',
        proof: 'p_g',
      }),
    );
    expect(sent.filter((one) => one.line === 'POST /api/auth/proof').at(-1)?.body).toEqual({
      pendingProof: 'kept-1',
      code: '123456',
    });
  });

  it('says another Google account is not the one linked, the new owner still chosen', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    backFrom({ signIn: SIGN_IN });
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => problem('invalid_credentials', 401),
    });
    settings();

    expect(
      await screen.findByText(
        "That Google account isn't the one linked here, or it was signed in too long ago. Try again.",
      ),
    ).toBeDefined();
    expect(
      ((await screen.findByRole('radio', { name: /Bisi Adeyemi/ })) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/orgs/org_1/ownership')).toBe(false);
  });

  it('says Google did not finish when it was closed, the new owner still chosen', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    backFrom({ failed: 'cancelled' });
    const sent = answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    expect(
      await screen.findByText("Google didn't finish, so nothing changed. Try again."),
    ).toBeDefined();
    expect(
      ((await screen.findByRole('radio', { name: /Bisi Adeyemi/ })) as HTMLInputElement).checked,
    ).toBe(true);
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);
  });

  it('returns to Continue with Google when its five minutes ran out before the press', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    backFrom({ signIn: SIGN_IN });
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'POST /api/auth/proof': () => json({ proof: 'p_g', expiresAt: STANDS() }),
      'POST /api/orgs/org_1/ownership': () => problem('proof_required', 403),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Make Bisi Adeyemi the owner' }));

    expect(
      await screen.findByText(
        'Your Google sign-in was more than 5 minutes ago, so nothing has changed yet. Continue with Google again to carry on.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.queryByText('Signed in with Google')).toBeNull();
    expect((screen.getByRole('radio', { name: /Bisi Adeyemi/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("asks afresh though Confirm it's you was passed a moment ago", async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    holdProof({ proof: 'held', expiresAt: STANDS() });
    answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
  });

  it('opens nothing back from a trip started in another organisation', async () => {
    signedIn(IRE, [], GOOGLE_ONLY);
    sessionStorage.setItem(
      'soirely.provider.returned',
      JSON.stringify({
        provider: 'google',
        purpose: { kind: 'transfer', organisation: 'org_2', owner: 'm_bisi' },
        signIn: SIGN_IN,
      }),
    );
    const sent = answering({ 'GET /api/orgs/org_1/members': () => json(MEMBERS) });
    settings();

    expect(await screen.findByRole('button', { name: 'Transfer ownership' })).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);
  });
});
