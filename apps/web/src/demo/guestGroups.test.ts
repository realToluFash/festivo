import { describe, expect, it } from 'vitest';

import {
  GGW,
  GROUPS_MOST,
  NO_GROUP,
  WEDDING_GROUPS,
  deleteGroup,
  fullGroups,
  groupCounts,
  groupLine,
  groupOptions,
  groupProblem,
  groupedWedding,
  inGroupFilter,
  renameGroup,
  settleGroup,
} from './guestGroups.ts';
import { WEDDING, peopleOf, sampleGuests } from './guests.ts';

const wedding = () => groupedWedding(sampleGuests(WEDDING));

describe('a group’s name (sc-3775)', () => {
  it('checks blank, then over 60, then taken, then the 50-group limit', () => {
    expect(groupProblem(WEDDING_GROUPS, '   ')).toBe('blank');
    expect(groupProblem(WEDDING_GROUPS, 'x'.repeat(61))).toBe('tooLong');
    expect(groupProblem(WEDDING_GROUPS, 'x'.repeat(60))).toBeNull();
    expect(groupProblem(WEDDING_GROUPS, ' work ')).toBe('taken');
    expect(groupProblem(fullGroups(), 'Cousins')).toBe('limit');
    expect(groupProblem(fullGroups(), 'x'.repeat(61))).toBe('tooLong');
    expect(fullGroups()).toHaveLength(GROUPS_MOST);
  });

  it('counts code points and ignores case and accents, naming the group as it is spelt', () => {
    expect(groupProblem(WEDDING_GROUPS, '👰'.repeat(60))).toBeNull();
    expect(groupProblem(WEDDING_GROUPS, "BRIDE'S SIDE")).toBe('taken');
    expect(groupLine(WEDDING_GROUPS, "bride's side", 'taken')).toBe(
      'There’s already a group called Bride’s side.',
    );
    expect(groupProblem([{ id: 'a', name: 'Família' }], 'familia')).toBe('taken');
  });

  it('lets a rename keep its own name in another case, and does not count against the limit', () => {
    expect(groupProblem(WEDDING_GROUPS, 'WORK', 'g-work')).toBeNull();
    expect(groupProblem(WEDDING_GROUPS, 'Groom’s side', 'g-work')).toBe('taken');
    expect(groupProblem(fullGroups(), 'Colleagues', 'g-work')).toBeNull();
  });

  it('says the limit two ways: Groups, and the form pointing at Groups', () => {
    expect(groupLine(fullGroups(), 'x', 'limit')).toBe(
      'This event has 50 groups, the most it can have. Delete one to make another.',
    );
    expect(groupLine(fullGroups(), 'x', 'limit', 'form')).toContain('Choose one of them');
  });
});

describe('one group each, the counts adding up (sc-3775)', () => {
  it('counts guests and their companions per group, No group its own, adding up to everyone', () => {
    const list = wedding();
    const counts = groupCounts(list, WEDDING_GROUPS);
    const sum = counts.rows.reduce((all, row) => all + row.people, 0) + counts.none.people;

    expect(sum).toBe(counts.total);
    expect(counts.total).toBe(peopleOf(list).length);
    expect(counts.rows.map((row) => row.group?.name)).toEqual([
      'Bride’s side',
      'Groom’s side',
      'Old school friends',
      'Work',
    ]);
  });

  it('companions follow their host into the host’s group', () => {
    const list = wedding();
    const work = groupCounts(list, WEDDING_GROUPS).rows.find((row) => row.group?.id === 'g-work');
    const hosts = list.filter((one) => one.group === 'g-work');

    expect(work?.guests).toBe(hosts.length);
    expect(work?.companions).toBe(hosts.reduce((all, one) => all + one.companions.length, 0));
  });

  it('renames everywhere at once: guests keep the id', () => {
    const groups = renameGroup(WEDDING_GROUPS, 'g-work', ' Colleagues ');

    expect(groups.find((one) => one.id === 'g-work')?.name).toBe('Colleagues');
    expect(wedding().filter((one) => one.group === 'g-work')).toHaveLength(3);
  });

  it('deletes the group and keeps its guests, with no group', () => {
    const list = wedding();
    const after = deleteGroup(WEDDING_GROUPS, list, 'g-work');

    expect(after.list).toHaveLength(list.length);
    expect(after.groups.map((one) => one.id)).not.toContain('g-work');
    expect(after.list.find((one) => one.id === 'camille')?.group).toBeUndefined();
    expect(groupCounts(after.list, after.groups).none.people).toBe(
      groupCounts(list, WEDDING_GROUPS).none.people +
        (groupCounts(list, WEDDING_GROUPS).rows.find((row) => row.group?.id === 'g-work')?.people ??
          0),
    );
  });

  it('a new group counts 0 people', () => {
    const made = settleGroup(WEDDING_GROUPS, { name: 'Cousins' });
    const row = groupCounts(wedding(), made.groups).rows.find(
      (one) => one.group?.name === 'Cousins',
    );

    expect(GGW.peopleLine(row?.people ?? -1, row?.guests ?? -1, row?.companions ?? -1)).toBe(
      '0 people · 0 guests and no companions',
    );
  });

  it('filters by a group or No group', () => {
    const list = wedding();

    expect(list.filter((one) => inGroupFilter(one, 'g-bride')).map((one) => one.id)).toEqual([
      'musa',
      'amaka',
      'folasade',
      'emeka',
      'ngozi',
    ]);
    expect(
      list.filter((one) => inGroupFilter(one, NO_GROUP)).every((one) => one.group == null),
    ).toBe(true);
  });
});

describe('the Group field’s choices (sc-3775)', () => {
  it('offers the groups holding what is typed, and Create only when no group is called that', () => {
    expect(groupOptions(WEDDING_GROUPS, 's').groups.map((one) => one.name)).toEqual([
      'Bride’s side',
      'Groom’s side',
      'Old school friends',
    ]);
    expect(groupOptions(WEDDING_GROUPS, 'Cousins')).toEqual({ groups: [], create: 'Cousins' });
    expect(groupOptions(WEDDING_GROUPS, 'work').create).toBeNull();
    expect(groupOptions(WEDDING_GROUPS, '  ').create).toBeNull();
  });
});
