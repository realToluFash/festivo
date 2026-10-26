import { describe, expect, it } from 'vitest';

import {
  EVENT_ACTIONS,
  EVENT_PHASES,
  EVENT_STATES,
  type EventState,
  allowedActions,
  editActions,
  eventAllows,
  eventPhase,
  eventTransition,
  makeLiveRow,
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

describe('editActions', () => {
  it.each([
    [['name'], ['edit']],
    [['venueName', 'currency'], ['edit']],
    [['startsAt'], ['edit_schedule']],
    [['endsAt', 'timeZone'], ['edit_schedule']],
    [
      ['name', 'startsAt'],
      ['edit_schedule', 'edit'],
    ],
    [[], []],
  ])('a change to %j needs %j', (changed, needed) => {
    expect(editActions(changed)).toEqual(needed);
  });

  it('names only declared actions', () => {
    expect(EVENT_ACTIONS).toEqual(expect.arrayContaining(editActions(['name', 'endsAt'])));
  });
});

describe('makeLiveRow', () => {
  const event = { startsAt: '2026-11-14T16:00:00+01:00', endsAt: '2026-11-15T02:00:00+01:00' };
  const before = new Date('2026-11-14T14:59:59Z');
  const after = new Date('2026-11-15T01:00:00Z');

  it('says what a draft blocks, with Make live', () => {
    expect(makeLiveRow({ ...event, status: 'draft' }, before)).toEqual({
      line: 'guestsBlocked',
      makeLive: true,
    });
  });

  it('says a draft past its end cannot go live', () => {
    expect(makeLiveRow({ ...event, status: 'draft' }, after)).toEqual({
      line: 'endPassed',
      makeLive: false,
    });
  });

  it.each([
    ['live', before],
    ['live', after],
    ['paused', before],
    ['ended', before],
  ] as const)('shows nothing for %s at %s', (status, now) => {
    expect(makeLiveRow({ ...event, status }, now)).toBeNull();
  });
});
