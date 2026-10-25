import { type Account } from '@soirely/api-client';
import i18next from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { chooseLanguage, followAccount, followSavedLanguage } from './accountLanguage.ts';
import { setLanguage, storedLanguage } from './i18n/index.ts';

const ACCOUNT: Account = {
  id: 'acc_1',
  name: 'Folake',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  twoFactorSetupPrompt: false,
  waitingFor: null,
  providers: [],
  emailAddresses: [],
  phoneNumbers: [],
};

function saved(): { path: string; body: unknown }[] {
  const sent: { path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    sent.push({
      path: `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });

    return new Response(JSON.stringify({ locale: 'x' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return sent;
}

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await setLanguage(null);
});

describe('the account remembers its language', () => {
  it('saves a choice made signed in to the account', async () => {
    const sent = saved();

    await chooseLanguage('fr', true);

    expect(sent).toEqual([{ path: 'PUT /api/auth/locale', body: { locale: 'fr' } }]);
    expect(i18next.language).toBe('fr');
  });

  it('keeps a choice made signed out on this device, and saves it at the next sign-in', async () => {
    const sent = saved();

    await chooseLanguage('pt', false);
    expect(sent).toEqual([]);

    await followAccount({ ...ACCOUNT, locale: 'en' });

    expect(sent).toEqual([{ path: 'PUT /api/auth/locale', body: { locale: 'pt' } }]);
    expect(i18next.language).toBe('pt');
  });

  it('opens a second device in the account language', async () => {
    const sent = saved();

    await followAccount({ ...ACCOUNT, locale: 'es' });

    expect(i18next.language).toBe('es');
    expect(sent).toEqual([]);
  });
});

describe('the signed-in app shows the account language (sc-9797)', () => {
  it('goes back to the account language after Automatic was picked outside the app', async () => {
    const sent = saved();
    await followAccount({ ...ACCOUNT, locale: 'es' });

    await chooseLanguage(null, true);
    expect(storedLanguage()).toBeNull();

    await followSavedLanguage();

    expect(i18next.language).toBe('es');
    expect(sent).toEqual([]);
  });

  it('keeps a language whose save went through', async () => {
    saved();
    await followAccount({ ...ACCOUNT, locale: 'es' });
    await chooseLanguage('fr', true);

    await followSavedLanguage();

    expect(i18next.language).toBe('fr');
  });

  it('goes back to the account language when the save failed', async () => {
    await followAccount({ ...ACCOUNT, locale: 'es' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await chooseLanguage('fr', true);
    expect(i18next.language).toBe('fr');

    await followSavedLanguage();

    expect(i18next.language).toBe('es');
  });

  it('follows the browser, and saves nothing, for an account with none of the four', async () => {
    const sent = saved();

    await followAccount({ ...ACCOUNT, locale: 'de' });
    await followSavedLanguage();

    expect(storedLanguage()).toBeNull();
    expect(sent).toEqual([]);
  });
});
