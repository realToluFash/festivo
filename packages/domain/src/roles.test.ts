import { describe, expect, it } from 'vitest';

import {
  extrasOf,
  levelOf,
  levelsOf,
  roleNameProblem,
  sameGrant,
  settableLevels,
  whatTheySee,
  withLevel,
  withExtra,
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

  const events = ['events.read', 'events.manage'];
  const budget = ['budget.read', 'budget.manage', 'budget.margin'];

  it('gives reading with change, and takes both away with nothing', () => {
    expect(withLevel(['guests.read'], 'events', 'change', events).sort()).toEqual(
      ['events.manage', 'events.read', 'guests.read'].sort(),
    );
    expect(withLevel(events, 'events', 'read', events)).toEqual(['events.read']);
    expect(withLevel(events, 'events', 'nothing', events)).toEqual([]);
  });

  it('gives change alone where the area has no read permission', () => {
    expect(withLevel([], 'organisation', 'change', ['organisation.manage'])).toEqual([
      'organisation.manage',
    ]);
  });

  it('takes the margin away with the budget, and keeps it when the budget is only read', () => {
    const held = ['budget.read', 'budget.manage', 'budget.margin'];

    expect(withLevel(held, 'budget', 'nothing', budget)).toEqual([]);
    expect(withLevel(held, 'budget', 'read', budget).sort()).toEqual([
      'budget.margin',
      'budget.read',
    ]);
    expect(withExtra(['budget.read'], 'budget.margin', true)).toEqual([
      'budget.read',
      'budget.margin',
    ]);
    expect(withExtra(['budget.read', 'budget.margin'], 'budget.margin', false)).toEqual([
      'budget.read',
    ]);
  });

  const creating = ['events.read', 'events.manage', 'events.create'];

  it('takes creating events away with the events area, and keeps it when events are only read', () => {
    expect(extrasOf('events', creating)).toEqual(['events.create']);
    expect(extrasOf('budget', budget)).toEqual(['budget.margin']);
    expect(withLevel(creating, 'events', 'nothing', creating)).toEqual([]);
    expect(withLevel(creating, 'events', 'read', creating).sort()).toEqual([
      'events.create',
      'events.read',
    ]);
    expect(withExtra(['events.read'], 'events.create', true)).toEqual([
      'events.read',
      'events.create',
    ]);
  });

  it("leaves another area's extras alone", () => {
    expect(withLevel(['budget.margin', ...creating], 'events', 'nothing', creating)).toEqual([
      'budget.margin',
    ]);
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

  it('is the same name however its accents were typed (sc-2766)', () => {
    expect(roleNameProblem('So\u0301 leitura', ['Só leitura'])).toBe('nameTaken');
    expect(roleNameProblem('Équipe bar', ['E\u0301quipe bar'])).toBe('nameTaken');
    expect(roleNameProblem('e\u0301'.repeat(40), taken)).toBeNull();
    expect(roleNameProblem('e\u0301'.repeat(41), taken)).toBe('nameTooLong');
  });

  it('folds only canonical equivalents', () => {
    expect(
      roleNameProblem('\uFF23\uFF4F\uFF4F\uFF52\uFF44\uFF49\uFF4E\uFF41\uFF44\uFF4F\uFF52', [
        'Coordinador',
      ]),
    ).toBeNull();
    expect(roleNameProblem('\uFB01nance', ['finance'])).toBeNull();
  });
});

describe('the levels a caller can set', () => {
  const billing = ['billing.read', 'billing.manage'];
  const budget = ['budget.read', 'budget.manage', 'budget.margin'];

  it('offers the levels the caller holds on a row they hold part of', () => {
    expect(settableLevels([], ['billing.read'], 'billing', billing)).toEqual(['nothing', 'read']);
  });

  it('offers only the current value when it is above what the caller holds', () => {
    expect(settableLevels(billing, ['billing.read'], 'billing', billing)).toEqual(['change']);
  });

  it('keeps Nothing off events whose creating the caller does not hold', () => {
    const events = ['events.read', 'events.manage', 'events.create'];

    expect(settableLevels(events, ['events.read', 'events.manage'], 'events', events)).toEqual([
      'read',
      'change',
    ]);
  });

  it('keeps Nothing off a budget whose margin the caller does not hold', () => {
    const held = ['budget.read', 'budget.manage'];

    expect(settableLevels(['budget.read', 'budget.margin'], held, 'budget', budget)).toEqual([
      'read',
      'change',
    ]);
  });
});
