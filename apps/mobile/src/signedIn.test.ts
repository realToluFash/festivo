import type { InvitationPreview } from '@soirely/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  organisationsWithPaused: vi.fn(),
  signOut: vi.fn(),
  myInvitations: vi.fn(async (): Promise<InvitationPreview[]> => []),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('./api.ts', () => ({ api }));
vi.mock('./tokens.ts', () => ({ tokens: { clear: vi.fn() } }));
vi.mock('expo-router', () => ({ router }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
}));
vi.mock('react', () => ({
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useEffect: (effect: () => void) => effect(),
}));

const {
  launchSignedIn,
  reloadSignedIn,
  replaceOrganisation,
  rereadAccount,
  signOutHere,
  useSignedIn,
} = await import('./signedIn.ts');
const { useWaitingInvitations } = await import('./invitations.ts');

const account = { id: 'usr_1', name: 'Adaeze' };
const organisation = {
  id: 'org_1',
  name: 'Ìrè Events',
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  locale: 'en',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  role: { id: 'role_1', seededAs: 'owner', name: null },
  permissions: ['organisation.manage'],
  withheldUntilTwoFactor: [],
  readOnlyUntilLinked: false,
  twoFactorDue: null,
  signInRules: {
    providerOnly: false,
    inactivityTimeoutDays: null,
    administratorsNeedTwoFactor: false,
    everyoneNeedsTwoFactor: false,
    changedAt: null,
  },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('"Sign out" on the Settings list and the "This device" row', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    api.signOut.mockResolvedValue(undefined);
    await reloadSignedIn();
    vi.clearAllMocks();
  });

  it('asks for no confirmation and calls logout once', async () => {
    signOutHere();
    await settle();

    expect(api.signOut).toHaveBeenCalledTimes(1);
  });

  it('opens sign-in with no "You were signed out" banner', async () => {
    signOutHere();
    await settle();

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('forgets the account, and a frame still on screen does not ask for it again', async () => {
    expect(useSignedIn().account).toEqual(account);

    signOutHere();
    await settle();

    expect(useSignedIn()).toEqual({
      account: null,
      organisations: [],
      organisation: null,
      invitations: [],
      invitationOutcomes: {},
    });
    expect(api.me).not.toHaveBeenCalled();
  });
});

describe('opening the signed-in home at launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is ready once the account and its organisations are read', async () => {
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });

    await expect(launchSignedIn()).resolves.toBe(true);
    expect(useSignedIn().organisation).toEqual(organisation);
  });

  it('shows the organisation access is paused in when there is nothing else to open', async () => {
    const paused = {
      ...organisation,
      suspension: {
        reason: 'address_gone' as const,
        domain: 'ire.events',
        since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
        removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday, Nov 15 at 09:40 WAT' },
        onlyOwner: false,
      },
      ownerClaim: null,
    };
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [], paused: [paused] });

    await expect(launchSignedIn()).resolves.toBe(true);
    expect(useSignedIn().pausedIn).toEqual(paused);
  });

  it('is not, and opens sign-in, when the account cannot be read', async () => {
    api.me.mockRejectedValue(new Error('unauthorised'));
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });

    await expect(launchSignedIn()).resolves.toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });
});

describe('an organisation saved from its page', () => {
  const other = { ...organisation, id: 'org_2', name: 'Okafor Weddings' };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({
      organisations: [organisation, other],
      paused: [],
    });
    await reloadSignedIn();
  });

  it('shows its new name in the switcher and on the list at once, with no second load', () => {
    replaceOrganisation({ ...organisation, name: 'Ìrè Events Ltd' });

    expect(useSignedIn().organisation?.name).toBe('Ìrè Events Ltd');
    expect(useSignedIn().organisations.map(({ name }) => name)).toEqual([
      'Ìrè Events Ltd',
      'Okafor Weddings',
    ]);
    expect(api.organisationsWithPaused).toHaveBeenCalledTimes(1);
  });

  it('leaves the organisation this device is in alone when another one changes', () => {
    replaceOrganisation({ ...other, name: 'Okafor & Co' });

    expect(useSignedIn().organisation?.id).toBe('org_1');
  });
});

describe('the account read again without leaving the screen', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    await reloadSignedIn();
    vi.clearAllMocks();
  });

  it('replaces the account and keeps the organisation, with no second organisations read', async () => {
    api.me.mockResolvedValue({ ...account, name: 'Adaeze Okafor' });

    await rereadAccount();

    expect(useSignedIn().account).toEqual({ ...account, name: 'Adaeze Okafor' });
    expect(useSignedIn().organisation).toEqual(organisation);
    expect(api.organisationsWithPaused).not.toHaveBeenCalled();
  });

  it('rejects when the read fails, keeps the account it had, and opens nothing', async () => {
    api.me.mockRejectedValue(new Error('offline'));

    await expect(rereadAccount()).rejects.toThrow('offline');
    expect(useSignedIn().account).toEqual(account);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('an invitation answered on one screen', () => {
  const invitation: InvitationPreview = {
    id: 'inv_1',
    organisation: { id: 'org_2', name: 'Okafor Weddings' },
    email: 'adaeze@ire.events',
    role: { id: 'role_2', seededAs: 'coordinator', name: null },
    invitedBy: { name: 'Chidi' },
    expiresAt: '2026-10-26T09:00:00Z',
    refusal: null,
    forYou: true,
    signedInAs: null,
  };
  const joined = { ...organisation, id: 'org_2', name: 'Okafor Weddings' };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisationsWithPaused.mockResolvedValue({ organisations: [organisation], paused: [] });
    api.myInvitations.mockResolvedValue([invitation]);
    await reloadSignedIn();
  });

  it('is read once with the account, not once per screen', () => {
    useWaitingInvitations();
    useWaitingInvitations();

    expect(api.myInvitations).toHaveBeenCalledTimes(1);
    expect(useWaitingInvitations().invitations).toEqual([invitation]);
  });

  it('shows as declined on the screen underneath too', async () => {
    api.declineInvitation.mockResolvedValue(undefined);
    const settings = useWaitingInvitations();

    await settings.answer(invitation, 'decline');

    expect(useWaitingInvitations().outcomes).toEqual({ inv_1: { kind: 'declined' } });
  });

  it('shows as accepted on the screen underneath too, with the organisation joined', async () => {
    api.acceptInvitation.mockResolvedValue(joined);
    const settings = useWaitingInvitations();

    await settings.answer(invitation, 'accept');

    expect(useWaitingInvitations().outcomes).toEqual({
      inv_1: { kind: 'accepted', organisationId: 'org_2' },
    });
    expect(useSignedIn().organisations.map(({ id }) => id)).toEqual(['org_1', 'org_2']);
  });
});
