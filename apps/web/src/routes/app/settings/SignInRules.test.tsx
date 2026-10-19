import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import type { Membership } from '@soirely/api-client';
import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const OWNER = { id: 'role_1', seededAs: 'owner', name: null };
const COORDINATOR = { id: 'role_4', seededAs: 'coordinator', name: null };

const PAGE = {
  providerOnly: false,
  inactivityTimeoutDays: null,
  administratorsNeedTwoFactor: false,
  changedAt: null,
  inactivityChoices: [7, 30],
  changes: [],
  passwordOnly: [
    {
      userId: 'user_2',
      name: 'Bisi Adeyemi',
      role: { id: 'role_2', seededAs: 'administrator', name: null },
    },
    { userId: 'user_3', name: 'Chidi Okoro', role: COORDINATOR },
  ],
};

function signedIn(organisation: Membership): void {
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

function answering(page: unknown = PAGE, saved: unknown = page) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ method, path: new URL(String(input)).pathname, body });

    return new Response(JSON.stringify(method === 'PATCH' ? saved : page), { status: 200 });
  });

  return sent;
}

function open(path = '/app/settings/sign-in-rules') {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  __setSessionState({ status: 'unknown' });
});

describe('Settings > Sign-in rules, for someone who manages the organisation', () => {
  it('names who a Google-or-Apple-only rule leaves with a password, before anything is saved', async () => {
    signedIn(membership());
    const sent = answering();
    open();

    fireEvent.click(await screen.findByLabelText(/Google or Apple only/));

    expect(screen.getByText('2 people sign in with a password only')).toBeDefined();
    const affected = within(screen.getByRole('list', { name: 'People affected' }));
    expect(affected.getByText('Bisi Adeyemi · Administrator · password')).toBeDefined();
    expect(screen.getByText(/asked to sign in again with it/)).toBeDefined();
    expect(
      screen.getByText(/Bisi Adeyemi and Chidi Okoro can read but not change/).textContent,
    ).toMatch(/Their password still signs them in\.$/);
    expect(sent.filter(({ method }) => method === 'PATCH')).toEqual([]);
  });

  it('sends only the rules that changed, and says everyone affected was emailed', async () => {
    signedIn(membership());
    const sent = answering(PAGE, {
      ...PAGE,
      inactivityTimeoutDays: 7,
      changedAt: '2026-10-19T10:00:00+00:00',
    });
    open();

    const idle = within(
      await screen.findByRole('group', { name: 'How long a sign-in lasts unused' }),
    );
    fireEvent.click(idle.getByRole('button', { name: '7 days' }));
    expect(
      screen.getByText(/has not used Soirely for 7 days is asked to sign in again/),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText(/Rules saved/)).toBeDefined();
    expect(sent.at(-1)).toEqual({
      method: 'PATCH',
      path: '/api/orgs/org_1/sign-in-rules',
      body: { inactivityTimeoutDays: 7 },
    });
    // Whoever made the change is not told about it as news.
    expect(screen.queryByText('Sign-in rules changed')).toBeNull();
  });

  it('offers no save while the rules are the ones in force', async () => {
    signedIn(membership());
    answering();
    open();

    const save = await screen.findByRole('button', { name: 'Rules are saved' });

    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Nothing changes. These are the rules in force.')).toBeDefined();
  });
});

describe('Settings > Sign-in rules, for any other member', () => {
  it('reads the rules in force and what changed, with nothing to change', async () => {
    signedIn(membership({ role: COORDINATOR, permissions: ['events.read', 'events.manage'] }));
    answering({
      ...PAGE,
      inactivityTimeoutDays: 30,
      changedAt: '2026-10-15T17:40:00+00:00',
      changes: [
        {
          at: '2026-10-15T17:40:00+00:00',
          by: { name: 'Folake Adeyemi', role: OWNER },
          rule: 'inactivityTimeoutDays',
          now: 30,
          was: null,
        },
      ],
      passwordOnly: undefined,
    });
    open();

    expect(
      await screen.findByRole('heading', { name: 'Ìrè Events’s sign-in rules' }),
    ).toBeDefined();
    expect(await screen.findAllByText('Sign-ins end after 30 days without use')).toHaveLength(2);
    expect(screen.getByText('was: Sign-ins last until you sign out')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Save rules|Rules are saved/ })).toBeNull();
  });
});

describe('whose inactivity limit applies, for a member of several organisations (sc-69)', () => {
  it('names the other organisation whose shorter limit is the one in force', async () => {
    signedIn(membership({ role: COORDINATOR, permissions: ['events.read'] }));
    answering({
      ...PAGE,
      inactivityTimeoutDays: 30,
      passwordOnly: undefined,
      inactivityLimit: { organisationId: 'org_2', organisation: 'Studio Lumen', days: 7 },
    });
    open();

    expect(
      await screen.findByText(
        'For you, sign-ins end after 7 days without use: Studio Lumen’s rule, the shortest of your organisations.',
      ),
    ).toBeDefined();
  });

  it('says nothing more when this organisation’s own limit is the one in force', async () => {
    signedIn(membership({ role: COORDINATOR, permissions: ['events.read'] }));
    answering({
      ...PAGE,
      inactivityTimeoutDays: 7,
      passwordOnly: undefined,
      inactivityLimit: { organisationId: 'org_1', organisation: 'Ìrè Events', days: 7 },
    });
    open();

    await screen.findAllByText('Sign-ins end after 7 days without use');
    expect(screen.queryByText(/the shortest of your organisations/)).toBeNull();
  });
});

describe('what the rules ask of a member, on every page', () => {
  it('a member with no provider under a Google-or-Apple-only rule is told they can only read', async () => {
    signedIn(membership({ readOnlyUntilLinked: true }));
    answering();
    open('/app/settings');

    expect(await screen.findByText('Read-only until you link Google or Apple')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Link Google or Apple' }).getAttribute('href')).toBe(
      '/app/account/security',
    );
  });

  it('an administrator without two-factor is asked to turn it on, and can put it off', async () => {
    signedIn(membership({ withheldUntilTwoFactor: ['members.manage'] }));
    answering();
    open('/app/settings');

    expect(await screen.findByText('Two-factor required by Ìrè Events')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('Two-factor required by Ìrè Events')).toBeNull();
  });

  it('a change to the rules is said once, and closing it keeps it closed', async () => {
    const changed = membership({
      signInRules: {
        providerOnly: false,
        inactivityTimeoutDays: 30,
        administratorsNeedTwoFactor: false,
        changedAt: '2026-10-15T17:40:00+00:00',
      },
    });
    signedIn(changed);
    answering();
    open('/app/settings');

    expect(await screen.findByText('Sign-in rules changed')).toBeDefined();
    expect(screen.getByRole('link', { name: 'See what changed' }).getAttribute('href')).toBe(
      '/app/settings/sign-in-rules',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close this notice' }));

    await waitFor(() => expect(screen.queryByText('Sign-in rules changed')).toBeNull());
  });
});
