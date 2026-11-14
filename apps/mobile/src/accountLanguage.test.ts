import { type Account } from '@soirely/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { followAccount } from './accountLanguage.ts';

const kept = vi.hoisted(() => new Map<string, string>());
const setLocale = vi.hoisted(() => vi.fn(async (_locale: string) => {}));
const setLanguage = vi.hoisted(() =>
  vi.fn(async (locale: string | null) => void (locale != null && kept.set('device', locale))),
);

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => kept.get(key) ?? null,
    setItem: async (key: string, value: string) => void kept.set(key, value),
    removeItem: async (key: string) => void kept.delete(key),
  },
}));
vi.mock('./api.ts', () => ({ api: { setLocale } }));
vi.mock('./tokens.ts', () => ({ tokens: { access: async () => null } }));
vi.mock('./i18n/index.ts', () => ({
  setLanguage,
  storedLanguage: async () => kept.get('device') ?? null,
}));

const CHOSEN = 'soirely:language:chosen-signed-out';
const inEnglish = { id: 'a', locale: 'en' } as Account;
const another = { id: 'b', locale: 'en' } as Account;

describe('following the account on reaching the signed-in app', () => {
  beforeEach(() => {
    kept.clear();
    setLocale.mockReset();
    setLanguage.mockClear();
  });

  it('keeps a choice made signed out when saving it fails, and the next follow saves it', async () => {
    kept.set('device', 'fr');
    kept.set(CHOSEN, '1');
    setLocale.mockRejectedValueOnce(new Error('500'));

    await followAccount(inEnglish);
    await followAccount(inEnglish);

    expect(kept.get('device')).toBe('fr');
    expect(setLanguage).not.toHaveBeenCalled();
    expect(setLocale).toHaveBeenLastCalledWith('fr');
    expect(kept.has(CHOSEN)).toBe(false);
  });

  it('leaves a choice whose save failed out of the next account to sign in', async () => {
    kept.set('device', 'fr');
    kept.set(CHOSEN, '1');
    setLocale.mockRejectedValueOnce(new Error('500'));

    await followAccount(inEnglish);
    await followAccount(another);

    expect(setLocale).toHaveBeenCalledTimes(1);
    expect(setLanguage).toHaveBeenLastCalledWith('en');
    expect(kept.get('device')).toBe('en');
    expect(kept.has(CHOSEN)).toBe(false);
  });

  it('follows the account once the choice is saved', async () => {
    kept.set('device', 'fr');
    kept.set(CHOSEN, '1');

    await followAccount(inEnglish);

    expect(kept.has(CHOSEN)).toBe(false);
    expect(setLanguage).not.toHaveBeenCalled();
  });

  it('never throws when the language cannot be applied', async () => {
    kept.set('device', 'fr');
    setLanguage.mockRejectedValueOnce(new Error('storage full'));

    await expect(followAccount(inEnglish)).resolves.toBeUndefined();
  });
});
