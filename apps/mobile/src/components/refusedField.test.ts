import { describe, expect, it } from 'vitest';

import { keysGoDownFor, sectionQuiet } from './refusedField.ts';

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

describe('which sections a refused picker hides from TalkBack (sc-43907)', () => {
  it('hides every section after Type, from the hosts to the currency', () => {
    for (const section of [
      'hosts',
      'cover',
      'startsAt',
      'endsAt',
      'venueName',
      'timeZone',
      'currency',
    ] as const)
      expect(sectionQuiet('type', section)).toBe(true);
    expect(sectionQuiet('type', 'type')).toBe(false);
  });

  it('hides only what follows Starts, never Starts itself', () => {
    expect(sectionQuiet('startsAt', 'cover')).toBe(false);
    expect(sectionQuiet('startsAt', 'startsAt')).toBe(false);
    expect(sectionQuiet('startsAt', 'endsAt')).toBe(true);
  });

  it('hides nothing after Currency, the last section', () => {
    expect(sectionQuiet('currency', 'currency')).toBe(false);
    expect(sectionQuiet('currency', 'timeZone')).toBe(false);
  });

  it('hides nothing with no refused picker', () => {
    expect(sectionQuiet(null, 'currency')).toBe(false);
  });
});
