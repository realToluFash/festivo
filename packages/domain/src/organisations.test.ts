import { describe, expect, it } from 'vitest';

import {
  chooseOrganisation,
  choosePaused,
  pausedSwitch,
  pausedReasonKey,
  organisationChanges,
  newOrganisationProblem,
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

describe('pausedSwitch', () => {
  it('offers nothing with no other active organisation', () => {
    expect(pausedSwitch([])).toBeNull();
  });

  it('opens the only other one directly', () => {
    expect(pausedSwitch([okafor])).toBe(okafor);
  });

  it('opens the switcher with two or more', () => {
    expect(pausedSwitch([ire, okafor])).toBe('switcher');
  });
});

describe('choosePaused', () => {
  it('shows the paused organisation this device was working in', () => {
    expect(choosePaused([ire], 'org_ire', 1)).toBe(ire);
  });

  it('opens an organisation that still works rather than one somebody was not in', () => {
    expect(choosePaused([ire], 'org_okafor', 1)).toBeNull();
    expect(choosePaused([ire], null, 1)).toBeNull();
  });

  it('shows the first paused one to an account with nothing else to open', () => {
    expect(choosePaused([ire, okafor], null, 0)).toBe(ire);
    expect(choosePaused([], null, 0)).toBeNull();
  });
});

describe('pausedReasonKey', () => {
  it('words each of the three reasons', () => {
    expect(pausedReasonKey('address_gone')).toBe('accessPaused.becauseAddressGone');
    expect(pausedReasonKey('domain_closed')).toBe('accessPaused.becauseDomainClosed');
    expect(pausedReasonKey('domain_managed_elsewhere')).toBe(
      'accessPaused.becauseManagedElsewhere',
    );
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
  it('holds what the role was given, and nothing else', () => {
    const coordinator = { permissions: ['events.read', 'events.manage'] };

    expect(roleHolds(coordinator, 'events.manage')).toBe(true);
    expect(roleHolds(coordinator, 'organisation.manage')).toBe(false);
    expect(roleHolds({ permissions: [] }, 'events.read')).toBe(false);
  });

  it('holds no unnamed permission', () => {
    expect(roleHolds({ permissions: [''] }, '')).toBe(false);
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
    expect(organisationProblem('locale', '')).toBeNull();
  });
});

describe('organisationChanges', () => {
  const saved = {
    name: 'Ìrè Events',
    countryCode: 'NG',
    contactAddress: 'hello@ire.events',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    locale: 'en',
  };

  it('sends only what changed, trimmed', () => {
    expect(organisationChanges(saved, { ...saved, name: ' Ìrè Events Ltd ' })).toEqual({
      name: 'Ìrè Events Ltd',
    });
  });

  it('sends a new language like any other field', () => {
    expect(organisationChanges(saved, { ...saved, locale: 'pt' })).toEqual({ locale: 'pt' });
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

describe('newOrganisationProblem', () => {
  it('asks for a name that is only spaces', () => {
    expect(newOrganisationProblem('name', '   ')).toEqual({ kind: 'nameBlank' });
  });

  it('counts the name after trimming, in characters rather than bytes', () => {
    expect(newOrganisationProblem('name', `  ${'é'.repeat(100)}  `)).toBeNull();
    expect(newOrganisationProblem('name', 'é'.repeat(101))).toEqual({
      kind: 'nameLong',
      length: 101,
    });
  });

  it('asks for a country when the device named none', () => {
    expect(newOrganisationProblem('countryCode', '')).toEqual({ kind: 'countryBlank' });
    expect(newOrganisationProblem('countryCode', 'NG')).toBeNull();
  });
});
