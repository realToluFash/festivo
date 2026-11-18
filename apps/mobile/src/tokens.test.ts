import { beforeEach, describe, expect, it, vi } from 'vitest';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  isAvailableAsync: async () => true,
  setItemAsync: async (key: string, value: string) => void kept.set(key, value),
  getItemAsync: async (key: string) => kept.get(key) ?? null,
  deleteItemAsync: async (key: string) => void kept.delete(key),
}));

const REFRESH_KEY = 'soirely.refreshToken';

async function launch() {
  vi.resetModules();

  return import('./tokens.ts');
}

describe('whether this device holds a session', () => {
  beforeEach(() => kept.clear());

  it('holds none when nothing is kept', async () => {
    const { holdsSession } = await launch();

    expect(await holdsSession()).toBe(false);
  });

  it('holds one offline, from the kept refresh token with no access token in memory', async () => {
    kept.set(REFRESH_KEY, 'the-refresh-token');
    const { holdsSession, tokens } = await launch();

    expect(tokens.access()).toBeNull();
    expect(await holdsSession()).toBe(true);
  });

  it('holds none after Sign out', async () => {
    kept.set(REFRESH_KEY, 'the-refresh-token');
    const { holdsSession, tokens } = await launch();

    await tokens.clear();

    expect(await holdsSession()).toBe(false);
  });

  it('holds none when the kept token is empty', async () => {
    kept.set(REFRESH_KEY, '');
    const { holdsSession } = await launch();

    expect(await holdsSession()).toBe(false);
  });
});
