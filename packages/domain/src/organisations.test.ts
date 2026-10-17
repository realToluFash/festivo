import { describe, expect, it } from 'vitest';

import {
  chooseOrganisation,
  organisationChanges,
  organisationProblem,
  roleHolds,
  roleName,
  withCurrent,
} from './organisations.ts';

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

describe('roleHolds', () => {
  it('gives the owner every permission', () => {
    expect(roleHolds({ seededAs: 'owner' }, 'organisation.manage')).toBe(true);
  });

  it('gives every other role none until sc-66', () => {
    expect(roleHolds({ seededAs: 'event_manager' }, 'organisation.manage')).toBe(false);
    expect(roleHolds({ seededAs: null }, 'organisation.manage')).toBe(false);
  });

  it('holds no unnamed permission', () => {
    expect(roleHolds({ seededAs: 'owner' }, '')).toBe(false);
  });
});

describe('organisationProblem', () => {
  it('refuses a blank name, spaces included', () => {
    expect(organisationProblem('name', '  ')).toBe('nameBlank');
    expect(organisationProblem('name', 'Ìrè Events')).toBeNull();
  });

  it('refuses a blank contact address, and one not shaped like an email', () => {
    expect(organisationProblem('contactAddress', '')).toBe('contactBlank');
    expect(organisationProblem('contactAddress', 'hello@ire')).toBe('contactInvalid');
    expect(organisationProblem('contactAddress', ' hello@ire.events ')).toBeNull();
  });

  it('has nothing to say about a picked value', () => {
    expect(organisationProblem('countryCode', '')).toBeNull();
    expect(organisationProblem('currency', '')).toBeNull();
    expect(organisationProblem('timezone', '')).toBeNull();
  });
});

describe('organisationChanges', () => {
  const saved = {
    name: 'Ìrè Events',
    countryCode: 'NG',
    contactAddress: 'hello@ire.events',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
  };

  it('sends only what changed, trimmed', () => {
    expect(organisationChanges(saved, { ...saved, name: ' Ìrè Events Ltd ' })).toEqual({
      name: 'Ìrè Events Ltd',
    });
  });

  it('sends nothing when nothing changed', () => {
    expect(organisationChanges(saved, { ...saved, contactAddress: 'hello@ire.events ' })).toEqual(
      {},
    );
  });
});

describe('withCurrent', () => {
  it('keeps the list as it is when the stored value is in it', () => {
    expect(withCurrent(['EUR', 'NGN', 'USD'], 'NGN')).toEqual(['EUR', 'NGN', 'USD']);
  });

  it('offers a stored value the list lacks first, so saving never replaces it', () => {
    expect(withCurrent(['Africa/Lagos', 'Europe/Kyiv'], 'Europe/Kiev')).toEqual([
      'Europe/Kiev',
      'Africa/Lagos',
      'Europe/Kyiv',
    ]);
  });
});
