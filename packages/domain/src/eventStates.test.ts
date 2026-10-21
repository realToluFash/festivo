import { describe, expect, it } from 'vitest';

import { EVENT_ACTIONS, EVENT_STATES, allowedActions, eventAllows } from './eventStates.ts';

describe('the event states', () => {
  it('are the four that are stored', () => {
    expect(EVENT_STATES).toEqual(['draft', 'live', 'paused', 'ended']);
  });

  it('allow only actions the declaration names', () => {
    for (const state of EVENT_STATES) {
      for (const action of allowedActions(state)) {
        expect(EVENT_ACTIONS).toContain(action);
      }
    }
  });
});

describe('eventAllows', () => {
  it.each([
    ['edit', true],
    ['delete', true],
    ['make_live', true],
    ['pause', false],
    ['end', false],
    ['invite', false],
    ['message', false],
    ['check_in', false],
    ['service', false],
  ])('a draft, %s: %s', (action, allowed) => {
    expect(eventAllows('draft', action)).toBe(allowed);
  });

  it.each([
    ['edit', true],
    ['delete', true],
    ['make_live', false],
    ['pause', true],
    ['end', true],
    ['invite', true],
    ['message', true],
    ['check_in', true],
    ['service', true],
  ])('a live event, %s: %s', (action, allowed) => {
    expect(eventAllows('live', action)).toBe(allowed);
  });

  it.each(['paused', 'ended'] as const)(
    '%s allows nothing until its own story says what',
    (state) => {
      expect(allowedActions(state)).toEqual([]);
    },
  );

  it('refuses an action nobody declared', () => {
    expect(eventAllows('live', 'publish')).toBe(false);
  });
});
