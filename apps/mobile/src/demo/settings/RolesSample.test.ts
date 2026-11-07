import { levelOf, MARGIN, sameGrant } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  andList,
  AREAS,
  changedAreas,
  changesLine,
  describeRole,
  discardTitle,
  extrasLine,
  FOLAKE,
  grantFor,
  heldLine,
  holdersLine,
  idOf,
  JULIEN,
  levelCounts,
  levelLine,
  levelsFor,
  lockedIntro,
  nameProblem,
  removedCard,
  replacements,
  roleLine,
  rolesCount,
  rolesStart,
  rolesStateOf,
  sampleRoles,
  seeLines,
  unsavedLine,
} from './RolesSample.ts';

const roles = sampleRoles();
const area = (name: string) => {
  const found = AREAS.find((one) => one.area === name);
  if (found == null) throw new Error(`The sample has ${name}.`);

  return found;
};
const role = (name: string) => {
  const found = roles.find((one) => one.name === name);
  if (found == null) throw new Error(`The sample has ${name}.`);

  return found;
};

describe('Roles in the demo', () => {
  it('lists the thirteen areas in the app’s order, Run of show on the day', () => {
    expect(AREAS).toHaveLength(13);
    expect(AREAS.at(-1)?.area).toBe('organisation');
    expect(AREAS.find(({ area }) => area === 'run_of_show')?.means).toBe(
      'The schedule, and marking items done on the day.',
    );
  });

  it('holds the sample’s grants', () => {
    const manager = grantFor('Event manager');
    expect(levelOf(manager, 'budget')).toBe('change');
    expect(manager).toContain('events.create');
    expect(manager).not.toContain(MARGIN);
    expect(levelOf(manager, 'vendors')).toBe('nothing');
    expect(levelOf(grantFor('Coordinator'), 'staff')).toBe('read');
    expect(levelOf(grantFor('Administrator'), 'billing')).toBe('nothing');
    expect(role('Coordinator').holders).toEqual(['Ana Souza', 'Marta Silva']);
    expect(role('Door staff').builtIn).toBe(false);
  });

  it('offers Organisation only Nothing and Change', () => {
    const organisation = AREAS.find(({ area }) => area === 'organisation');
    if (organisation == null) throw new Error('Organisation is an area.');

    expect(levelsFor([], FOLAKE.held, organisation)).toEqual(['nothing', 'change']);
  });

  it('locks Billing for Julien, whose Administrator role holds none of it', () => {
    expect(lockedIntro(grantFor('Coordinator'), JULIEN.held, 'Administrator')).toBe(
      'You can change only what your role, Administrator, holds. Billing stays as it is when you save.',
    );
    expect(lockedIntro(grantFor('Coordinator'), FOLAKE.held, 'Owner')).toBeNull();
  });

  it('says what they will see, the margin included', () => {
    const lines = seeLines(grantFor('Event manager'));
    expect(lines.hidden).toBe(
      'Not in their menus at all: Vendors, Members and roles, Billing, and Organisation.',
    );
    expect(lines.read).toBe(
      'They can change everything they can open. The budget opens with costs only, no margin.',
    );
    expect(seeLines(grantFor('Owner'))).toEqual({
      hidden: 'Every area is in their menus.',
      read: 'They can change everything they can open. The budget shows the margin.',
    });
  });

  it('writes the unsaved line for each case', () => {
    expect(unsavedLine(false, 'Event manager', 1)).toBe(
      'Unsaved changes to Event manager. 1 person gets them on their next request; nobody is signed out.',
    );
    expect(unsavedLine(false, 'Coordinator', 2)).toContain('2 people get them');
    expect(unsavedLine(false, 'Planner', 0)).toBe(
      'Unsaved changes to Planner. Nobody holds this role yet.',
    );
    expect(unsavedLine(true, '', 0)).toBe(
      'New role, not saved yet. Nobody holds it until somebody is given it.',
    );
  });

  it('checks a name as the API does', () => {
    expect(nameProblem('   ', roles, null)).toBe('Give the role a name.');
    expect(nameProblem('coordinator', roles, null)).toBe('A role with that name already exists.');
    expect(nameProblem('Door staff', roles, idOf('Door staff'))).toBeNull();
    expect(nameProblem('x'.repeat(41), roles, null)).toBe(
      'Shorten the name to 40 characters or fewer.',
    );
  });

  it('offers an owner every other role but Owner to move Door staff’s people to', () => {
    expect(replacements(roles, role('Door staff'), FOLAKE.held).map(({ name }) => name)).toEqual([
      'Administrator',
      'Event manager',
      'Coordinator',
      'Read-only',
    ]);
  });

  it('names five holders, then how many more', () => {
    expect(holdersLine(['a', 'b']).more).toBeNull();
    expect(holdersLine(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual({
      shown: ['a', 'b', 'c', 'd', 'e'],
      more: 'and 2 more',
    });
  });

  it('describes each kind of role', () => {
    expect(describeRole(role('Owner'))).toBe('Everything, including whatever Soirely adds later.');
    expect(describeRole(role('Door staff'))).toBe('Made by Ire Events. It can be removed.');
    expect(describeRole(null)).toBe('Starts from nothing. Switch on what they need.');
  });

  it('starts each state a link names', () => {
    expect(rolesStateOf('locked')).toBe('locked');
    expect(rolesStateOf(undefined)).toBe('list');
    expect(rolesStart('locked').viewer).toBe(JULIEN);
    expect(rolesStart('newBlank')).toMatchObject({ open: 'new', nameRefused: true });
    const unsaved = rolesStart('unsaved').grant ?? [];
    expect(sameGrant(unsaved, grantFor('Event manager'))).toBe(false);
    expect(unsaved).toContain(MARGIN);
  });

  it('joins a list the way English does', () => {
    expect(andList(['Billing'])).toBe('Billing');
    expect(andList(['Billing', 'Margin'])).toBe('Billing and Margin');
    expect(andList(['A', 'B', 'C'])).toBe('A, B, and C');
  });

  it('counts the roles on the card, and each role’s kind on its row', () => {
    expect(rolesCount(roles)).toEqual({
      says: '6 roles',
      line: '5 built in · 1 made by Ire Events',
    });
    expect(roleLine(role('Owner'))).toBe('1 person · everything');
    expect(roleLine(role('Coordinator'))).toBe('2 people · built in');
    expect(roleLine(role('Door staff'))).toBe('1 person · made by Ire Events');
    expect(heldLine(role('Event manager'))).toBe('Built in · held by 1 person');
    expect(heldLine(role('Owner'))).toBe(describeRole(role('Owner')));
    expect(heldLine({ ...role('Door staff'), holders: [] })).toBe(
      'Made by Ire Events · held by nobody',
    );
  });

  it('counts the areas at each level, and names the extras a level keeps', () => {
    const manager = grantFor('Event manager');
    expect(levelCounts(manager)).toEqual({ change: 9, read: 0, nothing: 4 });
    expect(levelCounts(grantFor('Owner'))).toEqual({ change: 13, read: 0, nothing: 0 });
    expect(extrasLine(manager, area('budget'))).toBe('Margin · Hidden');
    expect(extrasLine(manager, area('events'))).toBe('Create events · Allowed');
    expect(extrasLine(manager, area('vendors'))).toBeUndefined();
    expect(levelLine('change', area('budget'))).toBe('Everything in Budget.');
    expect(levelLine('read', area('budget'))).toBe('Open, with no buttons.');
  });

  it('counts a change per area, and says who gets it', () => {
    const manager = grantFor('Event manager');
    expect(changedAreas(manager, rolesStart('unsaved').grant ?? [])).toBe(1);
    expect(changedAreas(manager, manager)).toBe(0);
    expect(changesLine(1, ['Priya Shah'])).toEqual({
      count: '1 change.',
      rest: 'Priya Shah gets it on their next request. Nobody is signed out.',
    });
    expect(changesLine(2, ['Ana Souza', 'Marta Silva']).rest).toBe(
      '2 people get them on their next request. Nobody is signed out.',
    );
    expect(changesLine(1, []).rest).toBe('Nobody holds this role yet.');
    expect(discardTitle(1)).toBe('Discard your change?');
    expect(discardTitle(3)).toBe('Discard your changes?');
  });

  it('says what was removed, and where its people went', () => {
    expect(removedCard({ name: 'Door staff', holders: 1, movedTo: 'Coordinator' })).toEqual({
      says: 'Door staff was removed',
      line: 'Its 1 person is now Coordinator.',
    });
    expect(removedCard({ name: 'Door staff', holders: 2, movedTo: 'Read-only' }).line).toBe(
      'Its 2 people are now Read-only.',
    );
    expect(removedCard({ name: 'Planner', holders: 0, movedTo: null }).line).toBeNull();
  });

  it('opens the edit screen for the states that start on it', () => {
    expect(rolesStart('unsaved')).toMatchObject({ editing: true, area: 'budget' });
    expect(rolesStart('locked')).toMatchObject({ editing: true, area: null });
    expect(rolesStart('eventManager')).toMatchObject({ editing: false });
  });
});
