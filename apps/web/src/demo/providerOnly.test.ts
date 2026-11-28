import { describe, expect, it } from 'vitest';

import { providerNames } from './providerOnly.ts';

describe('providerNames', () => {
  it('names Google first whatever order the API lists them in (sc-96668)', () => {
    expect(providerNames(['apple', 'google'])).toBe('Google or Apple');
    expect(providerNames(['google', 'apple'])).toBe('Google or Apple');
  });

  it('names one provider alone', () => {
    expect(providerNames(['google'])).toBe('Google');
    expect(providerNames(['apple'])).toBe('Apple');
  });
});
