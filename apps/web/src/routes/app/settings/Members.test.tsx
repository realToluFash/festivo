import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { breaksAnywhere } from '../../../test-wrapping.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const FOLAKE = { id: 'u_folake', name: 'Folake Adeyemi' };
const BISI = { id: 'u_bisi', name: 'Bisi Adeyemi' };
const OWNER = { id: 'role_1', seededAs: 'owner', name: null };
const COORDINATOR = { id: 'role_4', seededAs: 'coordinator', name: null };

function role(id: string, seededAs: string, permissions: string[]) {
  return {
    id,
    seededAs,
    name: null,
    fixed: seededAs === 'owner',
    removable: false,
    permissions,
    holders: 1,
  };
}

const ROLES = {
  roles: [
    role('role_1', 'owner', OWNER_PERMISSIONS),
    role('role_4', 'coordinator', ['events.read', 'events.manage', 'budget.read']),
    role('role_5', 'read_only', ['events.read', 'budget.read']),
  ],
  areas: [],
};

// Every key MemberSerialiser::member and ::invitation write.
function member(overrides: Record<string, unknown>) {
  return {
    id: 'm_folake',
    user: { ...FOLAKE, email: 'folake@ire.events' },
    role: OWNER,
    status: 'active',
    former: null,
    channel: 'self_created',
    message: null,
    since: '2026-05-28T09:00:00+00:00',
    removesAt: null,
    invitedBy: null,
    invitedAt: null,
    self: true,
    history: [
      {
        from: null,
        to: 'active',
        channel: 'self_created',
        by: FOLAKE,
        at: '2026-05-28T09:00:00+00:00',
      },
    ],
    ...overrides,
  };
}

const LIST = {
  members: [
    member({}),
    member({
      id: 'm_bisi',
      user: { ...BISI, email: 'bisi@ire.events' },
      role: COORDINATOR,
      status: 'suspended',
      channel: 'invitation',
      since: '2026-06-10T09:00:00+00:00',
      invitedBy: FOLAKE,
      invitedAt: '2026-06-01T09:00:00+00:00',
      self: false,
      history: [
        {
          from: null,
          to: 'active',
          channel: 'invitation',
          by: BISI,
          at: '2026-06-02T09:00:00+00:00',
        },
        {
          from: 'active',
          to: 'suspended',
          channel: 'invitation',
          by: FOLAKE,
          at: '2026-06-10T09:00:00+00:00',
        },
      ],
    }),
    member({
      id: 'm_chidi',
      user: { id: 'u_chidi', name: 'Chidi Okoro', email: 'chidi@ire.events' },
      role: { id: 'role_5', seededAs: 'read_only', name: null },
      status: 'left_or_removed',
      former: 'removed',
      channel: 'invitation',
      since: '2026-07-12T09:00:00+00:00',
      self: false,
      history: [
        {
          from: 'pending_approval',
          to: 'left_or_removed',
          channel: 'request',
          by: FOLAKE,
          at: '2026-07-12T09:00:00+00:00',
        },
      ],
    }),
  ],
  invitations: [
    {
      id: 'inv_1',
      email: 'amaka@ire.events',
      role: COORDINATOR,
      invitedBy: FOLAKE,
      status: 'pending',
      sentAt: '2026-10-10T09:00:00+00:00',
      expiresAt: '2026-10-17T09:00:00+00:00',
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
    },
    {
      id: 'inv_2',
      email: 'yusuf.b@gmail.com',
      role: COORDINATOR,
      invitedBy: BISI,
      status: 'declined',
      sentAt: '2026-10-05T09:00:00+00:00',
      expiresAt: '2026-10-12T09:00:00+00:00',
      acceptedAt: null,
      declinedAt: '2026-10-09T09:00:00+00:00',
      revokedAt: null,
    },
  ],
};

function signedIn(organisation = IRE): void {
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
    organisations: [organisation],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function answering(answers: Record<string, () => Response>) {
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

const READS = {
  'GET /api/orgs/org_1/members': () => json(LIST),
  'GET /api/orgs/org_1/roles': () => json(ROLES),
};

function open() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/settings/members'] })}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
});

describe('Settings > Members', () => {
  it('lists who is here, how they came, and counts what is pending', async () => {
    signedIn();
    answering(READS);
    open();

    expect(await screen.findByText('Ìrè Events · 1 active · 1 invited')).toBeDefined();
    expect(
      screen.getByText('Owner · you · Created Ìrè Events · since Thursday, May 28'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Coordinator · Invitation from Folake Adeyemi · suspended Wednesday, Jun 10',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Chidi Okoro')).toBeNull();
  });

  it('keeps former members under Former, and opens their history with nothing to change', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Former/ }));

    expect(screen.getByText('Removed')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Chidi Okoro/ }));

    expect(await screen.findByRole('heading', { name: 'Chidi Okoro' })).toBeDefined();
    expect(screen.getByText(/^Turned down by /)).toBeDefined();
    expect(screen.getByText('No role yet · Removed')).toBeDefined();
    expect(screen.queryByText(/Read-only/)).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('says so when a filter holds nobody', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Awaiting approval/ }));

    expect(screen.getByText('Nobody is waiting')).toBeDefined();
  });

  it('shows invitations with their dates, and Revoke only on a pending one', async () => {
    signedIn();
    const sent = answering({
      ...READS,
      'DELETE /api/orgs/org_1/invitations/inv_1': () =>
        json({
          invitation: {
            ...LIST.invitations[0],
            status: 'revoked',
            revokedAt: '2026-10-11T09:00:00+00:00',
          },
        }),
    });
    open();

    expect(
      await screen.findByText('Sent Saturday, Oct 10 · expires Saturday, Oct 17'),
    ).toBeDefined();
    expect(screen.getByText('Coordinator · invited by you')).toBeDefined();
    expect(screen.getByText('Sent Monday, Oct 5 · declined Friday, Oct 9')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Sent Saturday, Oct 10 · revoked Sunday, Oct 11')).toBeDefined();
    expect(sent.map((one) => one.line)).toContain('DELETE /api/orgs/org_1/invitations/inv_1');
  });

  it('tells how somebody got here, naming who moved them', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));

    const history = within(screen.getByRole('list'));
    expect(history.getByText('Invited by Folake Adeyemi')).toBeDefined();
    expect(history.getByText('Accepted the invitation')).toBeDefined();
    expect(history.getByText('Suspended by you')).toBeDefined();
  });

  it('puts the invitation where it happened among the steps, not first', async () => {
    signedIn();
    const kemi = { id: 'u_kemi', name: 'Kemi Lawal' };
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          ...LIST,
          members: [
            ...LIST.members,
            member({
              id: 'm_kemi',
              user: { ...kemi, email: 'kemi@ire.events' },
              role: COORDINATOR,
              channel: 'invitation',
              since: '2026-06-03T09:00:00+00:00',
              invitedBy: FOLAKE,
              invitedAt: '2026-06-02T09:00:00+00:00',
              self: false,
              history: [
                {
                  from: null,
                  to: 'pending_approval',
                  channel: 'request',
                  by: kemi,
                  at: '2026-06-01T09:00:00+00:00',
                },
                {
                  from: 'pending_approval',
                  to: 'active',
                  channel: 'invitation',
                  by: kemi,
                  at: '2026-06-03T09:00:00+00:00',
                },
              ],
            }),
          ],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Kemi Lawal/ }));

    const lines = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Asked to join');
    expect(lines[1]).toContain('Invited by Folake Adeyemi');
    expect(lines[2]).toContain('Accepted the invitation');
  });

  it('offers no invite to a role that cannot manage members', async () => {
    signedIn(membership({ permissions: ['members.read', 'events.read'] }));
    answering(READS);
    open();

    expect(await screen.findByText('Invitations')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Invite somebody' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Awaiting approval/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
  });
});

const ADA = member({
  id: 'm_ada',
  user: { id: 'u_ada', name: 'Ada Okeke', email: 'ada@okeke.ng' },
  role: { id: 'role_5', seededAs: 'read_only', name: null },
  status: 'pending_approval',
  channel: 'request',
  since: '2026-10-12T08:40:00+00:00',
  removesAt: { at: '2026-11-11T08:40:00+00:00', written: 'Wednesday, Nov 11 at 09:40 WAT' },
  self: false,
  history: [
    {
      from: null,
      to: 'pending_approval',
      channel: 'request',
      by: { id: 'u_ada', name: 'Ada Okeke' },
      at: '2026-10-12T08:40:00+00:00',
    },
  ],
});
const WAITING = { ...LIST, members: [...LIST.members, ADA] };
const WAITING_READS = {
  'GET /api/orgs/org_1/members': () => json(WAITING),
  'GET /api/orgs/org_1/roles': () => json(ROLES),
};

describe('somebody awaiting approval (sc-392)', () => {
  it('shows who asked, how, when, and the instant they are removed, above the list and not in it', async () => {
    signedIn();
    answering(WAITING_READS);
    open();

    const section = within(await screen.findByRole('region', { name: 'Awaiting approval' }));

    expect(section.getByText('Ada Okeke')).toBeDefined();
    expect(section.getByText('ada@okeke.ng')).toBeDefined();
    expect(section.getByText('Asked to join · asked Monday, Oct 12')).toBeDefined();
    expect(
      section.getByText('Removed on Wednesday, Nov 11 at 09:40 WAT if nobody answers'),
    ).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Members shown' })).queryByText('Ada Okeke'),
    ).toBeNull();
  });

  it('approves as Read-only unless another role is picked, and says what happened', async () => {
    signedIn();
    const sent = answering({
      ...WAITING_READS,
      'POST /api/orgs/org_1/members/m_ada/approve': () => new Response(null, { status: 204 }),
    });
    open();

    const section = within(await screen.findByRole('region', { name: 'Awaiting approval' }));
    fireEvent.click(section.getByRole('button', { name: 'Approve' }));
    expect(document.activeElement).toBe(section.getByRole('radio', { name: /Read-only/ }));
    fireEvent.click(section.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(section.getByRole('button', { name: 'Approve' }));
    fireEvent.click(section.getByRole('button', { name: 'Approve' }));
    expect(section.queryByRole('radio', { name: /Owner/ })).toBeNull();
    expect((section.getByRole('radio', { name: /Read-only/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(section.getByRole('radio', { name: /Coordinator/ }));
    fireEvent.click(section.getByRole('button', { name: 'Approve as Coordinator' }));

    const done = await screen.findByRole('status');
    expect(done.textContent).toContain('Ada Okeke is now a member, as Coordinator.');
    expect(document.activeElement).toBe(done);
    expect(screen.getByRole('button', { name: 'See Ada Okeke' })).toBeDefined();
    expect(sent.find((one) => one.line.endsWith('/approve'))?.body).toEqual({ roleId: 'role_4' });
  });

  it('shows why an approve was refused, not the generic title', async () => {
    signedIn();
    answering({
      ...WAITING_READS,
      'POST /api/orgs/org_1/members/m_ada/approve': () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Some of the information provided is not valid.',
            status: 422,
            violations: [
              {
                propertyPath: 'roleId',
                message: 'Approve them first, then make them an owner from Members.',
                code: 'validation_failed',
              },
            ],
          }),
          { status: 422 },
        ),
    });
    open();

    const section = within(await screen.findByRole('region', { name: 'Awaiting approval' }));
    fireEvent.click(section.getByRole('button', { name: 'Approve' }));
    fireEvent.click(section.getByRole('button', { name: 'Approve as Read-only' }));

    expect(
      await screen.findByText('Approve them first, then make them an owner from Members.'),
    ).toBeDefined();
    expect(screen.queryByText('Some of the information provided is not valid.')).toBeNull();
  });

  it('turns down only once it is confirmed, and the request can be kept', async () => {
    signedIn();
    const sent = answering({
      ...WAITING_READS,
      'POST /api/orgs/org_1/members/m_ada/turn-down': () => new Response(null, { status: 204 }),
    });
    open();

    const section = within(await screen.findByRole('region', { name: 'Awaiting approval' }));
    fireEvent.click(section.getByRole('button', { name: 'Turn down' }));
    expect(document.activeElement).toBe(section.getByRole('heading', { name: /Turn down/ }));
    fireEvent.click(section.getByRole('button', { name: 'Keep the request' }));
    expect(document.activeElement).toBe(section.getByRole('button', { name: 'Turn down' }));
    fireEvent.click(section.getByRole('button', { name: 'Turn down' }));
    expect(section.getByText(/The email does not say who turned it down/)).toBeDefined();
    expect(sent.some((one) => one.line.endsWith('/turn-down'))).toBe(false);
    fireEvent.click(section.getByRole('button', { name: 'Turn down Ada Okeke' }));

    const done = await screen.findByRole('status');
    expect(done.textContent).toContain('Ada Okeke’s request is turned down.');
    expect(document.activeElement).toBe(done);
    expect(sent.some((one) => one.line.endsWith('/turn-down'))).toBe(true);
  });

  it('gives a pending person no role yet, and Approve and Turn down on their page', async () => {
    signedIn();
    answering(WAITING_READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Ada Okeke/ }));

    expect(screen.getAllByText(/No role yet/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Turn down' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('puts the server refusal on an answer somebody else gave first', async () => {
    signedIn();
    answering({
      ...WAITING_READS,
      'POST /api/orgs/org_1/members/m_ada/turn-down': () =>
        json(
          {
            type: 'https://soirely.com/errors/join_request_answered',
            title: 'This request has already been answered, or was removed.',
            status: 409,
          },
          409,
        ),
    });
    open();

    const section = within(await screen.findByRole('region', { name: 'Awaiting approval' }));
    fireEvent.click(section.getByRole('button', { name: 'Turn down' }));
    fireEvent.click(section.getByRole('button', { name: 'Turn down Ada Okeke' }));

    expect(
      await section.findByText('This request has already been answered, or was removed.'),
    ).toBeDefined();
  });
});

describe('inviting somebody', () => {
  it('names a 100-character organisation in a line that can break inside the word (sc-486)', async () => {
    const name = 'A'.repeat(100);
    signedIn(membership({ ...IRE, name }));
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite somebody' }));

    const shown = within(screen.getByRole('main')).getAllByText(new RegExp(name, 'u'));

    expect(shown.filter((element) => !breaksAnywhere(element))).toEqual([]);
  });

  it('asks for the address before sending anything', async () => {
    signedIn();
    const sent = answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite somebody' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(screen.getByText('Enter their email address.')).toBeDefined();
    expect(document.activeElement?.id).toBe('invite-email');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'amara' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(screen.getByText(/That does not look like an email address/)).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('POST'))).toBe(false);
  });

  it('starts on Coordinator, offers Owner only to an owner, and sends the choice', async () => {
    signedIn();
    const sent = answering({
      ...READS,
      'POST /api/orgs/org_1/members/invite': () =>
        json(
          {
            invitation: {
              ...LIST.invitations[0],
              id: 'inv_3',
              email: 'amara.o@gmail.com',
              role: { id: 'role_5', seededAs: 'read_only', name: null },
            },
          },
          201,
        ),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite somebody' }));

    expect((screen.getByRole('radio', { name: /Coordinator/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole('radio', { name: /Owner/ })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' amara.o@gmail.com ' } });
    fireEvent.click(screen.getByRole('radio', { name: /Read-only/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Invitation sent to amara.o@gmail.com.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/orgs/org_1/members/invite')?.body).toEqual({
      email: 'amara.o@gmail.com',
      roleId: 'role_5',
    });
  });

  it('keeps Owner and anything beyond the inviter off the list for a non-owner', async () => {
    signedIn(
      membership({
        role: COORDINATOR,
        permissions: [
          'members.read',
          'members.manage',
          'events.read',
          'events.manage',
          'budget.read',
        ],
      }),
    );
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite somebody' }));

    expect(screen.queryByRole('radio', { name: /Owner/ })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('puts the server refusal for a member on the address', async () => {
    signedIn();
    answering({
      ...READS,
      'POST /api/orgs/org_1/members/invite': () =>
        json(
          {
            type: 'https://soirely.com/errors/already_a_member',
            title: 'bisi@ire.events is already a member of Ìrè Events.',
            status: 409,
          },
          409,
        ),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite somebody' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bisi@ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() =>
      expect(screen.getByText('bisi@ire.events is already a member of Ìrè Events.')).toBeDefined(),
    );
  });

  it("changes a member's role, which takes effect on their next request", async () => {
    signedIn();
    const sent = answering({
      ...READS,
      'PATCH /api/orgs/org_1/members/m_bisi': () => new Response(null, { status: 204 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    const save = screen.getByRole('button', { name: 'Pick a different role' });
    expect(save.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Read-only/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Change their role to Read-only' }));

    expect(
      await screen.findByText(
        'Bisi Adeyemi is now Read-only. Takes effect on their next request; nobody is signed out.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.line === 'PATCH /api/orgs/org_1/members/m_bisi')?.body).toEqual({
      roleId: 'role_5',
    });
  });

  it('removes a member only once it is confirmed', async () => {
    signedIn();
    const sent = answering({
      ...READS,
      'DELETE /api/orgs/org_1/members/m_bisi': () => new Response(null, { status: 204 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Ìrè Events' }));
    expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bisi Adeyemi' }));

    expect(
      await screen.findByText('Bisi Adeyemi was removed. Their events stay with Ìrè Events.'),
    ).toBeDefined();
  });

  it('says why a domain member is suspended, when they go, and refuses Restore in the server words', async () => {
    const suspended = {
      members: [
        LIST.members[0],
        {
          ...LIST.members[1],
          channel: 'domain',
          suspension: {
            reason: 'address_gone',
            domain: 'ire.events',
            since: { at: '2026-10-17T13:20:00+00:00', written: 'Saturday, Oct 17 at 14:20 WAT' },
            removesAt: { at: '2026-11-16T13:20:00+00:00', written: 'Monday, Nov 16 at 14:20 WAT' },
          },
        },
      ],
      invitations: [],
    };
    signedIn();
    const sent = answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(suspended),
      'POST /api/orgs/org_1/members/m_bisi/restore': () =>
        json(
          {
            type: 'https://soirely.com/errors/restore_needs_address',
            title: 'Their access cannot be restored yet.',
            status: 409,
          },
          409,
        ),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));

    expect(screen.getByRole('heading', { name: /Suspended: company domain/ })).toBeDefined();
    expect(
      screen.getByText("Bisi Adeyemi's ire.events address is no longer on their account."),
    ).toBeDefined();
    expect(
      screen.getByText('If nobody answers by Monday, Nov 16 at 14:20 WAT, they are removed.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove from Ìrè Events' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(
      await screen.findByText('Bisi Adeyemi needs a verified ire.events address first.'),
    ).toBeDefined();
    expect(sent.map((one) => one.line)).toContain('POST /api/orgs/org_1/members/m_bisi/restore');
  });

  it('keeps saying a member is restored once the list reloads without their suspension', async () => {
    const suspended = {
      ...LIST.members[1],
      channel: 'domain',
      suspension: {
        reason: 'address_gone',
        domain: 'ire.events',
        since: { at: '2026-10-17T13:20:00+00:00', written: 'Saturday, Oct 17 at 14:20 WAT' },
        removesAt: { at: '2026-11-16T13:20:00+00:00', written: 'Monday, Nov 16 at 14:20 WAT' },
      },
    };
    let restored = false;
    signedIn();
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          members: [LIST.members[0], restored ? LIST.members[1] : suspended],
          invitations: [],
        }),
      'POST /api/orgs/org_1/members/m_bisi/restore': () => {
        restored = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(
      await screen.findByText("Bisi Adeyemi's access to Ìrè Events is restored."),
    ).toBeDefined();
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /Suspended: company address gone/ })).toBeNull(),
    );
    expect(screen.getByText("Bisi Adeyemi's access to Ìrè Events is restored.")).toBeDefined();
  });

  it('shows no removal date for a suspended only owner', async () => {
    signedIn();
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          members: [
            LIST.members[0],
            {
              ...LIST.members[1],
              channel: 'domain',
              suspension: {
                reason: 'address_gone',
                domain: 'ire.events',
                since: {
                  at: '2026-10-17T13:20:00+00:00',
                  written: 'Saturday, Oct 17 at 14:20 WAT',
                },
                removesAt: null,
              },
            },
          ],
          invitations: [],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));

    expect(screen.getByRole('heading', { name: /Suspended: company domain/ })).toBeDefined();
    expect(screen.queryByText(/if nobody answers/)).toBeNull();
  });

  it.each(['address_gone', 'domain_closed', 'domain_managed_elsewhere'])(
    'says a %s suspension came through the company domain in the history',
    async (reason) => {
      signedIn();
      answering({
        ...READS,
        'GET /api/orgs/org_1/members': () =>
          json({
            members: [
              LIST.members[0],
              {
                ...LIST.members[1],
                channel: 'domain',
                status: 'suspended',
                suspension: {
                  reason,
                  domain: 'ire.events',
                  since: {
                    at: '2026-10-17T13:20:00+00:00',
                    written: 'Saturday, Oct 17 at 14:20 WAT',
                  },
                  removesAt: null,
                },
                history: [
                  {
                    from: 'active',
                    to: 'suspended',
                    channel: 'domain',
                    by: null,
                    at: '2026-10-17T13:20:00+00:00',
                  },
                ],
              },
            ],
            invitations: [],
          }),
      });
      open();

      fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));

      expect(
        within(screen.getByRole('region', { name: 'How they got here' })).getByText(
          'Suspended: company domain',
        ),
      ).toBeDefined();
      expect(screen.queryByText(/no longer gives access/)).toBeNull();
    },
  );

  it('lets an administrator restore the suspended only owner, and shows Remove refused in the server words', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('billing')),
      }),
    );
    const sent = answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          ...LIST,
          members: [
            member({
              self: false,
              status: 'suspended',
              channel: 'domain',
              suspension: {
                reason: 'address_gone',
                domain: 'ire.events',
                since: {
                  at: '2026-10-17T13:20:00+00:00',
                  written: 'Saturday, Oct 17 at 14:20 WAT',
                },
                removesAt: null,
                onlyOwner: true,
              },
              history: [
                {
                  from: null,
                  to: 'active',
                  channel: 'domain',
                  by: FOLAKE,
                  at: '2026-05-28T09:00:00+00:00',
                },
                {
                  from: 'active',
                  to: 'suspended',
                  channel: 'domain',
                  by: FOLAKE,
                  at: '2026-10-17T13:20:00+00:00',
                },
              ],
            }),
            member({
              id: 'm_bisi',
              user: { ...BISI, email: 'bisi@ire.events' },
              role: { id: 'role_2', seededAs: 'administrator', name: null },
              self: true,
            }),
          ],
        }),
      'DELETE /api/orgs/org_1/members/m_folake': () =>
        json(
          {
            type: 'https://soirely.com/errors/last_owner',
            title: 'An organisation always has at least one owner.',
            status: 409,
          },
          409,
        ),
      'POST /api/orgs/org_1/members/m_folake/restore': () => new Response(null, { status: 204 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Folake Adeyemi/ }));

    expect(screen.getByRole('heading', { name: /Suspended: company domain/ })).toBeDefined();
    expect(
      screen.getByText(
        'Folake Adeyemi is the only owner of Ìrè Events, so they stay suspended, still an owner, and are not removed.',
      ),
    ).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'How they got here' })).getByText(
        'Suspended: company domain',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/Only an owner can change/)).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove from Ìrè Events' }));

    const refused = await screen.findByText('An organisation always has at least one owner.');
    expect(sent.map((one) => one.line)).toContain('DELETE /api/orgs/org_1/members/m_folake');
    expect(
      screen.getByText('Folake Adeyemi is the only owner, so they cannot be removed.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Restore works once their main email address is a verified ire.events address again.',
      ),
    ).toBeDefined();
    await waitFor(() => expect(refused.closest('[tabindex="-1"]')).toBe(document.activeElement));

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(sent.map((one) => one.line)).toContain(
        'POST /api/orgs/org_1/members/m_folake/restore',
      ),
    );
  });

  it('shows a suspended owner read-only, removal date included, to an administrator beside another active owner', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('billing')),
      }),
    );
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          ...LIST,
          members: [
            member({
              self: false,
              status: 'suspended',
              channel: 'domain',
              suspension: {
                reason: 'address_gone',
                domain: 'ire.events',
                since: {
                  at: '2026-10-17T13:20:00+00:00',
                  written: 'Saturday, Oct 17 at 14:20 WAT',
                },
                removesAt: {
                  at: '2026-11-16T13:20:00+00:00',
                  written: 'Monday, Nov 16 at 14:20 WAT',
                },
                onlyOwner: false,
              },
            }),
            member({
              id: 'm_tunde',
              user: { id: 'u_tunde', name: 'Tunde Bakare', email: 'tunde@ire.events' },
              self: false,
            }),
            member({
              id: 'm_bisi',
              user: { ...BISI, email: 'bisi@ire.events' },
              role: { id: 'role_2', seededAs: 'administrator', name: null },
              self: true,
            }),
          ],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Folake Adeyemi/ }));

    expect(screen.getByRole('heading', { name: /Suspended: company domain/ })).toBeDefined();
    expect(
      screen.getByText("Folake Adeyemi's ire.events address is no longer on their account."),
    ).toBeDefined();
    expect(
      screen.getByText('If nobody answers by Monday, Nov 16 at 14:20 WAT, they are removed.'),
    ).toBeDefined();
    expect(screen.getAllByText(/Only an owner can change/)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove from Ìrè Events' })).toBeNull();
  });

  it('tells an administrator why an active owner beside another owner has no role picker', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('billing')),
      }),
    );
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          ...LIST,
          members: [
            member({ self: false }),
            member({
              id: 'm_tunde',
              user: { id: 'u_tunde', name: 'Tunde Bakare', email: 'tunde@ire.events' },
              self: false,
            }),
            member({
              id: 'm_bisi',
              user: { ...BISI, email: 'bisi@ire.events' },
              role: { id: 'role_2', seededAs: 'administrator', name: null },
              self: true,
            }),
          ],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Folake Adeyemi/ }));

    expect(
      await screen.findAllByText("Only an owner can change an owner's role or remove them."),
    ).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Remove from Ìrè Events' })).toBeNull();
  });

  it('shows a suspended member read-only, removal date included, to a viewer who cannot manage members', async () => {
    signedIn(membership({ permissions: ['members.read', 'events.read'] }));
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          members: [
            { ...LIST.members[0], self: false },
            {
              ...LIST.members[1],
              channel: 'domain',
              suspension: {
                reason: 'address_gone',
                domain: 'ire.events',
                since: {
                  at: '2026-10-17T13:20:00+00:00',
                  written: 'Saturday, Oct 17 at 14:20 WAT',
                },
                removesAt: {
                  at: '2026-11-16T13:20:00+00:00',
                  written: 'Monday, Nov 16 at 14:20 WAT',
                },
                onlyOwner: false,
              },
            },
          ],
          invitations: [],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));

    expect(screen.getByRole('heading', { name: /Suspended: company domain/ })).toBeDefined();
    expect(
      screen.getByText("Bisi Adeyemi's ire.events address is no longer on their account."),
    ).toBeDefined();
    expect(
      screen.getByText('If nobody answers by Monday, Nov 16 at 14:20 WAT, they are removed.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove from Ìrè Events' })).toBeNull();
    expect(screen.queryByText(/Only an owner can change/)).toBeNull();
  });

  it('offers neither a role change nor removal on your own row', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Folake Adeyemi/ }));

    expect(screen.getByText(/You can't change your own role/)).toBeDefined();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('says the only owner can be neither changed nor removed', async () => {
    signedIn(
      membership({
        id: 'org_1',
        name: 'Ìrè Events',
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('billing')),
      }),
    );
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          ...LIST,
          members: [
            member({ self: false }),
            member({
              id: 'm_bisi',
              user: { ...BISI, email: 'bisi@ire.events' },
              role: { id: 'role_2', seededAs: 'administrator', name: null },
              self: true,
            }),
          ],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Folake Adeyemi/ }));

    expect(screen.getByText(/Folake Adeyemi is the only owner/)).toBeDefined();
    expect(
      screen.getByText('Only an owner can make somebody else an owner. Ask Folake Adeyemi.'),
    ).toBeDefined();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });
});
