import { describe, expect, it } from 'vitest';

import { SIDEBAR_EVENTS, sideEventsOf } from './sideEvents.ts';

describe('Your events in the sidebar on its side (sc-39340)', () => {
  it('lists the screen’s events unless a state is asked for', () => {
    expect(sideEventsOf(SIDEBAR_EVENTS, undefined, false)).toBe(SIDEBAR_EVENTS);
    expect(sideEventsOf(SIDEBAR_EVENTS, 'elsewhere', false)).toBe(SIDEBAR_EVENTS);
  });

  it('lists nothing with no events, and nothing for a new organisation', () => {
    expect(sideEventsOf(SIDEBAR_EVENTS, 'none', false)).toEqual([]);
    expect(sideEventsOf(SIDEBAR_EVENTS, undefined, true)).toEqual([]);
    expect(sideEventsOf(SIDEBAR_EVENTS, 'many', true)).toEqual([]);
  });

  it('lists all twenty, uncapped, when there are more than the sidebar holds', () => {
    const many = sideEventsOf(SIDEBAR_EVENTS, 'many', false);

    expect(many).toHaveLength(20);
    expect(new Set(many.map((event) => event.id)).size).toBe(20);
    expect(many.every((event) => event.name.length > 0)).toBe(true);
  });
});
