import { describe, expect, it } from 'vitest';

import {
  MARGIN,
  extrasOf,
  grantableRoles,
  levelOf,
  levelsOf,
  lockedAreas,
  replacementsFor,
  roleNameProblem,
  sameGrant,
  settableLevels,
  shownHolders,
  takenRoleNames,
  whatTheySee,
  withLevel,
  withExtra,
  withheldRoles,
  withoutRole,
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

describe('removing a role', () => {
  const holder = (name: string) => ({ name, suspended: false });
  const planner = {
    id: 'planner',
    holders: 3,
    holderNames: [holder('bisi Ade'), holder('Zara Bello'), holder('Émeka Obi')],
    permissions: ['events.read', 'events.manage'],
  };
  const viewer = {
    id: 'viewer',
    holders: 1,
    holderNames: [holder('Ada Okeke')],
    permissions: ['events.read'],
  };
  const treasurer = {
    id: 'treasurer',
    holders: 2,
    holderNames: [holder('Kemi'), holder('Tope')],
    permissions: ['billing.manage'],
  };
  const roles = [planner, viewer, treasurer];

  it('moves its members only to another role the caller holds all of', () => {
    expect(replacementsFor(roles, planner, ['events.read', 'events.manage'])).toEqual([viewer]);
  });

  it('counts and names its members on the role they moved to, alphabetically', () => {
    expect(withoutRole(roles, planner, 'viewer')).toEqual([
      {
        ...viewer,
        holders: 4,
        holderNames: [
          holder('Ada Okeke'),
          holder('bisi Ade'),
          holder('Émeka Obi'),
          holder('Zara Bello'),
        ],
      },
      treasurer,
    ]);
  });

  it('leaves the other counts alone when nobody moves', () => {
    const empty = { ...viewer, holders: 0, holderNames: [] };

    expect(withoutRole([planner, empty, treasurer], empty, null)).toEqual([planner, treasurer]);
  });
});

describe('the holders the open role names', () => {
  const six = ['A', 'B', 'C', 'D', 'E', 'F'];

  it('names five and counts the rest', () => {
    expect(shownHolders(six, false)).toEqual({ shown: ['A', 'B', 'C', 'D', 'E'], more: 1 });
  });

  it('names exactly five without "and N more"', () => {
    expect(shownHolders(six.slice(0, 5), false)).toEqual({ shown: six.slice(0, 5), more: 0 });
  });

  it('names everybody once asked', () => {
    expect(shownHolders(six, true)).toEqual({ shown: six, more: 0 });
  });

  it('names nobody when nobody holds it', () => {
    expect(shownHolders([], false)).toEqual({ shown: [], more: 0 });
  });
});

describe('the names a role may not take', () => {
  const english = (key: string) => ({ 'roles.owner': 'Owner' })[key] ?? key;
  const spanish = (key: string) => ({ 'roles.owner': 'Propietario' })[key] ?? key;
  const roles = [
    { id: 'owner', seededAs: 'owner', name: null },
    { id: 'band', seededAs: null, name: 'Band' },
  ];

  it('takes a seeded role in every language and a made one by its name', () => {
    expect(takenRoleNames(roles, undefined, [english, spanish])).toEqual([
      'Owner',
      'Propietario',
      'Band',
      'Band',
    ]);
  });

  it('leaves out the role being renamed', () => {
    expect(takenRoleNames(roles, 'band', [english])).toEqual(['Owner']);
  });
});

describe('the areas a caller cannot change', () => {
  const areas = [
    { area: 'events', permissions: ['events.read', 'events.manage', 'events.create'] },
    { area: 'billing', permissions: ['billing.read', 'billing.manage'] },
    { area: 'budget', permissions: ['budget.read', 'budget.manage', 'budget.margin'] },
  ];

  it('names a row with one level left, and the margin where it shows', () => {
    const held = ['events.read', 'events.manage', 'budget.read', 'budget.manage'];

    expect(lockedAreas(['budget.read'], held, areas)).toEqual(['billing', MARGIN]);
  });

  it('names Create events where Event manager shows and the caller lacks it', () => {
    const held = ['events.read', 'events.manage', 'billing.read', 'billing.manage'];

    expect(lockedAreas(['events.read'], held, areas)).toEqual(['events.create', 'budget']);
    expect(lockedAreas([], held, areas)).toEqual(['budget']);
  });

  it('names nothing for a caller who holds everything', () => {
    const held = areas.flatMap(({ permissions }) => permissions);

    expect(lockedAreas(['budget.read'], held, areas)).toEqual([]);
  });
});

describe('the roles a caller may grant', () => {
  const owner = {
    id: 'r1',
    seededAs: 'owner',
    permissions: ['members.manage', 'billing.read', 'billing.manage'],
  };
  const administrator = { id: 'r2', seededAs: 'administrator', permissions: ['members.manage'] };
  const billing = { id: 'r6', seededAs: null, permissions: ['billing.read', 'billing.manage'] };
  const roles = [owner, administrator, billing];

  it('offers only what they hold, and Owner only to an owner', () => {
    expect(
      grantableRoles(roles, {
        role: administrator,
        permissions: ['members.manage', 'billing.read'],
      }),
    ).toEqual([administrator]);
    expect(grantableRoles(roles, { role: owner, permissions: owner.permissions })).toEqual(roles);
  });

  it('withholds what they may not grant, and nothing from an owner', () => {
    expect(
      withheldRoles(roles, {
        role: administrator,
        permissions: ['members.manage', 'billing.read'],
      }),
    ).toEqual([owner, billing]);
    expect(withheldRoles(roles, { role: administrator, permissions: owner.permissions })).toEqual([
      owner,
    ]);
    expect(withheldRoles(roles, { role: owner, permissions: owner.permissions })).toEqual([]);
  });
});
