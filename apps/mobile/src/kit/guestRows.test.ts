import { describe, expect, it } from 'vitest';

import { filterChoices } from './guestRows.ts';

const counts = {
  all: 12,
  coming: 4,
  maybe: 1,
  noReply: 3,
  held: 1,
  notComing: 1,
  notYetInvited: 2,
};

describe('the guest list filter', () => {
  it('offers Not yet invited last while anybody is', () => {
    expect(filterChoices(counts, 'all').at(-1)).toBe('notYetInvited');
  });

  it('leaves Not yet invited out once nobody is', () => {
    expect(filterChoices({ ...counts, notYetInvited: 0 }, 'all')).not.toContain('notYetInvited');
  });

  it('keeps Not yet invited while it is chosen, until another choice is picked', () => {
    const none = { ...counts, notYetInvited: 0 };

    expect(filterChoices(none, 'notYetInvited')).toContain('notYetInvited');
    expect(filterChoices(none, 'coming')).not.toContain('notYetInvited');
  });
});
