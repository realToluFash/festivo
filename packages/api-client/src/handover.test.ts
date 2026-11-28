import { describe, expect, it } from 'vitest';

import { asLedEvents } from './handover.ts';

describe('asLedEvents', () => {
  it('reads the work list as MembersController sends it, in its order', () => {
    expect(
      asLedEvents({
        events: [
          { id: 'b', title: 'Naming' },
          { id: 'a', title: 'Owambe' },
        ],
      }),
    ).toEqual([
      { id: 'b', title: 'Naming' },
      { id: 'a', title: 'Owambe' },
    ]);
  });

  it('refuses a body with no list rather than reading it as leading nothing', () => {
    expect(() => asLedEvents({})).toThrow(/work list/);
    expect(() => asLedEvents(null)).toThrow(/work list/);
  });
});
