import { beforeEach, describe, expect, it, vi } from 'vitest';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  isAvailableAsync: async () => true,
  setItemAsync: async (key: string, value: string) => void kept.set(key, value),
  getItemAsync: async (key: string) => kept.get(key) ?? null,
  deleteItemAsync: async (key: string) => void kept.delete(key),
  getItem: (key: string) => kept.get(key) ?? null,
  setItem: (key: string, value: string) => void kept.set(key, value),
}));
vi.mock('expo', () => ({ reloadAppAsync: async () => {} }));

const LAST_INSTALL = {
  'soirely.refreshToken': 'ada-refresh',
  'soirely.registration': JSON.stringify({ registration: 'r-1', email: 'ada@example.com' }),
  'soirely.twoFactorRecovery': 'recovery-1',
  'soirely.requestLink': JSON.stringify({ token: 'link-1', heldAt: Date.now() }),
};

async function launch() {
  vi.resetModules();

  return {
    ...(await import('./newInstall.ts')),
    ...(await import('./tokens.ts')),
    ...(await import('./pendingRegistration.ts')),
    ...(await import('./heldRecovery.ts')),
    ...(await import('./heldLink.ts')),
  };
}

beforeEach(() => {
  kept.clear();
  for (const [key, value] of Object.entries(LAST_INSTALL)) kept.set(key, value);
  globalThis.soirelyDeviceScheme = undefined;
});

describe('a reinstall is a new device (sc-34831)', () => {
  it('drops everything the last install kept, and ends its session', async () => {
    const app = await launch();
    const end = vi.fn(async () => {});

    await app.startAfresh(true, end);

    expect(await app.holdsSession()).toBe(false);
    expect(await app.heldRegistration()).toBeNull();
    expect(await app.heldRecovery()).toBeNull();
    expect(await app.takeHeldLink()).toBeNull();
    expect([...kept.keys()].filter((key) => kept.get(key) !== '')).toEqual([]);
    expect(end).toHaveBeenCalledWith('ada-refresh');
  });

  it('opens signed out when Soirely cannot be reached, and keeps no token to try again with', async () => {
    const app = await launch();

    await app.startAfresh(true, async () => {
      throw new TypeError('Network request failed');
    });

    expect(await app.holdsSession()).toBe(false);
    expect(kept.has('soirely.refreshToken')).toBe(false);
  });

  it('ends nothing when the last install held no session', async () => {
    kept.delete('soirely.refreshToken');
    const app = await launch();
    const end = vi.fn(async () => {});

    await app.startAfresh(true, end);

    expect(end).not.toHaveBeenCalled();
  });

  it('keeps the session on any launch but an install’s first', async () => {
    const app = await launch();
    const end = vi.fn(async () => {});

    await app.startAfresh(false, end);

    expect(await app.holdsSession()).toBe(true);
    expect(await app.heldRegistration()).not.toBeNull();
    expect(end).not.toHaveBeenCalled();
  });

  it('restarts into the default colours only once the old session has ended', async () => {
    kept.set('soirely.colourScheme', 'berry');
    globalThis.soirelyDeviceScheme = 'berry';
    const app = await launch();
    const order: string[] = [];

    await app.startAfresh(
      true,
      async () => {
        await new Promise((done) => setTimeout(done, 10));
        order.push('ended');
      },
      async () => void order.push('restarted'),
    );

    expect(order).toEqual(['ended', 'restarted']);
  });

  it('restarts after three seconds when the old session never finishes ending', async () => {
    kept.set('soirely.colourScheme', 'berry');
    globalThis.soirelyDeviceScheme = 'berry';
    const app = await launch();
    const restart = vi.fn(async () => {});
    vi.useFakeTimers();

    try {
      const starting = app.startAfresh(true, () => new Promise<void>(() => {}), restart);

      await vi.advanceTimersByTimeAsync(2999);
      expect(restart).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await starting;
      expect(restart).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
