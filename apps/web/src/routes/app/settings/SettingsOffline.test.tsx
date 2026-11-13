import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const FOLAKE = { id: 'u1', name: 'Folake Adeyemi' };
const OWNER = { id: 'role_1', seededAs: 'owner', name: null };

const MEMBERS = {
  members: [
    {
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
    },
  ],
  invitations: [],
};

const ME = {
  id: 'acc_1',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  waitingFor: null,
  verified: true,
  complete: true,
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  providers: [],
  emailAddresses: [{ id: 'e1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

const ANSWERS: Record<string, unknown> = {
  '/api/orgs': { organisations: [IRE], paused: [] },
  '/api/orgs/org_1/members': MEMBERS,
  '/api/orgs/org_1/roles': {
    roles: [
      {
        ...OWNER,
        fixed: true,
        removable: false,
        permissions: OWNER_PERMISSIONS,
        holders: 1,
        holderNames: [{ name: 'Folake Adeyemi', suspended: false }],
      },
    ],
    areas: [],
  },
  '/api/orgs/org_1/domains': { domains: [] },
  '/api/orgs/org_1/request-link': { on: false, url: null },
  '/api/orgs/org_1/sign-in-rules': {
    providerOnly: false,
    inactivityTimeoutDays: null,
    administratorsNeedTwoFactor: false,
    everyoneNeedsTwoFactor: false,
    changedAt: null,
    inactivityChoices: [7, 30],
    changes: [],
    passwordOnly: [],
    withoutTwoFactor: [],
    twoFactorDeadline: null,
    inactivityLimit: null,
    ownTwoFactor: false,
    ownProvider: false,
  },
  '/api/auth/recovery-requests': { requests: [] },
  '/api/auth/me': ME,
  '/api/auth/timezones': { timezones: [] },
  '/api/auth/two-factor': { on: false, recoveryCodesLeft: 0 },
  '/api/auth/sessions': { sessions: [] },
  '/api/auth/notification-settings': {
    categories: [
      {
        category: 'messages',
        push: { on: true, switchable: true },
        email: { on: true, switchable: true },
      },
    ],
  },
  '/api/notifications': { items: [], unreadCount: 0, next: null },
  '/api/orgs/org_1/events': { events: [], total: 0 },
  '/api/invitations': { invitations: [] },
  '/api/join-offers': { offers: [] },
};

function signedIn(more: Partial<Session> = {}): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Folake Adeyemi',
      email: 'folake@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u1',
      needsOrganisation: false,
      hasPassword: true,
      organisation: IRE,
      organisations: [IRE],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
      ...more,
    },
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Soirely answers each page's loads until `soirely.reachable` turns false. */
function serving(soirely: { reachable: boolean }): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (!soirely.reachable) throw new TypeError('Failed to fetch');

    const path = new URL(String(input)).pathname;

    const answer = ANSWERS[path];
    if (answer == null) throw new Error(`Nothing stubbed for ${path}`);

    return json(answer);
  });
}

/** At a desk wide enough that a person opens beside the Members list. */
function atWideDesk(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(width >= 96rem)',
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as never,
  );
}

function open(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function goOffline(): void {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

/** The one amber box, above `title`, with no band anywhere. */
function boxAbove(title: HTMLElement): HTMLElement {
  const boxes = document.querySelectorAll<HTMLElement>('.offline-box');

  expect(boxes).toHaveLength(1);
  expect(document.querySelector('.offline-band')).toBeNull();
  expect(boxes[0]!.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  return boxes[0]!;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Settings offline at a desk, where the band has gone (sc-39471)', () => {
  it.each([
    ['/app/settings', 'General'],
    ['/app/settings/members', 'Members'],
    ['/app/settings/sign-in-rules', 'Sign-in rules'],
    ['/app/account', 'Your account'],
    ['/app/account/security', 'Security'],
    ['/app/account/notifications', 'Notification settings'],
  ])('%s says so in the amber box above its title, with Try again', async (path, title) => {
    signedIn();
    const soirely = { reachable: true };
    serving(soirely);
    open(path);
    const heading = await screen.findByRole('heading', { level: 1, name: title });

    soirely.reachable = false;
    goOffline();

    await waitFor(() => expect(document.querySelector('.offline-box .ev-offline')).not.toBeNull());
    const box = boxAbove(heading);
    expect(within(box).getByText(/^Offline · as of /)).toBeDefined();
    expect(within(box).getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('keeps Personalisation, which loads nothing from Soirely, to the one box above its title', async () => {
    signedIn();
    serving({ reachable: true });
    open('/app/account/personalisation');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Personalisation' });

    goOffline();

    boxAbove(heading);
  });

  it('puts the box over a person opened beside the Members list', async () => {
    atWideDesk();
    signedIn();
    const soirely = { reachable: true };
    serving(soirely);
    open('/app/settings/members');
    fireEvent.click(await screen.findByRole('button', { name: /Folake Adeyemi/ }));
    const side = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('.members-side');
      expect(found).not.toBeNull();
      return found!;
    });

    soirely.reachable = false;
    goOffline();

    await waitFor(() => expect(side.querySelector('.offline-box .ev-offline')).not.toBeNull());
    expect(document.querySelectorAll('.offline-box')).toHaveLength(1);
    expect(document.querySelector('.offline-band')).toBeNull();
    expect(side.firstElementChild?.classList.contains('offline-box')).toBe(true);
    expect(within(side).getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it("puts the box above a paused organisation's notice beside the Settings list", async () => {
    const { id, name, countryCode, currency, timezone, contactAddress, locale } = membership({
      id: 'org_3',
      name: 'Lagos Weddings',
    });
    signedIn({
      pausedIn: {
        id,
        name,
        countryCode,
        currency,
        timezone,
        contactAddress,
        locale,
        suspension: {
          reason: 'address_gone',
          domain: 'lagosweddings.ng',
          since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
          removesAt: null,
          onlyOwner: false,
        },
        ownerClaim: null,
      },
    } as Partial<Session>);
    serving({ reachable: true });
    open('/app/settings');
    const page = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('.settings-desk-page');
      expect(found?.querySelector('h1')).not.toBeNull();
      return found!;
    });

    goOffline();

    boxAbove(page.querySelector('h1')!);
    expect(page.firstElementChild?.classList.contains('offline-box')).toBe(true);
  });
});
