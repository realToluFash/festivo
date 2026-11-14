import { describe, expect, it } from 'vitest';

import { keysGoDownFor } from './refusedField.ts';

describe('whether a refusal puts the keys down (sc-43907)', () => {
  it('keeps them up for a typed field it focuses', () => {
    expect(keysGoDownFor('venueName')).toBe(false);
    expect(keysGoDownFor('name')).toBe(false);
  });

  it('puts them down for a picker it focuses', () => {
    expect(keysGoDownFor('type')).toBe(true);
    expect(keysGoDownFor('startsAt')).toBe(true);
  });

  it('leaves them be with no field to focus', () => {
    expect(keysGoDownFor(null)).toBe(false);
  });
});
