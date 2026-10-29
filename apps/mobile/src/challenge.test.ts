import { type Account } from '@soirely/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dropChallenge,
  heldChallenge,
  nextAfterRegistration,
  nextAfterSignIn,
} from './challenge.ts';
import { holdLink } from './heldLink.ts';

const kept = vi.hoisted(() => new Map<string, string>());
const followAccount = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('./accountLanguage.ts', () => ({ followAccount }));

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  isAvailableAsync: async () => true,
  setItemAsync: async (key: string, value: string) => void kept.set(key, value),
  getItemAsync: async (key: string) => kept.get(key) ?? null,
  deleteItemAsync: async (key: string) => void kept.delete(key),
}));

const CHALLENGE = {
  kind: 'twoFactor' as const,
  challenge: 'the-challenge',
  expiresAt: '2026-10-17T12:05:00+00:00',
  email: 'folake@ire.events',
};

describe('where a sign-in goes next', () => {
  it('goes to the code screen, holding the challenge in memory, when two-factor asks', async () => {
    followAccount.mockClear();

    expect(await nextAfterSignIn(CHALLENGE)).toBe('/sign-in-code');
    expect(heldChallenge()).toEqual(CHALLENGE);
    expect(followAccount).not.toHaveBeenCalled();
  });

  it('drops any held challenge once tokens come back', async () => {
    await nextAfterSignIn(CHALLENGE);

    const next = await nextAfterSignIn({
      tokens: { accessToken: 'a', refreshExpiresAt: '2026-11-17T12:00:00+00:00', sessionId: 's' },
      account: {
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
        emailAddresses: [],
        phoneNumbers: [],
        providers: [],
      },
      linked: false,
    });

    expect(next).toBe('/');
    expect(heldChallenge()).toBeNull();
    dropChallenge();
  });

  it('asks to set two-factor up again first after an approved recovery', async () => {
    const next = await nextAfterSignIn({
      tokens: { accessToken: 'a', refreshExpiresAt: '2026-11-17T12:00:00+00:00', sessionId: 's' },
      account: {
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
        twoFactorSetupPrompt: true,
        waitingFor: null,
        emailAddresses: [],
        phoneNumbers: [],
        providers: [],
      },
      linked: false,
    });

    expect(next).toBe('/two-factor-again');
  });

  it("follows the account's language before saying where to go (sc-8006)", async () => {
    followAccount.mockClear();
    const account = {
      id: 'acc_2',
      name: 'Bisi',
      businessName: null,
      countryCode: null,
      organisationCountry: null,
      locale: 'fr',
      timezone: null,
      verified: false,
      complete: false,
      needsOrganisation: false,
      hasPassword: true,
      twoFactorSetupPrompt: false,
      waitingFor: null,
      emailAddresses: [],
      phoneNumbers: [],
      providers: [],
    };

    await nextAfterSignIn({
      tokens: { accessToken: 'a', refreshExpiresAt: '2026-11-17T12:00:00+00:00', sessionId: 's' },
      account,
      linked: false,
    });

    expect(followAccount).toHaveBeenCalledWith(account);
  });

  it('comes back to a request link opened signed out, once (sc-562)', async () => {
    const signIn = () =>
      nextAfterSignIn({
        tokens: { accessToken: 'a', refreshExpiresAt: '2026-11-17T12:00:00+00:00', sessionId: 's' },
        account: {
          id: 'acc_1',
          name: 'Ada',
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
          emailAddresses: [],
          phoneNumbers: [],
          providers: [],
        },
        linked: false,
      });
    await holdLink('cd'.repeat(16));

    expect(await signIn()).toBe(`/join/${'cd'.repeat(16)}`);
    expect(await signIn()).toBe('/');
  });

  it('comes back to the link after the OS closed the app in between (sc-562)', async () => {
    await holdLink('ef'.repeat(16));
    vi.resetModules();
    const { takeHeldLink } = await import('./heldLink.ts');

    expect(await takeHeldLink()).toBe('ef'.repeat(16));
    expect(await takeHeldLink()).toBeNull();
  });
});

const ACCOUNT: Account = {
  id: 'acc_1',
  name: 'Ada',
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
  emailAddresses: [],
  phoneNumbers: [],
  providers: [],
};

const HELD_AT = new Date('2026-10-29T09:00:00Z');
const MINUTE = 60 * 1000;
const LINK = 'ab'.repeat(16);

const takes = {
  'a sign-in': () =>
    nextAfterSignIn({
      tokens: { accessToken: 'a', refreshExpiresAt: '2026-11-29T09:00:00+00:00', sessionId: 's' },
      account: ACCOUNT,
      linked: false,
    }),
  'a code accepted on Check your email': () => nextAfterRegistration(ACCOUNT),
};

describe.each(Object.entries(takes))('a held request link, taken by %s (sc-19752)', (_, take) => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function heldAgo(minutes: number): Promise<void> {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HELD_AT);
    await holdLink(LINK);
    vi.setSystemTime(HELD_AT.getTime() + minutes * MINUTE);
  }

  it('is followed 23 h 59 min after it was held', async () => {
    await heldAgo(24 * 60 - 1);

    expect(await take()).toBe(`/join/${LINK}`);
  });

  it('is dropped exactly 24 h after it was held', async () => {
    await heldAgo(24 * 60);

    expect(await take()).toBe('/');
  });

  it('is deleted from the device once lapsed, so a second take finds nothing', async () => {
    await heldAgo(24 * 60);
    await take();
    vi.setSystemTime(HELD_AT);

    expect(kept.has('soirely.requestLink')).toBe(false);
    expect(await take()).toBe('/');
  });

  it('is dropped, and deleted, when an earlier build held it with no time beside it', async () => {
    kept.set('soirely.requestLink', LINK);

    expect(await take()).toBe('/');
    expect(kept.has('soirely.requestLink')).toBe(false);
  });
});
