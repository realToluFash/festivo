import type { StaffEntry } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { openedEntry, openedFrom } from './openedEntry.ts';

const ada = { id: 's1', fullName: 'Ada Obi' } as StaffEntry;

describe('openedEntry', () => {
  it('returns the row the list opened, for that event and that person', () => {
    openedFrom('e1', ada);

    expect(openedEntry('e1', 's1')).toBe(ada);
  });

  it('returns nothing for another person on the same event', () => {
    openedFrom('e1', ada);

    expect(openedEntry('e1', 's2')).toBeNull();
  });

  it('returns nothing for the same person id on another event', () => {
    openedFrom('e1', ada);

    expect(openedEntry('e2', 's1')).toBeNull();
  });
});
