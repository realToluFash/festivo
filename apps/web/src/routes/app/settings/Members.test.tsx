import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { setLanguage } from '../../../i18n/index.ts';
import { holdProof } from '../../../recentProof.ts';
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

const NO_RECOVERIES = { 'GET /api/auth/recovery-requests': () => json({ requests: [] }) };

function answering(answers: Record<string, () => Response | Promise<Response>>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = { ...NO_RECOVERIES, ...answers }[line];
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

  it('wraps Remove’s whole label, its last letters held with the “…”, and leaves Suspend on one line', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/members': () => json(listWith(ACTIVE_BISI)),
      'GET /api/orgs/org_1/roles': () => json(ROLES),
    });
    open();

    await openPerson('Bisi Adeyemi');
    const remove = page().getByRole('button', { name: 'Remove from Ìrè Events…' });

    expect(remove.classList.contains('is-wraps')).toBe(true);
    expect(remove.querySelector('.desk-tied')?.textContent).toBe('ts…');
    expect(page().getByRole('button', { name: 'Suspend…' }).classList.contains('is-wraps')).toBe(
      false,
    );
  });

  it('removes only once it is confirmed, then says so on the list’s card, which takes the focus', async () => {
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
    await waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector('.members-desk .desk-said-lines')),
    );
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

function problem(code: string, status = 409, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      type: `https://soirely.com/errors/${code}`,
      title: `Refused: ${code}.`,
      status,
      ...extra,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const ADMINISTRATOR = membership({
  id: 'org_1',
  name: 'Ìrè Events',
  role: { id: 'role_4', seededAs: 'administrator', name: null },
  permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('billing')),
});

const DOMAIN_GONE = {
  reason: 'address_gone',
  domain: 'ire.events',
  since: { at: '2026-10-17T13:20:00+00:00', written: 'Saturday, Oct 17 at 14:20 WAT' },
  removesAt: { at: '2026-11-16T13:20:00+00:00', written: 'Monday, Nov 16 at 14:20 WAT' },
  onlyOwner: false,
};
const REMOVED_ON = 'If nobody answers by Monday, Nov 16 at 14:20 WAT, they are removed.';

function domainSuspended(suspension: Record<string, unknown> = {}) {
  return member({
    ...ACTIVE_BISI,
    status: 'suspended',
    channel: 'domain',
    suspension: { ...DOMAIN_GONE, ...suspension },
  });
}

/** Bisi, an Administrator, is the viewer; Folake is an owner unless told otherwise. */
function adminViewing(folake: Record<string, unknown>, others: ReturnType<typeof member>[] = []) {
  return {
    ...LIST,
    members: [
      member({ self: false, ...folake }),
      ...others,
      member({
        id: 'm_bisi',
        user: { ...BISI, email: 'bisi@ire.events' },
        role: ADMIN,
        self: true,
      }),
    ],
  };
}

const TUNDE = member({
  id: 'm_tunde',
  user: { id: 'u_tunde', name: 'Tunde Bakare', email: 'tunde@ire.events' },
  self: false,
});

describe('restoring, and what a refusal says (sc-34200)', () => {
  it('says every seat is in use, and names the plan only to an owner', async () => {
    for (const [session, way] of [
      [
        IRE,
        'To restore Bisi Adeyemi, free a seat by suspending or removing someone who no longer needs access, or change the plan.',
      ],
      [
        ADMINISTRATOR,
        'To restore Bisi Adeyemi, free a seat by suspending or removing someone who no longer needs access. Only an Owner can change the plan.',
      ],
    ] as const) {
      signedIn(session);
      answering({
        ...READS,
        'GET /api/orgs/org_1/members': () => json(listWith(SUSPENDED_BISI)),
        'POST /api/orgs/org_1/members/m_bisi/restore': () =>
          problem('team_seats_in_use', 409, { limit: 5 }),
      });
      const view = open();

      await openPerson('Bisi Adeyemi');
      fireEvent.click(page().getByRole('button', { name: 'Restore access' }));

      expect(
        await page().findByText(
          "All 5 team seats on this organisation's plan are in use, so nothing has changed.",
        ),
      ).toBeDefined();
      expect(page().getByText(way)).toBeDefined();
      expect(page().getByText('Suspended members do not take a seat.')).toBeDefined();
      expect(page().getByRole('button', { name: 'Open Members ›' })).toBeDefined();
      expect(page().queryByRole('link', { name: /Change the plan/ })).toBeNull();
      view.unmount();
      vi.restoreAllMocks();
    }
  });

  it('says why a domain member is suspended, when they go, and refuses Restore without the address', async () => {
    signedIn();
    const sent = answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(listWith(domainSuspended())),
      'POST /api/orgs/org_1/members/m_bisi/restore': () => problem('restore_needs_address'),
    });
    open();

    await openPerson('Bisi Adeyemi');
    expect(
      page().getByText("Bisi Adeyemi's ire.events address is no longer on their account."),
    ).toBeDefined();
    expect(page().getByText(REMOVED_ON)).toBeDefined();
    expect(page().queryByRole('button', { name: 'Change role' })).toBeNull();
    fireEvent.click(page().getByRole('button', { name: 'Restore' }));

    expect(
      await page().findByText('Bisi Adeyemi needs a verified ire.events address first.'),
    ).toBeDefined();
    expect(sent.map((one) => one.line)).toContain('POST /api/orgs/org_1/members/m_bisi/restore');
  });

  it('lets an administrator restore the suspended only owner, and says why Remove was refused', async () => {
    signedIn(ADMINISTRATOR);
    const sent = answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json(
          adminViewing({
            status: 'suspended',
            channel: 'domain',
            suspension: { ...DOMAIN_GONE, removesAt: null, onlyOwner: true },
          }),
        ),
      'DELETE /api/orgs/org_1/members/m_folake': () => problem('last_owner'),
      'POST /api/orgs/org_1/members/m_folake/restore': done,
    });
    open();

    await openPerson('Folake Adeyemi');
    expect(
      page().getByText(
        'Folake Adeyemi is the only owner of Ìrè Events, so they stay suspended, still an owner, and are not removed.',
      ),
    ).toBeDefined();
    expect(page().queryByText(/If nobody answers/)).toBeNull();
    fireEvent.click(page().getByRole('button', { name: /^Remove from Ìrè Events/ }));

    expect(
      await page().findByText(
        'Refused: last_owner. Folake Adeyemi is the only owner, so they cannot be removed. Restore works once their main email address is a verified ire.events address again.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(page().getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(sent.map((one) => one.line)).toContain(
        'POST /api/orgs/org_1/members/m_folake/restore',
      ),
    );
  });
});

describe('when somebody else changed their access first (sc-9549)', () => {
  const CONFLICT =
    'Someone else changed the access for Bisi Adeyemi while this page was open, so your change was not made. This is how it stands now.';

  function racing(line: string, from: ReturnType<typeof member>, to: ReturnType<typeof member>) {
    let reloaded = false;
    signedIn();
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(listWith(reloaded ? to : from)),
      [line]: () => {
        reloaded = true;
        return problem('conflict');
      },
    });
    open();
  }

  it('reloads and says why on Suspend', async () => {
    racing('POST /api/orgs/org_1/members/m_bisi/suspend', ACTIVE_BISI, SUSPENDED_BISI);

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Suspend…' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Suspend' }),
    );

    expect(await page().findByText(CONFLICT)).toBeDefined();
    expect(await page().findByRole('button', { name: 'Restore access' })).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('reloads and says why on Restore', async () => {
    racing('POST /api/orgs/org_1/members/m_bisi/restore', SUSPENDED_BISI, ACTIVE_BISI);

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Restore access' }));

    expect(await page().findByText(CONFLICT)).toBeDefined();
    expect(await page().findByRole('button', { name: 'Change role' })).toBeDefined();
  });

  it('reloads and says why when a role change meets a member suspended meanwhile', async () => {
    racing('PATCH /api/orgs/org_1/members/m_bisi', ACTIVE_BISI, SUSPENDED_BISI);

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Change role' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Bisi’s role' }));
    fireEvent.click(dialog.getByRole('radio', { name: /^Member/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

    expect(await page().findByText(CONFLICT)).toBeDefined();
    expect(await page().findByRole('button', { name: 'Restore access' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('what a person’s page lets the viewer do (sc-34200)', () => {
  const BEYOND =
    'Their role holds a permission yours does not, so you cannot change their role or their access.';
  const FINANCE = { id: 'role_9', seededAs: null, name: 'Finance' };
  const WITH_FINANCE = {
    ...ROLES,
    roles: [
      ...ROLES.roles,
      { ...role('role_9', 'custom', ['billing.manage']), seededAs: null, name: 'Finance' },
    ],
  };

  function viewingFinance(bisi: ReturnType<typeof member>, session = ADMINISTRATOR): void {
    signedIn(session);
    answering({
      'GET /api/orgs/org_1/members': () => json(listWith(member({ ...bisi, role: FINANCE }))),
      'GET /api/orgs/org_1/roles': () => json(WITH_FINANCE),
    });
    open();
  }

  it('offers nothing on a member whose role holds a permission the viewer lacks (sc-11160)', async () => {
    viewingFinance(ACTIVE_BISI);

    await openPerson('Bisi Adeyemi');
    expect(page().getByText(BEYOND)).toBeDefined();
    expect(page().queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(page().queryByRole('button', { name: 'Suspend…' })).toBeNull();
    expect(page().queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('offers no Restore on such a member once suspended', async () => {
    viewingFinance(SUSPENDED_BISI);

    await openPerson('Bisi Adeyemi');
    expect(page().getAllByText(BEYOND)).toHaveLength(1);
    expect(page().queryByRole('button', { name: /^Restore/ })).toBeNull();
    expect(page().queryByText(/Restore access returns them/)).toBeNull();
  });

  it('lets an owner change the same member', async () => {
    viewingFinance(ACTIVE_BISI, IRE);

    await openPerson('Bisi Adeyemi');
    expect(page().queryByText(BEYOND)).toBeNull();
    expect(page().getByRole('button', { name: 'Change role' })).toBeDefined();
  });

  it('says the only owner can be neither changed nor removed, nor suspended', async () => {
    signedIn(ADMINISTRATOR);
    answering({ ...READS, 'GET /api/orgs/org_1/members': () => json(adminViewing({})) });
    open();

    await openPerson('Folake Adeyemi');
    expect(page().getByText(/^Folake Adeyemi is the only owner\. /)).toBeDefined();
    expect(
      page().getByText('Only an owner can make somebody else an owner. Ask Folake Adeyemi.'),
    ).toBeDefined();
    expect(
      page().getByText(
        'Owners cannot be suspended. To suspend Folake Adeyemi, change their role first.',
      ),
    ).toBeDefined();
    expect(page().queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(page().queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('tells an administrator why an owner beside another owner offers nothing', async () => {
    signedIn(ADMINISTRATOR);
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(adminViewing({}, [TUNDE])),
    });
    open();

    await openPerson('Folake Adeyemi');
    expect(
      page().getAllByText("Only an owner can change an owner's role or remove them."),
    ).toHaveLength(1);
    expect(page().queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(page().queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('shows a suspended owner beside another owner read-only, removal date included', async () => {
    signedIn(ADMINISTRATOR);
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () =>
        json(
          adminViewing({ status: 'suspended', channel: 'domain', suspension: DOMAIN_GONE }, [
            TUNDE,
          ]),
        ),
    });
    open();

    await openPerson('Folake Adeyemi');
    expect(
      page().getByText("Folake Adeyemi's ire.events address is no longer on their account."),
    ).toBeDefined();
    expect(page().getByText(REMOVED_ON)).toBeDefined();
    expect(page().queryByRole('button', { name: /^Restore/ })).toBeNull();
    expect(page().queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('shows a domain suspension read-only to a viewer who cannot manage members', async () => {
    signedIn(membership({ id: 'org_1', name: 'Ìrè Events', permissions: ['members.read'] }));
    answering({
      ...READS,
      'GET /api/orgs/org_1/members': () => json(listWith(domainSuspended())),
    });
    open();

    await openPerson('Bisi Adeyemi');
    expect(page().getByText(REMOVED_ON)).toBeDefined();
    expect(page().queryByRole('button', { name: /^Restore/ })).toBeNull();
    expect(page().queryByRole('button', { name: /^Remove/ })).toBeNull();
  });
});

describe('the dates the server wrote, after a language change (sc-9267)', () => {
  const WRITTEN: Record<string, { asked: string; suspended: string }> = {
    en: { asked: 'Wednesday, Nov 11 at 09:40 WAT', suspended: 'Monday, Nov 16 at 14:20 WAT' },
    es: { asked: 'miércoles, 11 nov a las 09:40 WAT', suspended: 'lunes, 16 nov a las 14:20 WAT' },
  };

  afterEach(async () => {
    await act(() => setLanguage(null));
  });

  function listIn(language: string): Response {
    const written = WRITTEN[language] ?? { asked: '', suspended: '' };
    const removes = { at: '2026-11-16T13:20:00+00:00', written: written.suspended };

    return json({
      ...LIST,
      members: [
        LIST.members[0],
        domainSuspended({ since: removes, removesAt: removes }),
        { ...ADA, removesAt: { at: '2026-11-11T08:40:00+00:00', written: written.asked } },
      ],
    });
  }

  function answeringIn(spanish: () => Promise<Response> = async () => listIn('es')): string[] {
    const asked: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/orgs/org_1/roles') return json(ROLES);
      if (path === '/api/auth/recovery-requests') return json({ requests: [] });
      if (path !== '/api/orgs/org_1/members') return new Response(null, { status: 500 });

      const language = new Headers(init?.headers).get('Accept-Language') ?? '';
      asked.push(language);

      return language === 'es' ? spanish() : listIn(language);
    });

    return asked;
  }

  it('asks for the list again in the picked language, without a reload', async () => {
    signedIn();
    const asked = answeringIn();
    open();
    expect(
      await page().findByText('Removed on Wednesday, Nov 11 at 09:40 WAT if nobody answers.'),
    ).toBeDefined();

    await act(() => setLanguage('es'));

    expect(await page().findByText(/miércoles, 11 nov a las 09:40 WAT/)).toBeDefined();
    expect(asked).toEqual(['en', 'es']);

    fireEvent.click(page().getByRole('button', { name: /^Bisi Adeyemi/ }));
    expect(
      await page().findByText(
        'Si nadie responde antes del lunes, 16 nov a las 14:20 WAT, se quitará a esta persona de la organización.',
      ),
    ).toBeDefined();
  });

  it('keeps the dates it had after a failed ask, with no error', async () => {
    signedIn();
    const asked = answeringIn(async () => new Response(null, { status: 500 }));
    open();
    await openPerson('Bisi Adeyemi');
    expect(page().getByText(REMOVED_ON)).toBeDefined();

    await act(() => setLanguage('es'));
    await waitFor(() => expect(asked).toEqual(['en', 'es']));
    await act(async () => {});

    expect(
      page().getByText(
        'Si nadie responde antes del Monday, Nov 16 at 14:20 WAT, se quitará a esta persona de la organización.',
      ),
    ).toBeDefined();
    expect(page().queryByRole('alert')).toBeNull();
  });
});

describe('making somebody an owner asks for a recent proof (sc-18930)', () => {
  const ME = {
    id: 'u_folake',
    name: 'Folake Adeyemi',
    businessName: null,
    countryCode: null,
    organisationCountry: 'NG',
    locale: 'en',
    timezone: 'Africa/Lagos',
    waitingFor: null,
    verified: true,
    complete: true,
    needsOrganisation: false,
    hasPassword: true,
    providers: [],
    emailAddresses: [{ id: 'e1', address: 'folake@ire.events', verified: true, primary: true }],
    phoneNumbers: [],
  };
  const PROVING = {
    'GET /api/auth/me': () => json(ME),
    'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
    'POST /api/auth/proof': () =>
      json({ proof: 'p-1', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
  };
  const INTRO =
    "To make somebody an owner of Ìrè Events, confirm it's you. You won't be asked again for 5 minutes.";
  const SENT = () =>
    json(
      {
        invitation: { ...LIST.invitations[0], id: 'inv_3', email: 'kemi@ire.events', role: OWNER },
      },
      201,
    );
  const INVITED = 'Invitation sent to kemi@ire.events';
  const RETURNED = 'soirely.provider.returned';

  async function inviteAsOwner() {
    fireEvent.click(await page().findByRole('button', { name: 'Invite somebody' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Invite somebody' }));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'kemi@ire.events' },
    });
    fireEvent.click(dialog.getByRole('radio', { name: /^Owner/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
  }

  function prove(): void {
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'a decent passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }

  function inviteSent(sent: { line: string; body: unknown }[]) {
    return sent.find((one) => one.line === 'POST /api/orgs/org_1/members/invite')?.body;
  }

  it('confirms it is you before an Owner invitation is sent, then sends it with no second press', async () => {
    signedIn();
    const sent = answering({ ...READS, ...PROVING, 'POST /api/orgs/org_1/members/invite': SENT });
    open();

    await inviteAsOwner();
    expect(await screen.findByText(INTRO)).toBeDefined();
    expect(inviteSent(sent)).toBeUndefined();
    prove();

    expect(await page().findByText(INVITED)).toBeDefined();
    expect(inviteSent(sent)).toEqual({ email: 'kemi@ire.events', roleId: 'role_1', proof: 'p-1' });
  });

  it('returns to the form as it was on Cancel, with nothing sent', async () => {
    signedIn();
    const sent = answering({ ...READS, ...PROVING });
    open();

    await inviteAsOwner();
    await screen.findByText(INTRO);
    // The dialog's own Cancel heads it; Confirm it's you's Cancel closes the form it adds.
    const cancels = screen.getAllByRole('button', { name: 'Cancel' });
    expect(cancels).toHaveLength(2);
    fireEvent.click(cancels[1] as HTMLElement);

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('kemi@ire.events');
    expect((screen.getByRole('radio', { name: /^Owner/ }) as HTMLInputElement).checked).toBe(true);
    expect(sent.some((one) => one.line.startsWith('POST /api/orgs'))).toBe(false);
  });

  it('asks nothing more while the proof this tab holds stands', async () => {
    holdProof({ proof: 'held', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    signedIn();
    const sent = answering({ ...READS, 'POST /api/orgs/org_1/members/invite': SENT });
    open();

    await inviteAsOwner();

    expect(await page().findByText(INVITED)).toBeDefined();
    expect(inviteSent(sent)).toEqual({ email: 'kemi@ire.events', roleId: 'role_1', proof: 'held' });
  });

  it('asks again when the API finds the held invitation proof has lapsed', async () => {
    holdProof({ proof: 'stale', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    signedIn();
    answering({
      ...READS,
      ...PROVING,
      'POST /api/orgs/org_1/members/invite': () => problem('proof_required', 403),
    });
    open();

    await inviteAsOwner();

    expect(await screen.findByText(INTRO)).toBeDefined();
  });

  it('asks again on a role change to Owner whose held proof has lapsed, then saves it', async () => {
    holdProof({ proof: 'stale', expiresAt: new Date(Date.now() + 300_000).toISOString() });
    signedIn();
    let lapsed = true;
    const sent = answering({
      ...READS,
      ...PROVING,
      'GET /api/orgs/org_1/members': () => json(listWith(ACTIVE_BISI)),
      'PATCH /api/orgs/org_1/members/m_bisi': () => {
        if (!lapsed) return done();
        lapsed = false;
        return problem('proof_required', 403);
      },
    });
    open();

    await openPerson('Bisi Adeyemi');
    fireEvent.click(page().getByRole('button', { name: 'Change role' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Bisi’s role' }));
    fireEvent.click(dialog.getByRole('radio', { name: /^Owner/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(INTRO)).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Make Bisi an owner' })).toBeDefined();
    prove();

    await waitFor(() =>
      expect(
        sent.filter((one) => one.line === 'PATCH /api/orgs/org_1/members/m_bisi').at(-1)?.body,
      ).toEqual({ roleId: 'role_1', proof: 'p-1' }),
    );
  });

  it('finishes the invitation the dialog held, back from Google', async () => {
    sessionStorage.setItem(
      RETURNED,
      JSON.stringify({
        provider: 'google',
        purpose: {
          kind: 'makeOwner',
          roleId: 'role_1',
          to: { email: 'kemi@ire.events', again: null },
        },
        signIn: { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' },
      }),
    );
    signedIn();
    const sent = answering({ ...READS, ...PROVING, 'POST /api/orgs/org_1/members/invite': SENT });
    open();

    expect(await page().findByText(INVITED)).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/auth/proof')?.body).toEqual(
      expect.objectContaining({ provider: 'google' }),
    );
    expect(inviteSent(sent)).toEqual({ email: 'kemi@ire.events', roleId: 'role_1', proof: 'p-1' });
    expect(sessionStorage.getItem(RETURNED)).toBeNull();
  });

  it('finishes the role change the person’s page held, back from Google', async () => {
    sessionStorage.setItem(
      RETURNED,
      JSON.stringify({
        provider: 'google',
        purpose: { kind: 'makeOwner', roleId: 'role_1', to: { member: 'm_bisi' } },
        signIn: { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' },
      }),
    );
    signedIn();
    const sent = answering({
      ...READS,
      ...PROVING,
      'GET /api/orgs/org_1/members': () => json(listWith(ACTIVE_BISI)),
      'PATCH /api/orgs/org_1/members/m_bisi': done,
    });
    open();

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'PATCH /api/orgs/org_1/members/m_bisi')?.body).toEqual(
        { roleId: 'role_1', proof: 'p-1' },
      ),
    );
    expect(sent.filter((one) => one.line === 'POST /api/auth/proof')).toHaveLength(1);
    expect(sessionStorage.getItem(RETURNED)).toBeNull();
  });
});

describe('offline (sc-22586)', () => {
  it('refuses an invitation pressed offline with its own words, and keeps the address', async () => {
    signedIn();
    let reachable = true;
    const sent = answering({
      'GET /api/orgs/org_1/members': () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return json(LIST);
      },
      'GET /api/orgs/org_1/roles': () => json(ROLES),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Invite somebody' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Invite somebody' }));
    reachable = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    fireEvent.change(dialog.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'amara.o@gmail.com' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));

    expect(
      await dialog.findByText(
        'We could not send the invitation. Check your connection and try again.',
      ),
    ).toBeDefined();
    expect((dialog.getByRole('textbox', { name: 'Email' }) as HTMLInputElement).value).toBe(
      'amara.o@gmail.com',
    );

    reachable = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => {});
    expect(sent.filter((one) => one.line === 'POST /api/orgs/org_1/members/invite')).toHaveLength(
      1,
    );
  });
});

describe('what the claim says when it is refused (sc-34200, sc-6640)', () => {
  it('loads the claim again when another Administrator’s started first', async () => {
    let started = false;
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: started ? claimed(false) : banner() }),
      [`POST ${CLAIM_PATH}`]: () => {
        started = true;
        return problem('owner_claim_open');
      },
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Become the owner' }));

    expect(await page().findByText(/^Bisi is becoming the owner\./)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(page().getByRole('button', { name: 'Stop this claim' })).toBeDefined();
  });

  it('says so when the claim ended before the stop arrived', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(false) }),
      [`POST ${CLAIM_PATH}/stop`]: () => problem('owner_claim_ended'),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Stop this claim' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Stop the claim',
      }),
    );

    expect(
      await page().findByText('This claim has already ended, so there was nothing to stop.'),
    ).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('says so when the claim ended before the withdrawal arrived', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true, true) }),
      [`POST ${CLAIM_PATH}/withdraw`]: () => problem('owner_claim_ended'),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Withdraw my claim' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Withdraw' }),
    );

    expect(await page().findByText('This claim has already ended.')).toBeDefined();
  });

  it('says only the claimant can withdraw, when the API refuses it', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true, true) }),
      [`POST ${CLAIM_PATH}/withdraw`]: () => problem('forbidden', 403),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Withdraw my claim' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Withdraw' }),
    );

    expect(
      await page().findByText('Only the person who started this claim can withdraw it.'),
    ).toBeDefined();
  });

  it('keeps the ask open and says so when the withdrawal fails', async () => {
    withClaim({
      [`GET ${CLAIM_PATH}`]: () => json({ ownerClaim: claimed(true, true) }),
      [`POST ${CLAIM_PATH}/withdraw`]: () => problem('internal', 500),
    });
    open();

    fireEvent.click(await page().findByRole('button', { name: 'Withdraw my claim' }));
    const ask = within(await screen.findByRole('alertdialog'));
    fireEvent.click(ask.getByRole('button', { name: 'Withdraw' }));

    expect(await ask.findByText('That did not work. Please try again.')).toBeDefined();
    expect(page().getByText('Record found')).toBeDefined();
  });
});

describe('requests to get back in on Members (sc-30189)', () => {
  const asker = (id: string, name: string) =>
    member({
      id: `m_${id}`,
      user: { id: `u_${id}`, name, email: `${id}@ire.events` },
      role: { id: 'role_5', seededAs: 'member', name: null },
      channel: 'invitation',
      self: false,
    });
  const RECOVERY_LIST = {
    ...WAITING,
    members: [...WAITING.members, asker('kofi', 'Kofi Mensah'), asker('priya', 'Priya Shah')],
  };
  const request = (id: string, name: string, more: Record<string, unknown> = {}) => ({
    id: `rq_${id}`,
    userId: `u_${id}`,
    name,
    email: `${id}@ire.events`,
    provedPhone: true,
    own: false,
    organisations: ['Ìrè Events'],
    organisationIds: ['org_1'],
    askedAt: '2026-11-03T12:05:00+00:00',
    asked: 'Tuesday 3 Nov at 13:05 WAT',
    expiresAt: '2026-11-10T12:05:00+00:00',
    expires: 'Tuesday 10 Nov at 13:05 WAT',
    ...more,
  });
  const KOFI = request('kofi', 'Kofi Mensah');
  const PRIYA = request('priya', 'Priya Shah', {
    provedPhone: false,
    askedAt: '2026-11-04T08:40:00+00:00',
  });
  const ELSEWHERE = request('tunde', 'Tunde Bello', { organisationIds: ['org_2'] });
  const reads = (requests: unknown[] = [KOFI, PRIYA, ELSEWHERE]) => ({
    'GET /api/orgs/org_1/members': () => json(RECOVERY_LIST),
    'GET /api/orgs/org_1/roles': () => json(ROLES),
    'GET /api/auth/recovery-requests': () => json({ requests }),
  });
  const requestOf = (name: string) =>
    within(page().getByRole('article', { name: new RegExp(`^${name}`) }));
  const answerOf = async (name: string, action: string) =>
    within(await page().findByRole('article', { name: new RegExp(`^${name}`) })).getByRole(
      'button',
      { name: action },
    );
  const cardSays = () => document.querySelector<HTMLElement>('.members-desk .desk-said-lines');

  it('lists this organisation’s requests above Waiting, counts them on the card, and steps to the oldest', async () => {
    signedIn();
    answering(reads());
    open();

    expect(await page().findByText('4 people · 3 waiting')).toBeDefined();
    expect(page().getByText('2 to get back in · 1 to join')).toBeDefined();
    expect(
      page()
        .getAllByRole('heading')
        .map((one) => one.textContent),
    ).toEqual(['Members', 'Requests to get back in', 'Waiting', 'People', 'Invitations']);
    expect(
      page()
        .getAllByRole('article')
        .map((one) => one.id),
    ).toEqual(['request-rq_kofi', 'request-rq_priya']);
    expect(page().queryByText('Tunde Bello')).toBeNull();

    const kofi = requestOf('Kofi Mensah');
    expect(kofi.getByText('Waiting for an answer')).toBeDefined();
    expect(
      kofi.getByText('Asked to turn off two-factor · Proved with codes to their email and phone'),
    ).toBeDefined();
    expect(kofi.getByText('kofi@ire.events')).toBeDefined();
    expect(
      kofi.getByText(/^Asked Tuesday, Nov 3 at \d\d:\d\d · ends Tuesday, Nov 10 at \d\d:\d\d/),
    ).toBeDefined();
    expect(
      requestOf('Priya Shah').getByText(
        'Asked to turn off two-factor · Proved with a code to their email (no verified phone)',
      ),
    ).toBeDefined();
    expect(
      page().getByText(
        'Only owners and admins see this. A request leaves it once somebody answers or it ends.',
      ),
    ).toBeDefined();

    fireEvent.click(page().getByRole('button', { name: 'Answer Kofi Mensah' }));

    const lit = document.getElementById('request-rq_kofi');
    await waitFor(() => expect(document.activeElement).toBe(lit));
    expect(lit?.classList.contains('is-on')).toBe(true);
  });

  it('approves only once confirmed, says so on the card, and steps on to the next request', async () => {
    signedIn();
    const sent = answering({
      ...reads(),
      'POST /api/auth/recovery-requests/rq_kofi/approve': done,
    });
    open();

    fireEvent.click(await answerOf('Kofi Mensah', 'Approve'));
    const ask = within(
      await screen.findByRole('alertdialog', {
        name: 'Approve, and turn off Kofi Mensah’s two-factor?',
      }),
    );
    expect(ask.getAllByRole('button').map((one) => one.textContent)).toEqual([
      'Cancel',
      'Turn off two-factor',
    ]);
    expect(sent.some((one) => one.line.endsWith('/approve'))).toBe(false);

    fireEvent.click(ask.getByRole('button', { name: 'Turn off two-factor' }));

    expect(await page().findByText('Kofi Mensah’s two-factor is off.')).toBeDefined();
    expect(
      page().getByText('They’re emailed now, and every session they had has ended.'),
    ).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(page().queryByRole('article', { name: /^Kofi Mensah/ })).toBeNull();
    expect(page().getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(cardSays()));
  });

  it('turns a request down, and Keep the request goes back to Turn down with nothing sent', async () => {
    signedIn();
    const sent = answering({
      ...reads(),
      'POST /api/auth/recovery-requests/rq_kofi/turn-down': done,
    });
    open();

    fireEvent.click(await answerOf('Kofi Mensah', 'Turn down'));
    const asked = await screen.findByRole('alertdialog', {
      name: 'Turn down Kofi Mensah’s request?',
    });
    fireEvent.click(within(asked).getByRole('button', { name: 'Keep the request' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        requestOf('Kofi Mensah').getByRole('button', { name: 'Turn down' }),
      ),
    );
    expect(sent.some((one) => one.line.endsWith('/turn-down'))).toBe(false);

    fireEvent.click(requestOf('Kofi Mensah').getByRole('button', { name: 'Turn down' }));
    const again = await screen.findByRole('alertdialog', {
      name: 'Turn down Kofi Mensah’s request?',
    });
    fireEvent.click(within(again).getByRole('button', { name: 'Turn down the request' }));

    expect(await page().findByText('Kofi Mensah’s request is turned down.')).toBeDefined();
    expect(page().getByText('Two-factor stays on for them, and they’re emailed.')).toBeDefined();
  });

  it.each([
    ['closed', () => problem('recovery_request_closed', 409)],
    ['no longer theirs', () => problem('not_found', 404)],
  ])('says a request %s has already been answered, with Close alone', async (_, refusal) => {
    signedIn();
    answering({ ...reads(), 'POST /api/auth/recovery-requests/rq_kofi/approve': refusal });
    open();

    fireEvent.click(await answerOf('Kofi Mensah', 'Approve'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Turn off two-factor',
      }),
    );

    expect(
      await screen.findByText('This request has already been answered, or it has ended.'),
    ).toBeDefined();
    const ask = within(screen.getByRole('alertdialog'));
    expect(ask.getAllByRole('button').map((one) => one.textContent)).toEqual(['Close']);
    fireEvent.click(ask.getByRole('button', { name: 'Close' }));

    expect(page().queryByRole('article', { name: /^Kofi Mensah/ })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('request-rq_priya')),
    );
  });

  it('closes on the last request’s Close with the focus on the card’s words', async () => {
    signedIn();
    answering({
      ...reads([KOFI]),
      'POST /api/auth/recovery-requests/rq_kofi/approve': () =>
        problem('recovery_request_closed', 409),
    });
    open();

    fireEvent.click(await answerOf('Kofi Mensah', 'Approve'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Turn off two-factor',
      }),
    );
    await screen.findByText('This request has already been answered, or it has ended.');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close' }));

    expect(page().queryByRole('article')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(cardSays()));
  });

  it('waits out Escape while the answer is sending', async () => {
    signedIn();
    let reply: (answer: Response) => void = () => undefined;
    answering({
      ...reads(),
      'POST /api/auth/recovery-requests/rq_kofi/approve': () =>
        new Promise<Response>((resolve) => {
          reply = resolve;
        }),
    });
    open();

    fireEvent.click(await answerOf('Kofi Mensah', 'Approve'));
    const ask = within(await screen.findByRole('alertdialog'));
    fireEvent.click(ask.getByRole('button', { name: 'Turn off two-factor' }));
    expect(await ask.findByText('Sending your answer…')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('alertdialog')).toBeDefined();
    reply(done());
    expect(await page().findByText('Kofi Mensah’s two-factor is off.')).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it.each([
    ['no connection', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 5xx', () => problem('server_error', 500)],
  ])('keeps the confirm open on %s, and its verb tries again', async (_, failure) => {
    signedIn();
    let fails = true;
    answering({
      ...reads(),
      'POST /api/auth/recovery-requests/rq_kofi/approve': () => (fails ? failure() : done()),
    });
    open();

    fireEvent.click(await answerOf('Kofi Mensah', 'Approve'));
    const ask = within(await screen.findByRole('alertdialog'));
    fireEvent.click(ask.getByRole('button', { name: 'Turn off two-factor' }));

    expect(await ask.findByText('That did not work. Try again in a moment.')).toBeDefined();
    fails = false;
    fireEvent.click(ask.getByRole('button', { name: 'Turn off two-factor' }));

    expect(await page().findByText('Kofi Mensah’s two-factor is off.')).toBeDefined();
  });

  it('shows your own request with who has to answer it, and never counts or steps to it', async () => {
    signedIn();
    answering(
      reads([
        request('folake', 'Folake Adeyemi', {
          own: true,
          organisations: ['Ìrè Events', 'Ìrè Weddings'],
        }),
      ]),
    );
    open();

    expect(await page().findByText('Folake Adeyemi (you)')).toBeDefined();
    expect(
      page().getByText(
        'This is your own request. Somebody else in Ìrè Events and Ìrè Weddings has to answer it.',
      ),
    ).toBeDefined();
    expect(
      page().getByText('Asked to turn off two-factor · Proved with codes to your email and phone'),
    ).toBeDefined();
    expect(page().queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(page().getByText('4 people · 1 waiting')).toBeDefined();
    expect(page().getByRole('button', { name: 'Answer Ada Okeke' })).toBeDefined();
  });

  it('writes its dates in the page’s language', async () => {
    signedIn();
    answering(reads());
    open();
    await page().findByRole('article', { name: /^Kofi Mensah/ });

    await act(() => setLanguage('fr'));

    expect(await requestOf('Kofi Mensah').findByText(/mardi 3 nov/)).toBeDefined();
    await act(() => setLanguage(null));
  });

  it('leaves nothing of the list once none waits', async () => {
    signedIn();
    answering(reads([]));
    open();

    expect(await page().findByText('4 people · 1 waiting')).toBeDefined();
    expect(page().queryByText('Requests to get back in')).toBeNull();
  });

  it('takes a removed member’s request off the list', async () => {
    signedIn();
    answering({ ...reads(), 'DELETE /api/orgs/org_1/members/m_kofi': done });
    open();

    await openPerson('Kofi Mensah');
    fireEvent.click(page().getByRole('button', { name: 'Remove from Ìrè Events…' }));
    const ask = within(
      await screen.findByRole('alertdialog', { name: 'Remove Kofi Mensah from Ìrè Events?' }),
    );
    fireEvent.click(ask.getByRole('button', { name: 'Remove' }));

    expect(await page().findByText('Kofi Mensah was removed')).toBeDefined();
    expect(page().queryByRole('article', { name: /^Kofi Mensah/ })).toBeNull();
    expect(page().getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
  });

  it('shows Members’ failed state when the requests do not load, and Try again loads both', async () => {
    signedIn();
    let fails = true;
    const sent = answering({
      ...reads(),
      'GET /api/auth/recovery-requests': () => {
        if (fails) throw new TypeError('Failed to fetch');
        return json({ requests: [KOFI] });
      },
    });
    open();

    expect(await page().findByText('We could not load the members.')).toBeDefined();
    fails = false;
    fireEvent.click(page().getByRole('button', { name: 'Try again' }));

    expect(await page().findByRole('article', { name: /^Kofi Mensah/ })).toBeDefined();
    expect(sent.filter((one) => one.line === 'GET /api/auth/recovery-requests')).toHaveLength(2);
  });

  it('never asks for requests for a viewer who cannot manage members', async () => {
    signedIn(
      membership({ id: 'org_1', name: 'Ìrè Events', permissions: ['members.read', 'events.read'] }),
    );
    const sent = answering(reads());
    open();

    expect(await page().findByText('4 people')).toBeDefined();
    expect(page().queryByText('Requests to get back in')).toBeNull();
    expect(sent.some((one) => one.line === 'GET /api/auth/recovery-requests')).toBe(false);
  });
});
