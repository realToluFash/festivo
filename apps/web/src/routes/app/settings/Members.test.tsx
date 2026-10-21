import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
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
    since: '2026-05-28T09:00:00+00:00',
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
      role: COORDINATOR,
      status: 'left_or_removed',
      former: 'removed',
      channel: 'invitation',
      since: '2026-07-12T09:00:00+00:00',
      self: false,
      history: [],
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

const ACTIVE_BISI = member({
  ...LIST.members[1],
  status: 'active',
  history: LIST.members[1]?.history.slice(0, 1),
});

function listWith(bisi: ReturnType<typeof member>) {
  return { ...LIST, members: [LIST.members[0], bisi, LIST.members[2]] };
}

const ADMINISTRATOR = membership({
  id: 'org_1',
  name: 'Ìrè Events',
  role: { id: 'role_2', seededAs: 'administrator', name: null },
  permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('billing')),
});

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

  it('keeps former members under Former, without a way into them', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Former/ }));

    expect(screen.getByText('Chidi Okoro')).toBeDefined();
    expect(screen.getByText('Removed')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Chidi Okoro/ })).toBeNull();
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

describe('inviting somebody', () => {
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
      'GET /api/orgs/org_1/members': () => json(listWith(ACTIVE_BISI)),
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
      'GET /api/orgs/org_1/members': () => json(listWith(ACTIVE_BISI)),
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

describe('suspending and restoring a member', () => {
  it('suspends only once it is confirmed, and says so at the top', async () => {
    signedIn();
    let suspended = false;
    const sent = answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(suspended ? LIST : listWith(ACTIVE_BISI)),
      'POST /api/orgs/org_1/members/m_bisi/suspend': () => {
        suspended = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(sent.some((one) => one.line.endsWith('/suspend'))).toBe(false);
    expect(document.activeElement?.textContent).toBe('Suspend Bisi Adeyemi?');
    expect(screen.getByRole('button', { name: 'Keep Bisi Adeyemi' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Suspend Bisi Adeyemi' }));

    expect(await screen.findByText('Bisi Adeyemi is suspended.')).toBeDefined();
    expect(await screen.findByText('Access for Bisi Adeyemi is suspended')).toBeDefined();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText(/Their role is kept while they're suspended/)).toBeDefined();
  });

  it('offers no Suspend on your own detail, and says why on an owner', async () => {
    signedIn();
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json({
          ...LIST,
          members: [
            ...LIST.members,
            member({
              id: 'm_kemi',
              user: { id: 'u_kemi', name: 'Kemi Lawal', email: null },
              self: false,
            }),
          ],
        }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /^Folake Adeyemi/ }));
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Members/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Kemi Lawal/ }));

    expect(
      screen.getByText(
        "Owners can't be suspended. To suspend Kemi Lawal, change their role first.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
  });

  it('offers neither Suspend nor Restore without members.manage', async () => {
    signedIn(membership({ permissions: ['members.read', 'events.read'] }));
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));

    expect(screen.queryByRole('button', { name: 'Restore access' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
  });

  it('restores without asking, with the role they held', async () => {
    signedIn();
    let restored = false;
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(restored ? listWith(ACTIVE_BISI) : LIST),
      'POST /api/orgs/org_1/members/m_bisi/restore': () => {
        restored = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore access' }));

    expect(await screen.findByText('Bisi Adeyemi has access again, as Coordinator.')).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Suspend' })).toBeDefined();
  });

  it('asks first before removing a suspended member, and keeps them suspended on Keep', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bisi Adeyemi' }));

    expect(
      screen.getByText(
        'Removing Bisi Adeyemi ends their membership of Ìrè Events. Their events stay with Ìrè Events.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep them suspended' }));
    expect(screen.getByRole('button', { name: 'Restore access' })).toBeDefined();
  });

  it('says every seat is in use, and offers the plan only to an owner', async () => {
    for (const [session, plan] of [
      [IRE, true],
      [ADMINISTRATOR, false],
    ] as const) {
      signedIn(session);
      answering({
        ...READS,
        'POST /api/orgs/org_1/members/m_bisi/restore': () =>
          json(
            {
              type: 'https://soirely.com/errors/team_seats_in_use',
              title: "Every team seat on this organisation's plan is in use.",
              status: 409,
              limit: 5,
            },
            409,
          ),
      });
      const view = open();

      fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Restore access' }));

      expect(
        await screen.findByText(
          "All 5 team seats on this organisation's plan are in use, so nothing has changed.",
        ),
      ).toBeDefined();
      expect(screen.getByText("Suspended members don't take a seat.")).toBeDefined();
      expect(screen.getByRole('button', { name: 'Open Members ›' })).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Change the plan ›' }) != null).toBe(plan);
      expect(screen.getByRole('button', { name: 'Restore access' }).hasAttribute('disabled')).toBe(
        false,
      );
      view.unmount();
      vi.restoreAllMocks();
    }
  });

  it('reloads and says why when somebody else changed their access first', async () => {
    signedIn();
    let reloaded = false;
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(reloaded ? LIST : listWith(ACTIVE_BISI)),
      'POST /api/orgs/org_1/members/m_bisi/suspend': () => {
        reloaded = true;
        return json(
          { type: 'https://soirely.com/errors/conflict', title: 'Conflict', status: 409 },
          409,
        );
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Bisi Adeyemi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspend Bisi Adeyemi' }));

    expect(
      await screen.findByText(
        "Someone else changed the access for Bisi Adeyemi while this page was open, so your change wasn't made. This is how it stands now.",
      ),
    ).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Restore access' })).toBeDefined();
  });
});
