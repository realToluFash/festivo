import { beforeAll, describe, expect, it, vi } from 'vitest';

import { dateLocale, initI18n, setLanguage } from './index.ts';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => kept.get(key) ?? null,
    setItem: async (key: string, value: string) => void kept.set(key, value),
    removeItem: async (key: string) => void kept.delete(key),
  },
}));
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB' }, { languageTag: 'fr-FR' }],
}));

describe('the locale dates are written in', () => {
  beforeAll(async () => {
    await initI18n();
  });

  it("keeps an en-GB phone's region on an English screen", async () => {
    await setLanguage('en');

    expect(dateLocale()).toBe('en-GB');
  });

  it('writes a language picked on that phone alone, never es-GB', async () => {
    await setLanguage('es');

    expect(dateLocale()).toBe('es');
  });
});
