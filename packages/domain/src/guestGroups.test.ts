import { describe, expect, it } from 'vitest';

import {
  foldedName,
  groupChanged,
  groupChoiceOf,
  groupNameLength,
  groupOptions,
  groupProblem,
  returnPick,
  shownProblem,
  sortedGroups,
  typedProblem,
} from './guestGroups.ts';

const GROUPS = [
  { id: 'gr_work', name: 'Work' },
  { id: 'gr_bride', name: 'Bride’s side' },
  { id: 'gr_family', name: 'Família' },
];
const FULL = Array.from({ length: 50 }, (_, at) => ({ id: `gr_${at}`, name: `Table ${at}` }));

describe('a group’s name (sc-3775)', () => {
  it('checks blank, then over 60, then taken, then the 50-group limit', () => {
    expect(groupProblem(GROUPS, '   ')).toBe('blank');
    expect(groupProblem(GROUPS, 'x'.repeat(61))).toBe('tooLong');
    expect(groupProblem(GROUPS, 'x'.repeat(60))).toBeNull();
    expect(groupProblem(GROUPS, ' work ')).toBe('taken');
    expect(groupProblem(FULL, 'Cousins')).toBe('limit');
    expect(groupProblem(FULL, 'x'.repeat(61))).toBe('tooLong');
  });

  it('counts code points, and compares without case, accents or the curl of an apostrophe', () => {
    expect(groupNameLength(' 👰👰 ')).toBe(2);
    expect(groupProblem(GROUPS, '👰'.repeat(60))).toBeNull();
    expect(groupProblem(GROUPS, "BRIDE'S SIDE")).toBe('taken');
    expect(groupProblem(GROUPS, 'familia')).toBe('taken');
    expect(foldedName('  Bride’s   Side ')).toBe("bride's side");
  });

  it('lets a rename keep its own name in another case, and does not count it against the limit', () => {
    expect(groupProblem(GROUPS, 'WORK', 'gr_work')).toBeNull();
    expect(groupProblem(GROUPS, 'Familia', 'gr_work')).toBe('taken');
    expect(groupProblem(FULL, 'Colleagues', 'gr_0')).toBeNull();
  });
});

describe('the Group field (sc-3775)', () => {
  it('lists the groups A to Z', () => {
    expect(sortedGroups(GROUPS).map((one) => one.name)).toEqual([
      'Bride’s side',
      'Família',
      'Work',
    ]);
  });

  it('chooses a group by its name in any case, a new name to make, or none', () => {
    expect(groupChoiceOf(GROUPS, ' WORK ')).toEqual({ id: 'gr_work' });
    expect(groupChoiceOf(GROUPS, '  Old   friends ')).toEqual({ name: 'Old friends' });
    expect(groupChoiceOf(GROUPS, '  ')).toBeNull();
  });

  it('offers Create only for a name no group has', () => {
    expect(groupOptions(GROUPS, 'wo').create).toBe('wo');
    expect(groupOptions(GROUPS, 'work').create).toBeNull();
    expect(groupOptions(GROUPS, 'work').groups.map((one) => one.id)).toEqual(['gr_work']);
  });

  it('changes the guest’s group only when the pick is another', () => {
    expect(groupChanged({ id: 'gr_work' }, undefined)).toBe(false);
    expect(groupChanged({ id: 'gr_work' }, { id: 'gr_work' })).toBe(false);
    expect(groupChanged({ id: 'gr_work' }, { id: 'gr_bride' })).toBe(true);
    expect(groupChanged({ id: 'gr_work' }, null)).toBe(true);
    expect(groupChanged(null, null)).toBe(false);
    expect(groupChanged(null, { name: 'Cousins' })).toBe(true);
  });
});

describe("the app's Group picker (sc-5519)", () => {
  it('picks the group a name matches, case, accents and apostrophes aside', () => {
    expect(returnPick(GROUPS, 'BRIDE’S SIDE')).toEqual({ pick: { id: 'gr_bride' } });
    expect(returnPick(GROUPS, "bride's side")).toEqual({ pick: { id: 'gr_bride' } });
    expect(returnPick(GROUPS, 'familia')).toEqual({ pick: { id: 'gr_family' } });
  });

  it('makes a new name trimmed, its spaces run together', () => {
    expect(returnPick(GROUPS, '  Old   friends ')).toEqual({ pick: { name: 'Old friends' } });
  });

  it('refuses a blank, and shows it only once Return was pressed', () => {
    expect(returnPick(GROUPS, '   ')).toEqual({ problem: 'blank' });
    expect(shownProblem(GROUPS, '   ', null)).toBeNull();
    expect(shownProblem(GROUPS, '   ', 'blank')).toBe('blank');
  });

  it('shows a name over 60 as it is typed', () => {
    expect(shownProblem(GROUPS, 'x'.repeat(61), null)).toBe('tooLong');
    expect(shownProblem(GROUPS, 'x'.repeat(60), null)).toBeNull();
    expect(returnPick(GROUPS, 'x'.repeat(61))).toEqual({ problem: 'tooLong' });
  });

  it('refuses a new name at 50 groups, but still picks one that exists', () => {
    expect(typedProblem(FULL, 'Cousins')).toBe('limit');
    expect(shownProblem(FULL, 'Cousins', null)).toBe('limit');
    expect(returnPick(FULL, 'Cousins')).toEqual({ problem: 'limit' });
    expect(typedProblem(FULL, 'table 7')).toBeNull();
    expect(returnPick(FULL, 'TABLE 7')).toEqual({ pick: { id: 'gr_7' } });
  });
});
