import { describe, expect, it } from 'vitest';

import { providerList } from './providerList.ts';

describe('the providers a refusal names', () => {
  it('names Google first whatever order the API lists them in (sc-96668)', () => {
    expect(providerList(['apple', 'google'])).toBe('Google or Apple');
    expect(providerList(['google', 'apple'])).toBe('Google or Apple');
  });

  it('names one provider alone', () => {
    expect(providerList(['apple'])).toBe('Apple');
    expect(providerList(['google'])).toBe('Google');
  });
});
