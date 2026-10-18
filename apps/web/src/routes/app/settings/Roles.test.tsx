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
) {
  return {
    id,
    seededAs,
    name,
    fixed: seededAs === 'owner',
    removable: seededAs == null,
    permissions,
    holders,
  };
}

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
    ['events.read', 'events.manage', 'budget.read', 'budget.manage'],
    1,
  ),
  role('role_4', 'coordinator', null, ['events.read', 'events.manage', 'budget.read'], 2),
  role('role_5', 'read_only', null, ['events.read', 'budget.read']),
  role('role_6', null, 'Door team', ['events.read', 'guests.read'], 2),
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

function pick(name: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

function level(area: string, choice: string): HTMLElement {
  return within(screen.getByRole('group', { name: area })).getByRole('button', { name: choice });
}

beforeEach(() => signedIn());

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
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

  it('checks a new role’s name before sending, and says the server’s refusal under it', async () => {
    const sent = answering((method) =>
      method === 'POST'
        ? new Response(
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
          )
        : null,
    );
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

  it('shows a role that can read members the grid, with nothing to change', async () => {
    signedIn(membership({ ...IRE, permissions: ['members.read', 'events.read'] }));
    answering();
    await roles();

    expect(screen.queryByRole('button', { name: 'New role' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Events' })).toBeNull();
    expect(screen.getAllByText('Change').length).toBeGreaterThan(0);
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
