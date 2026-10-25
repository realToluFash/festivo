import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const AREAS = [
  'events',
  'guests',
  'seating',
  'menu',
  'run_of_show',
  'staff',
  'messages',
  'reports',
  'budget',
  'vendors',
  'members',
  'billing',
  'organisation',
].map((area) => ({
  area,
  permissions: OWNER_PERMISSIONS.filter((permission) => permission.startsWith(`${area}.`)),
}));

function role(
  id: string,
  seededAs: string | null,
  name: string | null,
  permissions: string[],
  holders = 0,
  holderNames = Array.from({ length: holders }, (_, n) => ({
    name: `Holder ${n + 1}`,
    suspended: false,
  })),
) {
  return {
    id,
    seededAs,
    name,
    fixed: seededAs === 'owner',
    removable: seededAs == null,
    permissions,
    holders,
    holderNames,
  };
}

const DOOR_TEAM = [
  'Ada Okeke',
  'bisi Ade',
  'Chidi Eze',
  'Émeka Obi',
  'Funmi Bello',
  'Kemi Lawal',
  'Tope Alade',
].map((name) => ({ name, suspended: name === 'Émeka Obi' }));

const ROLES = [
  role('role_1', 'owner', null, OWNER_PERMISSIONS, 1),
  role(
    'role_2',
    'administrator',
    null,
    OWNER_PERMISSIONS.filter((p) => p !== 'billing.manage'),
    1,
  ),
  role(
    'role_3',
    'event_manager',
    null,
    ['events.read', 'events.manage', 'events.create', 'budget.read', 'budget.manage'],
    1,
  ),
  role('role_4', 'coordinator', null, ['events.read', 'events.manage', 'budget.read'], 2),
  role('role_5', 'read_only', null, ['events.read', 'budget.read']),
  role('role_6', null, 'Door team', ['events.read', 'guests.read'], 7, DOOR_TEAM),
];

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

function answering(answer: (method: string, body: unknown) => Response | null = () => null) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ method, path: new URL(String(input)).pathname, body });

    return (
      answer(method, body) ??
      new Response(JSON.stringify({ roles: ROLES, areas: AREAS }), { status: 200 })
    );
  });

  return sent;
}

async function roles(): Promise<void> {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/settings/roles'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Roles' });
}

function nameTaken(): Response {
  return new Response(
    JSON.stringify({
      type: 'https://soirely.com/errors/validation_failed',
      title: 'No.',
      status: 422,
      violations: [
        {
          propertyPath: 'name',
          message: 'A role with that name already exists.',
          code: 'role_name_taken',
        },
      ],
    }),
    { status: 422 },
  );
}

function pick(name: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

function level(area: string, choice: string): HTMLElement {
  return within(screen.getByRole('group', { name: area })).getByRole('button', { name: choice });
}

beforeEach(() => signedIn());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings > Roles', () => {
  it('lists the five seeded roles and the custom one, with how many hold each', async () => {
    answering();
    await roles();

    for (const name of [
      'Owner',
      'Administrator',
      'Event manager',
      'Coordinator',
      'Read-only',
      'Door team',
    ])
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Coordinator.*2 people/ })).toBeDefined();
  });

  it('names the open role’s first five holders, and the rest once asked', async () => {
    answering();
    await roles();

    pick(/^Door team/);

    const who = screen.getByText('Who has this role').parentElement as HTMLElement;
    expect(within(who).getByText('7 people')).toBeDefined();
    expect(
      within(who)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Ada Okeke',
      'bisi Ade',
      'Chidi Eze',
      'Émeka ObiSuspended',
      'Funmi Bello',
      'and 2 more',
    ]);
    expect(screen.getByRole('button', { name: /^Door team/ }).textContent).not.toMatch(/Ada/);

    fireEvent.click(within(who).getByRole('button', { name: 'and 2 more' }));

    expect(document.activeElement?.textContent).toBe('Kemi Lawal');
    expect(
      within(who)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Ada Okeke',
      'bisi Ade',
      'Chidi Eze',
      'Émeka ObiSuspended',
      'Funmi Bello',
      'Kemi Lawal',
      'Tope Alade',
    ]);
    expect(within(who).queryByRole('button')).toBeNull();
  });

  it('names nobody on a role nobody holds, and every holder of five without "and N more"', async () => {
    answering((method) =>
      method === 'GET'
        ? new Response(
            JSON.stringify({
              roles: ROLES.map((one) =>
                one.id === 'role_4'
                  ? { ...one, holders: 5, holderNames: DOOR_TEAM.slice(0, 5) }
                  : one,
              ),
              areas: AREAS,
            }),
            { status: 200 },
          )
        : null,
    );
    await roles();

    pick(/^Read-only/);
    const who = () => screen.getByText('Who has this role').parentElement as HTMLElement;
    expect(within(who()).getByText('Nobody yet.')).toBeDefined();
    expect(within(who()).queryByRole('list')).toBeNull();

    pick(/^Coordinator/);
    expect(within(who()).getAllByRole('listitem')).toHaveLength(5);
    expect(within(who()).queryByRole('button')).toBeNull();
  });

  it('shows Owner with everything and no control to change it', async () => {
    answering();
    await roles();

    pick(/^Owner/);

    expect(screen.getByText(/Owner is built in and can't be edited or removed/)).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Events' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove role' })).toBeNull();
  });

  it('saves a seeded role’s new grant, and says who gets it', async () => {
    const sent = answering((method, body) =>
      method === 'PATCH'
        ? new Response(JSON.stringify({ ...ROLES[3], ...(body as object) }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^Coordinator/);

    fireEvent.click(level('Billing', 'Read'));

    expect(screen.getByText(/Unsaved changes to Coordinator\. 2 people get them/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save Coordinator' }));

    await screen.findByText("Saved. Applies on each person's next request.");
    const patch = sent.find((request) => request.method === 'PATCH');
    expect(patch?.path).toBe('/api/orgs/org_1/roles/role_4');
    expect((patch?.body as { permissions: string[] }).permissions.sort()).toEqual(
      ['billing.read', 'budget.read', 'events.manage', 'events.read'].sort(),
    );
  });

  it('shows the margin only beside a budget the role can open, hidden unless given', async () => {
    answering();
    await roles();
    pick(/^Event manager/);

    expect(level('Margin', 'Hidden').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/The budget opens with costs only, no margin\./)).toBeDefined();

    fireEvent.click(level('Budget', 'Nothing'));

    expect(screen.queryByRole('group', { name: 'Margin' })).toBeNull();
  });

  it('offers Remove only on a custom role, and moves its people before removing it', async () => {
    const sent = answering((method) =>
      method === 'DELETE' ? new Response(null, { status: 204 }) : null,
    );
    await roles();
    pick(/^Coordinator/);
    expect(screen.queryByRole('button', { name: 'Remove role' })).toBeNull();

    pick(/^Door team/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move them and remove Door team' }));

    expect(screen.getByText('Choose the role these people move to.')).toBeDefined();
    expect(sent.some((request) => request.method === 'DELETE')).toBe(false);
    expect(screen.getByLabelText(/^Owner/)).toBeDefined();

    fireEvent.click(screen.getByLabelText(/^Read-only/));
    fireEvent.click(screen.getByRole('button', { name: 'Move them and remove Door team' }));

    await waitFor(() =>
      expect(sent.find((request) => request.method === 'DELETE')).toEqual({
        method: 'DELETE',
        path: '/api/orgs/org_1/roles/role_6',
        body: { replacement: 'role_5' },
      }),
    );
  });

  it('names the people a removed role moved onto its replacement, without a reload', async () => {
    let removed = false;
    answering((method) => {
      if (method === 'DELETE') {
        removed = true;
        return new Response(null, { status: 204 });
      }

      return removed
        ? new Response(
            JSON.stringify({
              roles: ROLES.filter((one) => one.id !== 'role_6').map((one) =>
                one.id === 'role_5' ? { ...one, holders: 7, holderNames: DOOR_TEAM } : one,
              ),
              areas: AREAS,
            }),
            { status: 200 },
          )
        : null;
    });
    await roles();
    pick(/^Door team/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));
    fireEvent.click(screen.getByLabelText(/^Read-only/));
    fireEvent.click(screen.getByRole('button', { name: 'Move them and remove Door team' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Door team/ })).toBeNull());
    pick(/^Read-only/);

    const who = screen.getByText('Who has this role').parentElement as HTMLElement;
    expect(within(who).getByText('7 people')).toBeDefined();
    expect(within(who).getByText('Ada Okeke')).toBeDefined();
    expect(within(who).getByRole('button', { name: 'and 2 more' })).toBeDefined();
  });

  it('checks a new role’s name before sending, and says the server’s refusal under it', async () => {
    const sent = answering((method) => (method === 'POST' ? nameTaken() : null));
    await roles();
    fireEvent.click(screen.getByRole('button', { name: 'New role' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(screen.getByText('Give the role a name.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'door TEAM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(screen.getByText('A role with that name already exists.')).toBeDefined();
    expect(sent.some((request) => request.method === 'POST')).toBe(false);

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Venue lead' } });
    fireEvent.click(level('Events', 'Read'));
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));

    await screen.findByText('A role with that name already exists.');
    expect(sent.find((request) => request.method === 'POST')?.body).toEqual({
      name: 'Venue lead',
      permissions: ['events.read'],
    });
  });

  it('renames a custom role with its permissions in one save, under its old name until it lands', async () => {
    const sent = answering((method, body) =>
      method === 'PATCH'
        ? new Response(JSON.stringify({ ...ROLES[5], ...(body as object) }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^Door team/);

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: ' Door crew ' } });
    fireEvent.click(level('Seating', 'Read'));

    expect(screen.getByText(/Unsaved changes to Door team\. 7 people get them/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save Door team' }));

    await screen.findByText("Saved. Applies on each person's next request.");
    const patch = sent.find((request) => request.method === 'PATCH');
    expect(patch?.path).toBe('/api/orgs/org_1/roles/role_6');
    expect(patch?.body).toEqual({
      name: 'Door crew',
      permissions: ['events.read', 'guests.read', 'seating.read'],
    });
    expect(screen.getByRole('button', { name: /^Door crew/ })).toBeDefined();
    expect((screen.getByLabelText('Role name') as HTMLInputElement).value).toBe('Door crew');
  });

  it('refuses another role’s name in any case, keeping the edit and moving focus to the name', async () => {
    const sent = answering((method) => (method === 'PATCH' ? nameTaken() : null));
    await roles();
    pick(/^Door team/);
    fireEvent.click(level('Seating', 'Read'));

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'coordinator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Door team' }));

    expect(screen.getByText('A role with that name already exists.')).toBeDefined();
    expect(sent.some((request) => request.method === 'PATCH')).toBe(false);
    expect(document.activeElement).toBe(screen.getByLabelText('Role name'));
    expect(level('Seating', 'Read').getAttribute('aria-pressed')).toBe('true');

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Venue crew' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Door team' }));

    await screen.findByText('A role with that name already exists.');
    expect(document.activeElement).toBe(screen.getByLabelText('Role name'));
    expect(level('Seating', 'Read').getAttribute('aria-pressed')).toBe('true');
  });

  it('opens a role whose name was stored with its accents decomposed with nothing unsaved', async () => {
    const crew = role('role_7', null, 'E\u0301quipe bar', ['events.read']);
    answering((method) =>
      method === 'GET'
        ? new Response(JSON.stringify({ roles: [...ROLES, crew], areas: AREAS }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^E\u0301quipe bar/);

    expect(screen.queryByText(/Unsaved changes/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard changes' })).toBeNull();
  });

  it('takes a role’s own name in another case as a rename, and Discard puts the name back', async () => {
    const sent = answering((method, body) =>
      method === 'PATCH'
        ? new Response(JSON.stringify({ ...ROLES[5], ...(body as object) }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^Door team/);

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Door crew' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect((screen.getByLabelText('Role name') as HTMLInputElement).value).toBe('Door team');
    expect(screen.queryByRole('button', { name: 'Save Door team' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'DOOR team' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Door team' }));

    await screen.findByText("Saved. Applies on each person's next request.");
    expect(sent.find((request) => request.method === 'PATCH')?.body).toEqual({
      name: 'DOOR team',
      permissions: ['events.read', 'guests.read'],
    });
  });

  it('keeps the name as a heading on Owner and the seeded roles', async () => {
    answering();
    await roles();

    for (const name of ['Owner', 'Administrator', 'Coordinator']) {
      pick(new RegExp(`^${name}`));

      expect(screen.getByRole('heading', { level: 2, name })).toBeDefined();
      expect(screen.queryByLabelText('Role name')).toBeNull();
    }
  });

  it('lets an Administrator rename a role holding more than they do, leaving its locked rows', async () => {
    const finance = role('role_7', null, 'Finance', ['billing.read', 'billing.manage']);
    signedIn(
      membership({
        ...IRE,
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: ROLES[1]?.permissions ?? [],
      }),
    );
    const sent = answering((method, body) =>
      method === 'GET'
        ? new Response(JSON.stringify({ roles: [...ROLES, finance], areas: AREAS }), {
            status: 200,
          })
        : new Response(JSON.stringify({ ...finance, ...(body as object) }), { status: 200 }),
    );
    await roles();
    pick(/^Finance/);

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Accounts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Finance' }));

    await screen.findByText("Saved. Applies on each person's next request.");
    expect(sent.find((request) => request.method === 'PATCH')?.body).toEqual({
      name: 'Accounts',
      permissions: ['billing.read', 'billing.manage'],
    });
  });

  it('lets an Administrator change only what they hold, and never move people onto Owner', async () => {
    const finance = role('role_7', null, 'Finance', ['billing.read', 'billing.manage']);
    signedIn(
      membership({
        ...IRE,
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: ROLES[1]?.permissions ?? [],
      }),
    );
    answering((method) =>
      method === 'GET'
        ? new Response(JSON.stringify({ roles: [...ROLES, finance], areas: AREAS }), {
            status: 200,
          })
        : null,
    );
    await roles();
    pick(/^Coordinator/);

    expect(
      screen.getByText('Built in, so it cannot be removed. What it holds is yours to change.'),
    ).toBeDefined();
    expect(level('Billing', 'Read')).toBeDefined();
    expect(
      within(screen.getByRole('group', { name: 'Billing' })).queryByRole('button', {
        name: 'Change',
      }),
    ).toBeNull();

    pick(/^Finance/);
    expect(screen.queryByRole('group', { name: 'Billing' })).toBeNull();
    expect(
      screen.getByText(
        'Only someone who can change Billing can set this. It stays as it is when you save.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        'You can change only what your role, Administrator, holds. Billing stays as it is when you save.',
      ),
    ).toBeDefined();

    pick(/^Door team/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));

    expect(screen.getByLabelText(/^Read-only/)).toBeDefined();
    expect(screen.queryByLabelText(/^Owner/)).toBeNull();
    expect(screen.queryByLabelText(/^Finance/)).toBeNull();
    expect(screen.getByLabelText(/^Administrator/)).toBeDefined();
  });

  it('leaves out of the locked notice an extra the grid has no words for', async () => {
    const areas = AREAS.map((entry) =>
      entry.area === 'events'
        ? { ...entry, permissions: [...entry.permissions, 'events.export'] }
        : entry,
    );
    signedIn(
      membership({
        ...IRE,
        role: { id: 'role_2', seededAs: 'administrator', name: null },
        permissions: ROLES[1]?.permissions ?? [],
      }),
    );
    answering((method) =>
      method === 'GET'
        ? new Response(JSON.stringify({ roles: ROLES, areas }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^Coordinator/);

    expect(screen.queryByText(/^You can change only what your role/)).toBeNull();
    expect(screen.queryByText(/rolesScreen\./)).toBeNull();
  });

  it('shows Create events under Events, given to Event manager and not to Coordinator', async () => {
    const sent = answering((method, body) =>
      method === 'PATCH'
        ? new Response(JSON.stringify({ ...ROLES[3], ...(body as object) }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^Event manager/);

    expect(level('Create events', 'Allowed').getAttribute('aria-pressed')).toBe('true');

    pick(/^Coordinator/);
    expect(level('Create events', 'Not allowed').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(level('Create events', 'Allowed'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Coordinator' }));

    await screen.findByText("Saved. Applies on each person's next request.");
    const patch = sent.find((request) => request.method === 'PATCH');
    expect((patch?.body as { permissions: string[] }).permissions.sort()).toEqual(
      ['budget.read', 'events.create', 'events.manage', 'events.read'].sort(),
    );
  });

  it('takes Create events away with Events set to Nothing, as the budget takes the margin', async () => {
    answering();
    await roles();
    pick(/^Event manager/);

    fireEvent.click(level('Events', 'Nothing'));

    expect(screen.queryByRole('group', { name: 'Create events' })).toBeNull();
    fireEvent.click(level('Events', 'Change'));
    expect(level('Create events', 'Not allowed').getAttribute('aria-pressed')).toBe('true');
  });

  it('offers no Nothing on a budget whose margin the caller cannot withdraw', async () => {
    signedIn(
      membership({
        ...IRE,
        role: { id: 'role_8', seededAs: null, name: 'Budgets' },
        permissions: ['members.read', 'members.manage', 'budget.read', 'budget.manage'],
      }),
    );
    answering();
    await roles();
    pick(/^Administrator/);

    expect(level('Budget', 'Read')).toBeDefined();
    expect(
      within(screen.getByRole('group', { name: 'Budget' })).queryByRole('button', {
        name: 'Nothing',
      }),
    ).toBeNull();
    expect(
      screen.getByText(
        'Only someone who can change Margin can set this. It stays as it is when you save.',
      ),
    ).toBeDefined();
  });

  it('refuses a seeded role’s name in another language before sending', async () => {
    const sent = answering();
    await roles();
    fireEvent.click(screen.getByRole('button', { name: 'New role' }));

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'COORDINATEUR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));

    expect(screen.getByText('A role with that name already exists.')).toBeDefined();
    expect(sent.some((request) => request.method === 'POST')).toBe(false);
  });

  it('refuses a seeded role’s name typed with its accent decomposed, before sending', async () => {
    const sent = answering();
    await roles();
    fireEvent.click(screen.getByRole('button', { name: 'New role' }));

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'So\u0301 leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));

    expect(screen.getByText('A role with that name already exists.')).toBeDefined();
    expect(sent.some((request) => request.method === 'POST')).toBe(false);
  });

  it('lets a forty-letter name typed with decomposed accents be typed in full', async () => {
    answering();
    await roles();
    fireEvent.click(screen.getByRole('button', { name: 'New role' }));

    const maximum = Number(screen.getByLabelText('Role name').getAttribute('maxlength'));
    expect(maximum).toBeGreaterThanOrEqual('e\u0301'.repeat(40).length);
  });

  it('names a long role in full on its row, for screen readers and as its title', async () => {
    const long = 'VenueAndSupplierLiaisonsForLagosWeddings';
    answering(
      () =>
        new Response(
          JSON.stringify({
            roles: [...ROLES, role('role_7', null, long, ['events.read'], 2)],
            areas: AREAS,
          }),
          { status: 200 },
        ),
    );
    await roles();

    const row = screen.getByRole('button', { name: new RegExp(`^${long}`) });
    expect(row.getAttribute('title')).toBe(long);
  });

  it('opens a role on its own page at narrow widths, with Roles to go back', async () => {
    answering();
    await roles();
    const layout = document.querySelector('.roles');

    expect(layout?.getAttribute('data-open')).toBe('false');
    pick(/^Coordinator/);
    expect(layout?.getAttribute('data-open')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /Roles$/ }));
    expect(layout?.getAttribute('data-open')).toBe('false');
  });

  describe('where a role opens on its own page', () => {
    // The query that hides the list once a role is open, as styles.css has it, not as Roles.tsx copies it.
    const onePane = /@media (\([^)]*\)) \{[^@]*\.roles\[data-open='true'\] \.roles-list/u.exec(
      readFileSync(join(import.meta.dirname, '../../../styles.css'), 'utf8'),
    )?.[1];

    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) => ({ matches: query === onePane, media: query }) as MediaQueryList,
      );
    });

    it('takes focus to the role’s name heading', async () => {
      answering();
      await roles();

      pick(/^Coordinator/);

      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Coordinator' }),
      );
    });

    it('takes focus to the Role name field where the name can be changed', async () => {
      answering();
      await roles();

      pick(/^Door team/);
      expect(document.activeElement).toBe(screen.getByLabelText('Role name'));

      fireEvent.click(screen.getByRole('button', { name: /Roles$/ }));
      fireEvent.click(screen.getByRole('button', { name: 'New role' }));
      expect(document.activeElement).toBe(screen.getByLabelText('Role name'));
    });
  });

  it('leaves focus on the row where the role shows beside the list', async () => {
    answering();
    await roles();
    const row = screen.getByRole('button', { name: /^Coordinator/ });
    row.focus();

    fireEvent.click(row);

    expect(document.activeElement).toBe(row);
  });

  it('takes focus to Remove ‹role›? once Remove role is pressed', async () => {
    answering();
    await roles();
    pick(/^Door team/);

    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Remove Door team?' }),
    );
  });

  it('takes focus to Saved once a new role is created, read once', async () => {
    answering((method, body) =>
      method === 'POST'
        ? new Response(
            JSON.stringify(
              role('role_9', null, 'Venue lead', (body as { permissions: string[] }).permissions),
            ),
            { status: 201 },
          )
        : null,
    );
    await roles();
    fireEvent.click(screen.getByRole('button', { name: 'New role' }));
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Venue lead' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));

    const saved = await screen.findByText("Saved. Applies on each person's next request.");
    await waitFor(() => expect(document.activeElement).toBe(saved.closest('.notice')));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a role that can read members the grid, with nothing to change', async () => {
    signedIn(membership({ ...IRE, permissions: ['members.read', 'events.read'] }));
    answering();
    await roles();

    expect(screen.queryByRole('button', { name: 'New role' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Events' })).toBeNull();
    expect(screen.getAllByText('Change').length).toBeGreaterThan(0);

    pick(/^Door team/);
    expect(screen.getByRole('heading', { level: 2, name: 'Door team' })).toBeDefined();
    expect(screen.queryByLabelText('Role name')).toBeNull();
  });

  it('tells a viewer who cannot change roles who decides, and promises them no removal', async () => {
    signedIn(membership({ ...IRE, permissions: ['members.read', 'events.read'] }));
    answering();
    await roles();

    pick(/^Coordinator/);
    expect(
      screen.getByText(
        'Built in, so it cannot be removed. Someone who can change Members and roles decides what it holds.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/What it holds is yours to change/)).toBeNull();

    pick(/^Door team/);
    expect(screen.getByText('Made by Ìrè Events.')).toBeDefined();
    expect(screen.queryByText(/It can be removed/)).toBeNull();

    pick(/^Owner/);
    expect(screen.getByText('Everything, including whatever Soirely adds later.')).toBeDefined();
  });

  it('keeps the lines that promise changes for a viewer who can change roles', async () => {
    answering();
    await roles();

    pick(/^Coordinator/);
    expect(
      screen.getByText('Built in, so it cannot be removed. What it holds is yours to change.'),
    ).toBeDefined();

    pick(/^Door team/);
    expect(screen.getByText('Made by Ìrè Events. It can be removed.')).toBeDefined();

    pick(/^Owner/);
    expect(screen.getByText('Everything, including whatever Soirely adds later.')).toBeDefined();
  });

  it('refuses a role that cannot read members', async () => {
    signedIn(membership({ ...IRE, permissions: ['events.read'] }));
    answering();
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/settings/roles'] })}
      />,
    );

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Roles' })).toBeNull();
  });
});

describe('where focus goes once a click on Roles is answered (sc-11369)', () => {
  function removed(): (method: string) => Response | null {
    let gone = false;

    return (method) => {
      if (method === 'DELETE') {
        gone = true;
        return new Response(null, { status: 204 });
      }

      return gone
        ? new Response(
            JSON.stringify({ roles: ROLES.filter((one) => one.id !== 'role_6'), areas: AREAS }),
            { status: 200 },
          )
        : null;
    };
  }

  it('puts focus back on Remove role after Keep ‹role›', async () => {
    answering();
    await roles();
    pick(/^Door team/);

    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Door team' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove role' }));
  });

  it('puts focus on Roles once a role is removed beside the list', async () => {
    answering(removed());
    await roles();
    pick(/^Door team/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));
    fireEvent.click(screen.getByLabelText(/^Read-only/));
    fireEvent.click(screen.getByRole('button', { name: 'Move them and remove Door team' }));

    const heading = screen.getByRole('heading', { level: 1, name: 'Roles' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('takes focus to Saved after Save ‹role›, read once', async () => {
    answering((method, body) =>
      method === 'PATCH'
        ? new Response(JSON.stringify({ ...ROLES[3], ...(body as object) }), { status: 200 })
        : null,
    );
    await roles();
    pick(/^Coordinator/);
    fireEvent.click(level('Billing', 'Read'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Coordinator' }));

    const saved = await screen.findByText("Saved. Applies on each person's next request.");
    await waitFor(() => expect(document.activeElement).toBe(saved.closest('.notice')));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('puts focus on the role’s name after Discard changes', async () => {
    answering();
    await roles();

    pick(/^Coordinator/);
    fireEvent.click(level('Billing', 'Read'));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Coordinator' }),
    );

    pick(/^Door team/);
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Door crew' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Role name'));
  });

  it('puts focus on Roles after Try again, or on the line once it fails again', async () => {
    let reads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (new URL(String(input)).pathname !== '/api/orgs/org_1/roles') {
        throw new TypeError('Failed to fetch');
      }
      reads += 1;
      if (reads < 3) throw new TypeError('Failed to fetch');

      return new Response(JSON.stringify({ roles: ROLES, areas: AREAS }), { status: 200 });
    });
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/settings/roles'] })}
      />,
    );

    const failed = 'The roles did not load. Try again in a moment.';
    expect(await screen.findByText(failed)).toBeDefined();
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const again = await screen.findByText(failed);
    await waitFor(() => expect(document.activeElement).toBe(again));
    expect(again.closest('[role="alert"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Roles' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  describe('in a window 960 pixels wide or less', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) => ({ matches: query === '(width <= 60rem)', media: query }) as MediaQueryList,
      );
    });

    it('puts focus on the role’s row after ‹ Roles, or on New role for one not yet made', async () => {
      answering();
      await roles();

      pick(/^Coordinator/);
      fireEvent.click(screen.getByRole('button', { name: /Roles$/ }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Coordinator/ }));

      fireEvent.click(screen.getByRole('button', { name: 'New role' }));
      fireEvent.click(screen.getByRole('button', { name: /Roles$/ }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New role' }));
    });

    it('puts focus on the next role’s name once a role is removed', async () => {
      answering(removed());
      await roles();
      pick(/^Door team/);
      fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));
      fireEvent.click(screen.getByLabelText(/^Read-only/));
      fireEvent.click(screen.getByRole('button', { name: 'Move them and remove Door team' }));

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { level: 2, name: 'Administrator' }),
        ),
      );
    });

    it('puts focus on Roles after ‹ Roles once the role’s row has gone', async () => {
      let gone = false;
      answering((method) => {
        if (method === 'DELETE') {
          gone = true;
          return new Response(null, { status: 204 });
        }

        return gone
          ? new Response(
              JSON.stringify({
                roles: ROLES.filter((one) => one.id !== 'role_6' && one.id !== 'role_2'),
                areas: AREAS,
              }),
              { status: 200 },
            )
          : null;
      });
      await roles();
      pick(/^Door team/);
      fireEvent.click(screen.getByRole('button', { name: 'Remove role' }));
      fireEvent.click(screen.getByLabelText(/^Read-only/));
      fireEvent.click(screen.getByRole('button', { name: 'Move them and remove Door team' }));
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /^Administrator/ })).toBeNull(),
      );

      fireEvent.click(screen.getByRole('button', { name: /Roles$/ }));

      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Roles' }));
    });
  });
});
