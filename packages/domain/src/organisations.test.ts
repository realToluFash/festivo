import { describe, expect, it } from 'vitest';

import { chooseOrganisation, roleName } from './organisations.ts';

const ire = { id: 'org_ire' };
const okafor = { id: 'org_okafor' };

describe('chooseOrganisation', () => {
  it('keeps the organisation remembered on this device', () => {
    expect(chooseOrganisation([ire, okafor], 'org_okafor')).toBe(okafor);
  });

  it('falls back to the first when nothing is remembered, or the account has left it', () => {
    expect(chooseOrganisation([ire, okafor], null)).toBe(ire);
    expect(chooseOrganisation([ire, okafor], 'org_gone')).toBe(ire);
  });

  it('is in no organisation when the account has none', () => {
    expect(chooseOrganisation([], 'org_ire')).toBeNull();
  });
});

describe('roleName', () => {
  const word = (key: string) => `«${key}»`;

  it('words a seeded role in the reader’s language', () => {
    expect(roleName(word, { seededAs: 'owner', name: null })).toBe('«roles.owner»');
  });

  it('keeps the name of a role the organisation made', () => {
    expect(roleName(word, { seededAs: null, name: 'Door staff' })).toBe('Door staff');
    expect(roleName(word, { seededAs: null, name: null })).toBe('');
  });
});
