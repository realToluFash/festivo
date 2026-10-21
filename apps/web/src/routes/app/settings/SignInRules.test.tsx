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
  everyoneNeedsTwoFactor: false,
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
  ownProvider: true,
};

const UNLINKED = { ...PAGE, ownProvider: false };

function refusingUnlinked(page: unknown) {
  const sent: { method: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const method = init?.method ?? 'GET';
    sent.push({ method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    return method === 'PATCH'
      ? new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/oauth_only_unlinked',
            title: 'Link Google or Apple before requiring it.',
            status: 403,
          }),
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        )
      : new Response(JSON.stringify(page), { status: 200 });
  });

  return sent;
}

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
    waitingFor: null,
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

  it('lays the inactivity lengths out as pills that wrap', async () => {
    signedIn(membership());
    answering();
    open();

    const idle = await screen.findByRole('group', { name: 'How long a sign-in lasts unused' });

    expect(idle.className).toBe('sign-in-rules-choices');
  });

  it('refuses requiring two-factor while the person saving has none, and sends nothing', async () => {
    signedIn(membership());
    const sent = answering();
    open();

    const require = await screen.findByRole('button', {
      name: 'Require two-factor for people who can manage members, roles, billing or security',
    });
    fireEvent.click(require);

    const notice = screen.getByRole('alert');
    expect(within(notice).getByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(within(notice).getByText('Then you can require it here.')).toBeDefined();
    expect(
      within(notice).getByRole('link', { name: 'Turn on two-factor' }).getAttribute('href'),
    ).toBe('/app/account/security');
    expect(require.getAttribute('aria-pressed')).toBe('false');
    expect(
      within(
        screen.getByRole('region', {
          name: 'Two-factor for people who can manage members, roles, billing or security',
        }),
      ).getByText('Not required'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rules are saved' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(sent.filter(({ method }) => method === 'PATCH')).toEqual([]);
  });

  it('sends requiring two-factor once the person saving has it', async () => {
    signedIn(membership());
    const page = { ...PAGE, ownTwoFactor: true };
    const sent = answering(page, { ...page, administratorsNeedTwoFactor: true });
    open();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Require two-factor for people who can manage members, roles, billing or security',
      }),
    );
    expect(screen.queryByText('Turn on two-factor for yourself first')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText(/Rules saved/)).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ administratorsNeedTwoFactor: true });
  });

  it('when the server refuses it, the switch goes back off and the other choices stay unsaved', async () => {
    signedIn(membership());
    const page = { ...PAGE, ownTwoFactor: true };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) =>
      init?.method === 'PATCH'
        ? new Response(
            JSON.stringify({
              type: 'https://soirely.com/errors/two_factor_off',
              title: 'Two-factor is not on.',
              status: 409,
            }),
            { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
          )
        : new Response(JSON.stringify(page), { status: 200 }),
    );
    open();

    const idle = within(
      await screen.findByRole('group', { name: 'How long a sign-in lasts unused' }),
    );
    fireEvent.click(idle.getByRole('button', { name: '7 days' }));
    const require = screen.getByRole('button', {
      name: 'Require two-factor for people who can manage members, roles, billing or security',
    });
    fireEvent.click(require);
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(require.getAttribute('aria-pressed')).toBe('false');
    expect(idle.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeDefined();
    expect(screen.queryByText(/The rules were not saved/)).toBeNull();
  });

  it('refuses requiring Google or Apple while the person saving has neither linked, in place of its effects', async () => {
    signedIn(membership());
    const sent = answering(UNLINKED);
    open();

    const provider = await screen.findByLabelText(/Google or Apple only/);
    fireEvent.click(provider);

    const notice = screen.getByRole('alert');
    expect(within(notice).getByText('Link Google or Apple for yourself first')).toBeDefined();
    expect(within(notice).getByText('Then you can require it here.')).toBeDefined();
    expect(
      within(notice).getByRole('link', { name: 'Link Google or Apple' }).getAttribute('href'),
    ).toBe('/app/account/security');
    expect((provider as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('list', { name: 'People affected' })).toBeNull();
    expect(screen.queryByText(/sign in with a password only/)).toBeNull();
    expect(screen.getByText('Nothing changes. These are the rules in force.')).toBeDefined();
    expect(screen.queryByText(/asked to sign in again with it/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(sent.filter(({ method }) => method === 'PATCH')).toEqual([]);
    expect((screen.getByLabelText(/Any method/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Link Google or Apple for yourself first')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rules are saved' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('keeps the other unsaved choices when the provider choice is refused, and saves them on a second press', async () => {
    signedIn(membership());
    const sent = answering(UNLINKED, { ...UNLINKED, inactivityTimeoutDays: 7 });
    open();

    const idle = within(
      await screen.findByRole('group', { name: 'How long a sign-in lasts unused' }),
    );
    fireEvent.click(idle.getByRole('button', { name: '7 days' }));
    fireEvent.click(screen.getByLabelText(/Google or Apple only/));
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(sent.filter(({ method }) => method === 'PATCH')).toEqual([]);
    expect(idle.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText(/Any method/) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText(/Rules saved/)).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ inactivityTimeoutDays: 7 });
    expect(screen.queryByText('Link Google or Apple for yourself first')).toBeNull();
  });

  it('clears the notice when "Any method" is chosen by hand', async () => {
    signedIn(membership());
    answering(UNLINKED);
    open();

    fireEvent.click(await screen.findByLabelText(/Google or Apple only/));
    fireEvent.click(screen.getByLabelText(/Any method/));

    expect(screen.queryByText('Link Google or Apple for yourself first')).toBeNull();
  });

  it('when the server refuses it, the method goes back to "Any method" and the other choices stay unsaved', async () => {
    signedIn(membership());
    const sent = refusingUnlinked(PAGE);
    open();

    const idle = within(
      await screen.findByRole('group', { name: 'How long a sign-in lasts unused' }),
    );
    fireEvent.click(idle.getByRole('button', { name: '7 days' }));
    fireEvent.click(screen.getByLabelText(/Google or Apple only/));
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText('Link Google or Apple for yourself first')).toBeDefined();
    expect(sent.filter(({ method }) => method === 'PATCH')).toHaveLength(1);
    expect((screen.getByLabelText(/Any method/) as HTMLInputElement).checked).toBe(true);
    expect(idle.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeDefined();
    expect(screen.queryByText(/The rules were not saved/)).toBeNull();
    expect(screen.queryByText(/Read-only until you link/)).toBeNull();
  });

  it('after the server refuses it, choosing it again brings the notice back without a round trip', async () => {
    signedIn(membership());
    const sent = refusingUnlinked(PAGE);
    open();

    fireEvent.click(await screen.findByLabelText(/Google or Apple only/));
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));
    await screen.findByText('Link Google or Apple for yourself first');

    fireEvent.click(screen.getByLabelText(/Any method/));
    fireEvent.click(screen.getByLabelText(/Google or Apple only/));

    expect(screen.getByText('Link Google or Apple for yourself first')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'People affected' })).toBeNull();
    expect(sent.filter(({ method }) => method === 'PATCH')).toHaveLength(1);
  });

  it('when the rule is already required, a refused save of another rule leaves the method alone', async () => {
    signedIn(membership());
    const sent = refusingUnlinked({ ...PAGE, providerOnly: true });
    open();

    const idle = within(
      await screen.findByRole('group', { name: 'How long a sign-in lasts unused' }),
    );
    fireEvent.click(idle.getByRole('button', { name: '7 days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText(/The rules were not saved/)).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ inactivityTimeoutDays: 7 });
    expect((screen.getByLabelText(/Google or Apple only/) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText('Link Google or Apple for yourself first')).toBeNull();
  });

  it('sends requiring Google or Apple once the person saving has one linked', async () => {
    signedIn(membership());
    const sent = answering(PAGE, { ...PAGE, providerOnly: true });
    open();

    fireEvent.click(await screen.findByLabelText(/Google or Apple only/));
    expect(screen.queryByText('Link Google or Apple for yourself first')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText(/Rules saved/)).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ providerOnly: true });
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

describe('Two-factor for everyone (sc-609), for someone who manages the organisation', () => {
  const DEADLINE = { at: '2026-10-24T13:20:00+00:00', written: 'Saturday, Oct 24 at 14:20 WAT' };
  const WITH_OWN = {
    ...PAGE,
    ownTwoFactor: true,
    twoFactorDeadline: DEADLINE,
    withoutTwoFactor: [{ userId: 'user_3', name: 'Chidi Okoro', role: COORDINATOR }],
  };

  it('is refused before saving to somebody without two-factor, with the same notice as the administrators’ rule', async () => {
    signedIn(membership());
    const sent = answering({ ...WITH_OWN, ownTwoFactor: false });
    open();

    const everyone = await screen.findByRole('button', { name: 'Require two-factor for everyone' });
    fireEvent.click(everyone);

    expect(screen.getByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(screen.getByText('Then you can require it here.')).toBeDefined();
    expect(everyone.getAttribute('aria-pressed')).toBe('false');
    expect(sent.filter(({ method }) => method === 'PATCH')).toEqual([]);
  });

  it('names who has no two-factor and their deadline before saving, then says when it is required from', async () => {
    signedIn(membership());
    const sent = answering(WITH_OWN, { ...WITH_OWN, everyoneNeedsTwoFactor: true });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Require two-factor for everyone' }));

    expect(screen.getByText('1 person doesn’t have two-factor yet')).toBeDefined();
    expect(
      screen.getByText(
        /^When you save, they get an email\. They have until Saturday, Oct 24 at 14:20 WAT to turn it on/,
      ),
    ).toBeDefined();
    const without = within(screen.getByRole('list', { name: 'People without two-factor' }));
    expect(without.getByText('Chidi Okoro · Coordinator')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText('Required from Saturday, Oct 24 at 14:20 WAT')).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ everyoneNeedsTwoFactor: true });
  });

  it('keeps the administrators’ switch, reading that everyone’s rule covers it', async () => {
    signedIn(membership());
    answering({ ...WITH_OWN, administratorsNeedTwoFactor: true, everyoneNeedsTwoFactor: true });
    open();

    expect(await screen.findByText('Covered by two-factor for everyone, below.')).toBeDefined();
    expect(
      screen
        .getByRole('button', {
          name: 'Require two-factor for people who can manage members, roles, billing or security',
        })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('when the server refuses it, the switch goes back off and the notice shows, never the server’s words', async () => {
    signedIn(membership());
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) =>
      init?.method === 'PATCH'
        ? new Response(
            JSON.stringify({
              type: 'https://soirely.com/errors/two_factor_off',
              title: 'Two-factor is not on.',
              status: 409,
            }),
            { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
          )
        : new Response(JSON.stringify(WITH_OWN), { status: 200 }),
    );
    open();

    const everyone = await screen.findByRole('button', { name: 'Require two-factor for everyone' });
    fireEvent.click(everyone);
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(await screen.findByText('Turn on two-factor for yourself first')).toBeDefined();
    expect(everyone.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Two-factor is not on.')).toBeNull();
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
        everyoneNeedsTwoFactor: false,
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

  it('a member without two-factor sees the deadline, with no way to close it', async () => {
    signedIn(
      membership({
        twoFactorDue: {
          at: '2999-10-24T13:20:00+00:00',
          written: 'Saturday, Oct 24 at 14:20 WAT',
          overdue: false,
        },
      }),
    );
    answering();
    open('/app/settings');

    expect(
      await screen.findByText('Ìrè Events requires two-factor from Saturday, Oct 24 at 14:20 WAT.'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Turn it on now' }).getAttribute('href')).toBe(
      '/app/account/security',
    );
    expect(screen.queryByRole('button', { name: 'Close this notice' })).toBeNull();
  });

  it('past the deadline, nothing in the organisation opens until two-factor is on', async () => {
    signedIn(
      membership({
        twoFactorDue: {
          at: '2026-10-24T13:20:00+00:00',
          written: 'Saturday, Oct 24 at 14:20 WAT',
          overdue: true,
        },
      }),
    );
    answering();
    open('/app/settings/sign-in-rules');

    expect(await screen.findByText('Turn on two-factor to carry on')).toBeDefined();
    expect(
      screen.getByText('Ìrè Events requires two-factor, and the time to turn it on has passed.'),
    ).toBeDefined();
    expect(
      screen.getByText('Your other organisations and single-event access are not affected.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Sign-in rules' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Turn on two-factor' }));

    await waitFor(() => expect(screen.queryByText('Turn on two-factor to carry on')).toBeNull());
  });
});
