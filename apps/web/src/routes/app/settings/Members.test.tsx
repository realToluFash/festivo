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
});
