import { type Membership } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';

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

function signedIn(organisation = IRE, others: Membership[] = []): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    needsOrganisation: false,
    hasPassword: true,
    organisation,
    organisations: [organisation, ...others],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
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

afterEach(() => {
  vi.restoreAllMocks();
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

  it('leaves a failed count reading as counting, with the confirm still open (sc-11295)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () => json(MEMBERS),
      'GET /api/orgs/org_1/deletion': () => json({ title: 'Down' }, 503),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete organisation' }));
    await new Promise((settled) => setTimeout(settled, 0));

    expect(screen.getByRole('heading', { name: 'Delete Ìrè Events?' })).toBeDefined();
    expect(screen.getByText('Counting what it holds…')).toBeDefined();
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

  it('sends nothing until the name is typed exactly, case and accents included', async () => {
    signedIn();
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
    const button = screen.getByRole('button', { name: 'Delete Ìrè Events' });
    expect(button.hasAttribute('disabled')).toBe(false);

    fireEvent.change(screen.getByLabelText('Type Ìrè Events to confirm'), {
      target: { value: 'ìrè events' },
    });
    fireEvent.click(button);
    expect(screen.getByText('Type Ìrè Events exactly as shown to delete it.')).toBeDefined();
    expect(sent.some((one) => one.line === 'DELETE /api/orgs/org_1')).toBe(false);

    fireEvent.change(screen.getByLabelText('Type Ìrè Events to confirm'), {
      target: { value: '  Ìrè Events ' },
    });
    fireEvent.click(button);

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'DELETE /api/orgs/org_1')?.body).toEqual({
        name: '  Ìrè Events ',
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
