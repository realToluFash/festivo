import { describe, expect, it } from 'vitest';

import { offersEdit } from './eventEdit.ts';

const READS = ['events.read', 'guests.read', 'seating.read', 'people.read'];
const CHANGES = [...READS, 'events.manage', 'guests.manage', 'seating.manage'];

// Each event role's permissions as sc-29912's API sends them on the event read.
const ROLES = {
  lead: [...CHANGES, 'budget.read', 'budget.manage', 'people.manage'],
  can_edit: CHANGES,
  can_view: READS,
  can_check_in: READS,
};

describe('offersEdit', () => {
  it.each([['lead'], ['can_edit']] as const)('offers Edit to a Member with %s', (role) => {
    expect(offersEdit({ permissions: ROLES[role] })).toBe(true);
  });

  it.each([['can_view'], ['can_check_in']] as const)(
    'offers no Edit to a Member with %s',
    (role) => {
      expect(offersEdit({ permissions: ROLES[role] })).toBe(false);
    },
  );

  it('offers nothing before the event has loaded', () => {
    expect(offersEdit(null)).toBe(false);
  });
});
