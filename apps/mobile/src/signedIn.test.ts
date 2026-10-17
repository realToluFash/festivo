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

const { launchSignedIn, reloadSignedIn, signOutHere, useSignedIn } = await import('./signedIn.ts');

const account = { id: 'usr_1', name: 'Adaeze' };
const organisation = {
  id: 'org_1',
  name: 'Ìrè Events',
  role: { id: 'role_1', seededAs: 'owner', name: null },
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
