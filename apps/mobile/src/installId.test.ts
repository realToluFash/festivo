import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installId, loadInstallId } from './installId.ts';

const kept = vi.hoisted(() => new Map<string, string>());
const failing = vi.hoisted(() => ({ read: false }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (failing.read) throw new Error('storage unavailable');

      return kept.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => void kept.set(key, value),
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'fresh-id' }));

describe('loading the install id', () => {
  beforeEach(() => {
    kept.clear();
    failing.read = false;
  });

  it('counts an install with no id kept as its first launch, and keeps a new one', async () => {
    expect(await loadInstallId()).toBe(true);
    expect(installId()).toBe('fresh-id');
    expect(kept.get('soirely.installId')).toBe('fresh-id');
  });

  it('does not count a launch that finds an id kept as the first', async () => {
    kept.set('soirely.installId', 'earlier-id');

    expect(await loadInstallId()).toBe(false);
    expect(installId()).toBe('earlier-id');
  });

  it('does not count a launch whose storage cannot be read as the first', async () => {
    failing.read = true;

    expect(await loadInstallId()).toBe(false);
    expect(installId()).toBe('fresh-id');
  });
});
