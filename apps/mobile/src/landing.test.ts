import { describe, expect, it } from 'vitest';

import { landingFor } from './landing.ts';

describe('where an account lands', () => {
  it('verifies the email, then a phone it has, then completes, then reaches the app', () => {
    expect(landingFor('email')).toBe('/verify-email');
    expect(landingFor('phone')).toBe('/verify-phone?from=onboarding');
    expect(landingFor('details')).toBe('/complete-profile');
    expect(landingFor(null)).toBe('/');
  });
});
