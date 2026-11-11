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
const ADMIN = { id: 'role_4', seededAs: 'administrator', name: null };

function role(id: string, seededAs: string, permissions: string[]) {
  return {
    id,
    seededAs,
    name: null,
    fixed: seededAs === 'owner',
    removable: false,
    permissions,
    holders: 1,
    holderNames: [{ name: 'Folake Adeyemi', suspended: false }],
  };
}

const ROLES = {
  roles: [
    role('role_1', 'owner', OWNER_PERMISSIONS),
    role('role_4', 'administrator', ['events.read', 'events.manage', 'budget.read']),
    role('role_5', 'member', []),
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
      role: ADMIN,
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
      role: { id: 'role_5', seededAs: 'member', name: null },
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
      role: ADMIN,
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
      role: ADMIN,
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

const SUSPENDED_BISI = member({
  ...LIST.members[1],
  history: [
    ...(LIST.members[1]?.history.slice(0, 1) ?? []),
    {
      from: 'active',
      to: 'suspended',
      channel: 'settings',
      by: FOLAKE,
      at: '2026-06-10T09:00:00+00:00',
    },
  ],
  suspension: {
    reason: 'manual',
    domain: null,
    since: { at: '2026-06-10T09:00:00+00:00', written: 'Wednesday, Jun 10 at 10:00 WAT' },
    removesAt: null,
    onlyOwner: false,
  },
});

function listWith(bisi: ReturnType<typeof member>) {
  return { ...LIST, members: [LIST.members[0], bisi, LIST.members[2]] };
}

function signedIn(organisation = IRE): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
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
  sessionStorage.clear();
});

const ADA = member({
  id: 'm_ada',
  user: { id: 'u_ada', name: 'Ada Okeke', email: 'ada@okeke.ng' },
  role: { id: 'role_5', seededAs: 'member', name: null },
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

const page = () => within(document.querySelector<HTMLElement>('.members-desk') ?? document.body);
const done = () => new Response(null, { status: 204 });

async function openPerson(name: string) {
  fireEvent.click(await page().findByRole('button', { name: new RegExp(`^${name}`) }));
  return page().findByRole('heading', { level: 1, name });
}

describe('Members at a desk (sc-34200)', () => {
  it('opens on the summary card, then People, then the invitations', async () => {
    signedIn();
    answering(READS);
    open();

    expect(await page().findByText('2 people')).toBeDefined();
    const headings = page()
      .getAllByRole('heading')
      .map((one) => one.textContent);
    expect(headings).toEqual(['Members', 'People', 'Invitations']);
    expect(page().getByRole('button', { name: 'All · 2' })).toBeDefined();
    expect(page().getByText('Owner · you')).toBeDefined();
    expect(page().getByText('Suspended')).toBeDefined();
    expect(page().queryByText('Chidi Okoro')).toBeNull();
  });

  it('puts Waiting first, and the card’s one step answers the oldest request', async () => {
    signedIn();
    answering(WAITING_READS);
    open();

    expect(await page().findByText('2 people · 1 waiting')).toBeDefined();
    const headings = page()
      .getAllByRole('heading')
      .map((one) => one.textContent);
    expect(headings).toEqual(['Members', 'Waiting', 'People', 'Invitations']);
    expect(
      page().getByText('Removed on Wednesday, Nov 11 at 09:40 WAT if nobody answers.'),
    ).toBeDefined();

    fireEvent.click(page().getByRole('button', { name: 'Answer Ada Okeke' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Ada’s request' }));
    expect(dialog.queryByRole('radio', { name: /Owner/ })).toBeNull();
    expect((dialog.getByRole('radio', { name: /^Member/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('approves with the role picked, and says so on the card with See ‹name›', async () => {
    signedIn();
    const sent = answering({
      ...WAITING_READS,
      'POST /api/orgs/org_1/members/m_ada/approve': done,
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: /^Ada Okeke/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Ada’s request' }));
    fireEvent.click(dialog.getByRole('radio', { name: /^Admin/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(await page().findByText('Ada Okeke joined as Admin')).toBeDefined();
    expect(sent.find((one) => one.line.endsWith('/approve'))?.body).toEqual({ roleId: 'role_4' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(page().getByRole('button', { name: 'See Ada Okeke' })).toBeDefined();
  });

  it('turns a request down only once it is confirmed', async () => {
    signedIn();
    const sent = answering({
      ...WAITING_READS,
      'POST /api/orgs/org_1/members/m_ada/turn-down': done,
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Answer Ada Okeke' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn down the request…' }));
    const ask = within(await screen.findByRole('alertdialog', { name: 'Turn down Ada Okeke?' }));
    fireEvent.click(ask.getByRole('button', { name: 'Keep the request' }));
    expect(sent.some((one) => one.line.endsWith('/turn-down'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Turn down the request…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn down' }),
    );

    expect(await page().findByText('You turned down Ada Okeke')).toBeDefined();
    expect(page().getByRole('button', { name: 'See Former' })).toBeDefined();
  });

  it('filters People from its menu, with Former not opened and an empty filter said', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await page().findByRole('button', { name: 'All · 2' }));
    fireEvent.click(page().getByRole('menuitemradio', { name: /^Former/ }));

    expect(page().getByText('Chidi Okoro')).toBeDefined();
    expect(page().getByText('Removed')).toBeDefined();
    expect(page().queryByRole('button', { name: /^Chidi Okoro/ })).toBeNull();

    fireEvent.click(page().getByRole('button', { name: 'Former · 1' }));
    fireEvent.click(page().getByRole('menuitemradio', { name: /^Awaiting approval/ }));
    expect(page().getByText('Nobody is waiting')).toBeDefined();
    fireEvent.click(page().getByRole('button', { name: 'Show everyone' }));
    expect(page().getByRole('button', { name: 'All · 2' })).toBeDefined();
  });

  it('shows each invitation’s dates, Revoke on a pending one, then Invite again in its place', async () => {
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

    expect(await page().findByText('amaka@ire.events')).toBeDefined();
    expect(page().getByText('Admin · invited by you')).toBeDefined();
    expect(page().getByText('Declined')).toBeDefined();
    expect(page().getAllByRole('button', { name: 'Invite again' })).toHaveLength(1);

    fireEvent.click(page().getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(page().getAllByRole('button', { name: 'Invite again' })).toHaveLength(2),
    );
    expect(sent.some((one) => one.line === 'DELETE /api/orgs/org_1/invitations/inv_1')).toBe(true);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Invite again'));
  });

  it('asks for the address before inviting, then says the invitation went on the card', async () => {
    signedIn();
    const sent = answering({
      ...READS,
      'POST /api/orgs/org_1/members/invite': () =>
        json(
          {
            invitation: {
              ...LIST.invitations[0],
              id: 'inv_3',
              email: 'kemi@ire.events',
              role: { id: 'role_5', seededAs: 'member', name: null },
            },
          },
          201,
        ),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Invite somebody' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Invite somebody' }));
    const email = dialog.getByRole('textbox', { name: 'Email' });
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect((dialog.getByRole('radio', { name: /^Member/ }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    expect(dialog.getByText('Enter their email address.')).toBeDefined();
    expect(sent.some((one) => one.line.endsWith('/invite'))).toBe(false);

    fireEvent.change(email, { target: { value: ' kemi@ire.events ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));

    expect(await page().findByText('Invitation sent to kemi@ire.events')).toBeDefined();
    expect(sent.find((one) => one.line.endsWith('/invite'))?.body).toMatchObject({
      email: 'kemi@ire.events',
      roleId: 'role_5',
    });
  });

  it('asks before throwing away a half-typed invitation', async () => {
    signedIn();
    answering(READS);
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Invite somebody' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Invite somebody' }));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Email' }), { target: { value: 'k' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    const ask = within(await screen.findByRole('alertdialog', { name: 'Discard your change?' }));
    fireEvent.click(ask.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('offers no invite, and no Waiting, to a role that cannot manage members', async () => {
    signedIn(
      membership({ id: 'org_1', name: 'Ìrè Events', permissions: ['members.read', 'events.read'] }),
    );
    answering(WAITING_READS);
    open();

    expect(await page().findByText('2 people')).toBeDefined();
    expect(page().queryByRole('button', { name: 'Invite somebody' })).toBeNull();
    expect(page().queryByText('Waiting')).toBeNull();
    expect(page().queryByRole('button', { name: /^Answer/ })).toBeNull();
  });

  it('says the list did not load, and loads it again on Try again', async () => {
    signedIn();
    let fails = true;
    answering({
      'GET /api/orgs/org_1/members': () => {
        if (fails) throw new TypeError('Failed to fetch');
        return json(LIST);
      },
      'GET /api/orgs/org_1/roles': () => json(ROLES),
    });
    open();

    expect(await page().findByRole('alert')).toBeDefined();
    expect(page().getByText('We could not load the members.')).toBeDefined();
    fails = false;
    fireEvent.click(page().getByRole('button', { name: 'Try again' }));

    expect(await page().findByText('2 people')).toBeDefined();
  });
});

describe('a person at a desk (sc-34200)', () => {
  it('opens in the list’s place, with ‹ Members back to the list', async () => {
    signedIn();
    answering(READS);
    open();

    const name = await openPerson('Bisi Adeyemi');
    await waitFor(() => expect(document.activeElement).toBe(name), { timeout: 3000 });
    expect(page().getByText('bisi@ire.events')).toBeDefined();
    expect(page().getByRole('heading', { name: 'How they got here' })).toBeDefined();
    expect(page().getByText('Invited by you')).toBeDefined();

    fireEvent.click(page().getByRole('button', { name: 'Members' }));
    expect(await page().findByText('2 people')).toBeDefined();
  });

  it('changes a role in its dialog, said on the person’s card', async () => {
    signedIn();
    let list: unknown = listWith(ACTIVE_BISI);
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(list),
      'GET /api/orgs/org_1/roles': () => json(ROLES),
      'PATCH /api/orgs/org_1/members/m_bisi': () => {
        list = listWith(
          member({ ...ACTIVE_BISI, role: { id: 'role_5', seededAs: 'member', name: null } }),
        );
        return done();
      },
    });
    open();

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Change role' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Bisi’s role' }));
    expect(dialog.getByText('Now')).toBeDefined();
    fireEvent.click(dialog.getByRole('radio', { name: /^Member/ }));
    expect(
      dialog.getByText('Bisi Adeyemi becomes Member on their next request. Nobody is signed out.'),
    ).toBeDefined();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

    expect(await page().findByText('Bisi Adeyemi is now Member.')).toBeDefined();
    expect(sent.find((one) => one.line.startsWith('PATCH'))?.body).toMatchObject({
      roleId: 'role_5',
    });
  });

  it('suspends only once it is confirmed', async () => {
    signedIn();
    let list: unknown = listWith(ACTIVE_BISI);
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(list),
      'GET /api/orgs/org_1/roles': () => json(ROLES),
      'POST /api/orgs/org_1/members/m_bisi/suspend': () => {
        list = listWith(SUSPENDED_BISI);
        return done();
      },
    });
    open();

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Suspend…' }));
    const ask = within(await screen.findByRole('alertdialog', { name: 'Suspend Bisi Adeyemi?' }));
    fireEvent.click(ask.getByRole('button', { name: 'Suspend' }));

    expect(await page().findByText(/listed under Suspended in Members/)).toBeDefined();
    expect(sent.some((one) => one.line.endsWith('/suspend'))).toBe(true);
    expect(page().getByRole('button', { name: 'Restore access' })).toBeDefined();
  });

  it('restores a suspended member from the card’s step', async () => {
    signedIn();
    let list: unknown = listWith(SUSPENDED_BISI);
    const sent = answering({
      'GET /api/orgs/org_1/members': () => json(list),
      'GET /api/orgs/org_1/roles': () => json(ROLES),
      'POST /api/orgs/org_1/members/m_bisi/restore': () => {
        list = listWith(ACTIVE_BISI);
        return done();
      },
    });
    open();

    await openPerson('Bisi Adeyemi');
    expect(page().getByText(/Restore access returns them as Admin/)).toBeDefined();
    fireEvent.click(page().getByRole('button', { name: 'Restore access' }));

    expect(await page().findByText('Bisi Adeyemi has access again, as Admin.')).toBeDefined();
    expect(sent.some((one) => one.line.endsWith('/restore'))).toBe(true);
  });

  it('removes only once it is confirmed, then says so on the list’s card', async () => {
    signedIn();
    let list: unknown = listWith(ACTIVE_BISI);
    answering({
      'GET /api/orgs/org_1/members': () => json(list),
      'GET /api/orgs/org_1/roles': () => json(ROLES),
      'DELETE /api/orgs/org_1/members/m_bisi': () => {
        list = listWith(member({ ...ACTIVE_BISI, status: 'left_or_removed', former: 'removed' }));
        return done();
      },
    });
    open();

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Remove from Ìrè Events…' }));
    const ask = within(
      await screen.findByRole('alertdialog', { name: 'Remove Bisi Adeyemi from Ìrè Events?' }),
    );
    fireEvent.click(ask.getByRole('button', { name: 'Remove' }));

    expect(await page().findByText('Bisi Adeyemi was removed')).toBeDefined();
    expect(page().getByRole('button', { name: 'See Former' })).toBeDefined();
  });

  it('offers nothing to change on your own page', async () => {
    signedIn();
    answering(READS);
    open();

    await openPerson('Folake Adeyemi');
    expect(page().queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(page().queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(page().getByRole('button', { name: 'Go to General' })).toBeDefined();
  });
});

const CLAIM_PATH = '/api/orgs/org_1/owner-claim';
const LAPSES = { at: '2026-10-31T09:00:00+00:00', written: 'Saturday 31 Oct at 10:00 WAT' };
const PASSES = { at: '2026-10-27T09:00:00+00:00', written: 'Tuesday 27 Oct at 10:00 WAT' };
const AS_ADMIN = membership({
  id: 'org_1',
  name: 'Ìrè Events',
  role: { id: 'role_4', seededAs: 'administrator', name: null },
});

// Every key OwnerClaimDescriber::forMembers writes; OwnerClaimTest asserts the same list.
function banner(overrides: Record<string, unknown> = {}) {
  return {
    state: 'no_owner',
    domain: 'ire.events',
    claim: null,
    stopped: null,
    lapsed: null,
    ...overrides,
  };
}

function claimed(mine: boolean, found = false) {
  return banner({
    state: found ? 'found' : 'open',
    claim: {
      id: 'claim_1',
      claimant: { id: 'u_bisi', name: 'Bisi', email: 'bisi@ire.events' },
      mine,
      domain: 'ire.events',
      record: mine
        ? { type: 'TXT', name: '_soirely-verify.ire.events', value: 'soirely-claim=abc123' }
        : null,
      startedAt: LAPSES,
      lapsesAt: LAPSES,
      foundAt: found ? PASSES : null,
      passesAt: found ? PASSES : null,
    },
  });
}

function withClaim(answers: Record<string, () => Response>) {
  signedIn(AS_ADMIN);

  return answering({ ...READS, ...answers });
}

describe('the owner claim on the summary card (sc-34200, sc-6640)', () => {
  it('says there is no active owner, and Become the owner opens the record to publish', async () => {
    const sent = withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: banner() }),
      [`POST ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true) }, 201),
    });
    open();

    expect(await page().findByText('Ìrè Events has no active owner')).toBeDefined();
    expect(
      page().getByText(
        'Events, guests and your permissions keep working. Only Owner actions, such as billing, wait for an owner.',
      ),
    ).toBeDefined();
    fireEvent.click(page().getByRole('button', { name: 'Become the owner' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Become the owner' }));
    expect(dialog.getByRole('heading', { name: 'Prove you control ire.events' })).toBeDefined();
    expect(dialog.getByText('_soirely-verify.ire.events')).toBeDefined();
    expect(dialog.getByText('soirely-claim=abc123')).toBeDefined();
    expect(dialog.getByRole('button', { name: 'Copy Value' })).toBeDefined();
    expect(sent.find((one) => one.line === `POST ${CLAIM_PATH}`)?.body).toEqual({});
    expect(await page().findByText('Your claim is open')).toBeDefined();
  });

  it('says why when the claimant’s address is not at the domain', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: banner() }),
      [`POST ${CLAIM_PATH}`]: () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/owner_claim_address',
            title: 'Refused.',
            status: 422,
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Become the owner' }));

    expect(
      await page().findByText('To become the owner, your main address must be at ire.events.'),
    ).toBeDefined();
  });

  it('checks the record from the card’s Check record, and says when it is not found yet', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true) }),
      [`POST ${CLAIM_PATH}/check`]: () => json({ ownerClaim: claimed(true), found: false }),
    });
    open();

    expect(await page().findByText('Your claim is open')).toBeDefined();
    expect(
      page().getByText('We check every hour until Saturday 31 Oct at 10:00 WAT.'),
    ).toBeDefined();
    fireEvent.click(page().getByRole('button', { name: 'Check record' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Become the owner' }));
    expect(
      await dialog.findByText(
        "We couldn't find the record yet. DNS changes can take up to 48 hours.",
      ),
    ).toBeDefined();
  });

  it('says Record found once the check finds it, with Withdraw my claim under the card', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true) }),
      [`POST ${CLAIM_PATH}/check`]: () => json({ ownerClaim: claimed(true, true), found: true }),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Check record' }));

    expect(await page().findByText('Record found')).toBeDefined();
    expect(page().getByText('Ownership passes on Tuesday 27 Oct at 10:00 WAT.')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Become the owner' })).toBeNull();
    expect(page().getByRole('button', { name: 'Withdraw my claim' })).toBeDefined();
  });

  it('withdraws only once it is confirmed, then offers Become the owner again', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true, true) }),
      [`POST ${CLAIM_PATH}/withdraw`]: () =>
        json({ ownerClaim: banner(), withdrawn: { told: true } }),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Withdraw my claim' }));
    const ask = within(await screen.findByRole('alertdialog', { name: 'Withdraw your claim?' }));
    fireEvent.click(ask.getByRole('button', { name: 'Withdraw' }));

    expect(await page().findByText('You withdrew your claim')).toBeDefined();
    expect(page().getByText('Everybody who was told is emailed.')).toBeDefined();
    expect(page().getByRole('button', { name: 'Become the owner' })).toBeDefined();
  });

  it('lets another Administrator stop the claim, after confirming', async () => {
    const sent = withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(false) }),
      [`POST ${CLAIM_PATH}/stop`]: () =>
        json({
          ownerClaim: banner({
            state: 'closed',
            stopped: { by: 'Folake', claimant: 'Bisi', mine: true, at: PASSES },
          }),
        }),
    });
    open();

    expect(
      await page().findByText(
        'Bisi is becoming the owner. Their DNS record has not been found yet. Without it, the claim lapses on Saturday 31 Oct at 10:00 WAT.',
      ),
    ).toBeDefined();
    fireEvent.click(page().getByRole('button', { name: 'Stop this claim' }));
    const ask = within(await screen.findByRole('alertdialog', { name: "Stop Bisi's claim?" }));
    fireEvent.click(ask.getByRole('button', { name: 'Stop the claim' }));

    expect(
      await page().findByText('Ownership has to be restored by Soirely support.'),
    ).toBeDefined();
    expect(sent.some((one) => one.line === `POST ${CLAIM_PATH}/stop`)).toBe(true);
  });

  it('asks nothing of the claim for an Owner', async () => {
    signedIn();
    const sent = answering(READS);
    open();

    expect(await page().findByText('2 people')).toBeDefined();
    expect(sent.some((one) => one.line.includes('owner-claim'))).toBe(false);
  });
});
