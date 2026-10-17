import { describe, expect, it } from 'vitest';

import {
  levelOf,
  levelsOf,
  roleNameProblem,
  sameGrant,
  whatTheySee,
  withLevel,
  withMargin,
} from './roles.ts';

describe('a role in the permission grid', () => {
  it('reads an area as nothing, read or change', () => {
    const coordinator = ['events.read', 'events.manage', 'budget.read'];

    expect(levelOf(coordinator, 'events')).toBe('change');
    expect(levelOf(coordinator, 'budget')).toBe('read');
    expect(levelOf(coordinator, 'billing')).toBe('nothing');
  });

  it('offers Read only where the registry has a read permission', () => {
    expect(levelsOf(['events.read', 'events.manage'])).toEqual(['nothing', 'read', 'change']);
    expect(levelsOf(['organisation.manage'])).toEqual(['nothing', 'change']);
  });

  it('gives reading with change, and takes both away with nothing', () => {
    expect(withLevel(['guests.read'], 'events', 'change').sort()).toEqual(
      ['events.manage', 'events.read', 'guests.read'].sort(),
    );
    expect(withLevel(['events.read', 'events.manage'], 'events', 'read')).toEqual(['events.read']);
    expect(withLevel(['events.read', 'events.manage'], 'events', 'nothing')).toEqual([]);
  });

  it('takes the margin away with the budget, and keeps it when the budget is only read', () => {
    const held = ['budget.read', 'budget.manage', 'budget.margin'];

    expect(withLevel(held, 'budget', 'nothing')).toEqual([]);
    expect(withLevel(held, 'budget', 'read').sort()).toEqual(['budget.margin', 'budget.read']);
    expect(withMargin(['budget.read'], true)).toEqual(['budget.read', 'budget.margin']);
    expect(withMargin(['budget.read', 'budget.margin'], false)).toEqual(['budget.read']);
  });

  it('counts a grant unchanged whatever order it is in', () => {
    expect(sameGrant(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameGrant(['a'], ['a', 'b'])).toBe(false);
  });

  it('says which areas are hidden and which open with no buttons', () => {
    const held = ['events.read', 'events.manage', 'guests.read'];

    expect(whatTheySee(held, ['events', 'guests', 'billing'])).toEqual({
      hidden: ['billing'],
      readOnly: ['guests'],
    });
  });
});

describe('a role name', () => {
  const taken = ['Owner', 'Administrator', 'Door team'];

  it('is required, trimmed, and at most 40 characters', () => {
    expect(roleNameProblem('   ', taken)).toBe('nameBlank');
    expect(roleNameProblem('x'.repeat(41), taken)).toBe('nameTooLong');
    expect(roleNameProblem(` ${'x'.repeat(40)} `, taken)).toBeNull();
  });

  it('is unique in the organisation ignoring case, the seeded names included', () => {
    expect(roleNameProblem('door TEAM', taken)).toBe('nameTaken');
    expect(roleNameProblem('owner', taken)).toBe('nameTaken');
    expect(roleNameProblem('Venue lead', taken)).toBeNull();
  });
});
