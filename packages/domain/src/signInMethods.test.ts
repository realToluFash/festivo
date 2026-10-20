import { describe, expect, it } from 'vitest';

import { proofStands, proveWith, providerRows } from './signInMethods.ts';

const GOOGLE = { provider: 'google' as const, email: 'folake.adeyemi@gmail.com' };
const APPLE = { provider: 'apple' as const, email: null };

describe('the ways an account signs in', () => {
  it('offers to link each provider not yet linked', () => {
    expect(providerRows(true, []).map((row) => [row.provider, row.canLink])).toEqual([
      ['google', true],
      ['apple', true],
    ]);
  });

  it('lets a provider go while a password remains', () => {
    const [google] = providerRows(true, [GOOGLE]);

    expect(google).toEqual({
      provider: 'google',
      email: 'folake.adeyemi@gmail.com',
      linked: true,
      canLink: false,
      canUnlink: true,
      last: false,
    });
  });

  it('never offers to remove the last way in', () => {
    const [google, apple] = providerRows(false, [GOOGLE]);

    expect(google?.canUnlink).toBe(false);
    expect(google?.last).toBe(true);
    expect(apple?.last).toBe(false);
  });

  it('lets either go while the other is linked', () => {
    expect(providerRows(false, [GOOGLE, APPLE]).map((row) => row.canUnlink)).toEqual([true, true]);
  });
});

describe('confirming it is you', () => {
  it('asks for the password when there is one', () => {
    expect(proveWith(true, [GOOGLE], 'google')).toBe('password');
  });

  it('else the provider being unlinked, or the one linked when linking another', () => {
    expect(proveWith(false, [GOOGLE, APPLE], 'apple')).toBe('apple');
    expect(proveWith(false, [GOOGLE], 'apple')).toBe('google');
  });

  it('holds a proof until just before it lapses', () => {
    const now = new Date('2026-10-17T12:00:00Z');

    expect(proofStands('2026-10-17T12:05:00+00:00', now)).toBe(true);
    expect(proofStands('2026-10-17T12:00:05+00:00', now)).toBe(false);
    expect(proofStands(null, now)).toBe(false);
  });
});
