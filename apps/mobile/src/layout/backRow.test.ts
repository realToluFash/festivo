import { describe, expect, it } from 'vitest';

import { backRow } from './backRow.ts';

describe('Back keeps its row while Refreshing… comes and goes (sc-71821)', () => {
  it('gives way on Guests’ list on a phone, refreshing or not', () => {
    expect(backRow({ phone: true, guestsList: true, cardNamed: false })).toBe('givingWay');
  });

  it('keeps Refreshing… beside Back elsewhere on a phone and on a named card', () => {
    expect(backRow({ phone: true, guestsList: false, cardNamed: false })).toBe('beside');
    expect(backRow({ phone: false, guestsList: false, cardNamed: true })).toBe('beside');
  });

  it('leaves Back alone on a tablet page with a title', () => {
    expect(backRow({ phone: false, guestsList: true, cardNamed: false })).toBe('alone');
  });
});
