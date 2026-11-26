import { keptServiceTap } from '@soirely/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storedServiceTaps } from './serviceTaps.ts';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => kept.get(key) ?? null,
    setItem: async (key: string, value: string) => void kept.set(key, value),
    removeItem: async (key: string) => void kept.delete(key),
  },
}));

const tap = keptServiceTap(
  'evt-1',
  { kind: 'check', trayId: 't1' },
  { plates: { p1: 'dishing' } },
  'k1',
);

beforeEach(() => kept.clear());

describe('service taps kept on the phone', () => {
  it('are there after the app is closed and opened again, and gone once sent', async () => {
    await storedServiceTaps('evt-1').save([tap]);

    expect(await storedServiceTaps('evt-1').load()).toEqual([tap]);
    expect(await storedServiceTaps('evt-2').load()).toEqual([]);

    await storedServiceTaps('evt-1').save([]);
    expect(kept.size).toBe(0);
  });

  it('read nothing from a store that holds something else', async () => {
    kept.set('soirely.serviceTaps.evt-1', '{not json');

    expect(await storedServiceTaps('evt-1').load()).toEqual([]);
  });
});
