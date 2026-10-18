import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  organisations: vi.fn(),
  signOut: vi.fn(),
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

const account = { id: 'usr_1', name: 'Adaeze' };
const organisation = {
  id: 'org_1',
  name: 'Ìrè Events',
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  role: { id: 'role_1', seededAs: 'owner', name: null },
  permissions: ['organisation.manage'],
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('"Sign out" on the Settings list and the "This device" row', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisations.mockResolvedValue([organisation]);
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

    expect(useSignedIn()).toEqual({ account: null, organisations: [], organisation: null });
    expect(api.me).not.toHaveBeenCalled();
  });
});

describe('opening the signed-in home at launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is ready once the account and its organisations are read', async () => {
    api.me.mockResolvedValue(account);
    api.organisations.mockResolvedValue([organisation]);

    await expect(launchSignedIn()).resolves.toBe(true);
    expect(useSignedIn().organisation).toEqual(organisation);
  });

  it('is not, and opens sign-in, when the account cannot be read', async () => {
    api.me.mockRejectedValue(new Error('unauthorised'));
    api.organisations.mockResolvedValue([organisation]);

    await expect(launchSignedIn()).resolves.toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });
});

describe('an organisation saved from its page', () => {
  const other = { ...organisation, id: 'org_2', name: 'Okafor Weddings' };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.me.mockResolvedValue(account);
    api.organisations.mockResolvedValue([organisation, other]);
    await reloadSignedIn();
  });

  it('shows its new name in the switcher and on the list at once, with no second load', () => {
    replaceOrganisation({ ...organisation, name: 'Ìrè Events Ltd' });

    expect(useSignedIn().organisation?.name).toBe('Ìrè Events Ltd');
    expect(useSignedIn().organisations.map(({ name }) => name)).toEqual([
      'Ìrè Events Ltd',
      'Okafor Weddings',
    ]);
    expect(api.organisations).toHaveBeenCalledTimes(1);
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
    api.organisations.mockResolvedValue([organisation]);
    await reloadSignedIn();
    vi.clearAllMocks();
  });

  it('replaces the account and keeps the organisation, with no second organisations read', async () => {
    api.me.mockResolvedValue({ ...account, name: 'Adaeze Okafor' });

    await rereadAccount();

    expect(useSignedIn().account).toEqual({ ...account, name: 'Adaeze Okafor' });
    expect(useSignedIn().organisation).toEqual(organisation);
    expect(api.organisations).not.toHaveBeenCalled();
  });

  it('rejects when the read fails, keeps the account it had, and opens nothing', async () => {
    api.me.mockRejectedValue(new Error('offline'));

    await expect(rereadAccount()).rejects.toThrow('offline');
    expect(useSignedIn().account).toEqual(account);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
