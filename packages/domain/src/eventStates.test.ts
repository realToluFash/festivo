import { describe, expect, it } from 'vitest';

import {
  EVENT_ACTIONS,
  EVENT_PHASES,
  EVENT_STATES,
  type EventState,
  allowedActions,
  eventAllows,
  eventPhase,
  eventTransition,
} from './eventStates.ts';

const TYPED: Record<EventState, true> = { draft: true, live: true, paused: true, ended: true };

describe('the declaration', () => {
  it('stores the states the type names', () => {
    expect([...EVENT_STATES].sort()).toEqual(Object.keys(TYPED).sort());
  });

  it('lets each phase do only actions it names', () => {
    for (const phase of EVENT_PHASES) {
      for (const action of allowedActions(phase)) {
        expect(EVENT_ACTIONS).toContain(action);
      }
    }
  });
});

describe('eventPhase', () => {
  const event = { startsAt: '2026-11-14T16:00:00+01:00', endsAt: '2026-11-15T02:00:00+01:00' };
  const before = new Date('2026-11-14T14:59:59Z');
  const during = new Date('2026-11-14T15:00:00Z');
  const after = new Date('2026-11-15T01:00:00Z');

  it.each([
    ['draft', before, 'draft'],
    ['draft', after, 'draft'],
    ['live', before, 'live'],
    ['live', during, 'happening_now'],
    ['live', after, 'finished'],
    ['paused', during, 'paused'],
    ['ended', before, 'finished'],
  ] as const)('%s at %s is %s', (status, now, phase) => {
    expect(eventPhase({ ...event, status }, now)).toBe(phase);
  });
});

describe('eventAllows', () => {
  const everything = EVENT_ACTIONS.length;

  it.each([
    ['edit', true],
    ['edit_schedule', true],
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

  it.each(['live', 'happening_now'] as const)('%s allows everything but make_live', (phase) => {
    expect(allowedActions(phase)).toHaveLength(everything - 1);
    expect(eventAllows(phase, 'make_live')).toBe(false);
  });

  it('finished allows edit, edit_schedule and delete', () => {
    expect([...allowedActions('finished')].sort()).toEqual(['delete', 'edit', 'edit_schedule']);
  });

  it('paused allows nothing until sc-3586 says what', () => {
    expect(allowedActions('paused')).toEqual([]);
  });

  it('checks edit and edit_schedule apart', () => {
    expect(EVENT_ACTIONS).toContain('edit');
    expect(EVENT_ACTIONS).toContain('edit_schedule');
    expect(eventAllows('paused', 'edit')).toBe(false);
    expect(eventAllows('paused', 'edit_schedule')).toBe(false);
  });

  it('refuses an action nobody declared', () => {
    expect(eventAllows('live', 'publish')).toBe(false);
  });
});

describe('eventTransition', () => {
  it('takes a draft live, past two guards', () => {
    expect(eventTransition('draft', 'make_live')).toEqual({
      to: 'live',
      guards: ['end_not_passed', 'plan_limit'],
    });
  });

  it.each(['live', 'paused', 'ended'] as const)('has no make_live from %s', (state) => {
    expect(eventTransition(state, 'make_live')).toBeNull();
  });
});
