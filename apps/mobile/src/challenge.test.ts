import { describe, expect, it } from 'vitest';

import { dropChallenge, heldChallenge, nextAfterSignIn } from './challenge.ts';

const CHALLENGE = {
  kind: 'twoFactor' as const,
  challenge: 'the-challenge',
  expiresAt: '2026-10-17T12:05:00+00:00',
  email: 'folake@ire.events',
};

describe('where a sign-in goes next', () => {
  it('goes to the code screen, holding the challenge in memory, when two-factor asks', () => {
    expect(nextAfterSignIn(CHALLENGE)).toBe('/sign-in-code');
    expect(heldChallenge()).toEqual(CHALLENGE);
  });

  it('drops any held challenge once tokens come back', () => {
    nextAfterSignIn(CHALLENGE);

    const next = nextAfterSignIn({
      tokens: { accessToken: 'a', refreshExpiresAt: '2026-11-17T12:00:00+00:00', sessionId: 's' },
      account: {
        id: 'acc_1',
        name: 'Folake',
        businessName: null,
        countryCode: null,
        locale: 'en',
        verified: true,
        complete: true,
        needsOrganisation: false,
        hasPassword: true,
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
});
