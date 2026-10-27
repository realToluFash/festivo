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
  calledOff,
  endLabel,
  makeLiveRow,
  shownPhase,
} from './eventStates.ts';
import { createServerClock } from './serverClock.ts';

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
    ['paused', after, 'finished'],
    ['ended', before, 'finished'],
  ] as const)('%s at %s is %s', (status, now, phase) => {
    expect(eventPhase({ ...event, status }, now)).toBe(phase);
  });

  it.each([
    ['a second before the start', '2026-11-14T14:59:59Z', 'live'],
    ['at the start', '2026-11-14T15:00:00Z', 'happening_now'],
    ['across midnight', '2026-11-14T23:30:00Z', 'happening_now'],
    ['a second before the end', '2026-11-15T00:59:59Z', 'happening_now'],
    ['at the end', '2026-11-15T01:00:00Z', 'finished'],
  ] as const)('a live event %s is %s', (_, now, phase) => {
    expect(eventPhase({ ...event, status: 'live' }, new Date(now))).toBe(phase);
  });

  it('is happening now on the middle day of three', () => {
    const days = { startsAt: '2026-12-01T10:00:00+01:00', endsAt: '2026-12-03T18:00:00+01:00' };

    expect(eventPhase({ ...days, status: 'live' }, new Date('2026-12-02T08:00:00Z'))).toBe(
      'happening_now',
    );
  });

  it("starts at the first 01:30 on the night New York's clocks go back", () => {
    const night = { startsAt: '2026-11-01T01:30:00-04:00', endsAt: '2026-11-01T04:00:00-05:00' };
    const at = (now: string) => eventPhase({ ...night, status: 'live' }, new Date(now));

    expect(at('2026-11-01T05:29:59Z')).toBe('live');
    expect(at('2026-11-01T05:30:00Z')).toBe('happening_now');
    expect(at('2026-11-01T06:29:59Z')).toBe('happening_now');
    expect(at('2026-11-01T09:00:00Z')).toBe('finished');
  });
});

describe('shownPhase', () => {
  const event = {
    status: 'live',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
  } as const;
  const loadedAt = new Date('2026-11-14T14:50:00Z');

  it("is the server's phase until a boundary passes, whatever this side works out", () => {
    expect(
      shownPhase({ ...event, phase: 'paused' }, loadedAt, new Date('2026-11-14T14:59:59Z')),
    ).toBe('paused');
  });

  it('flips at the start', () => {
    expect(
      shownPhase({ ...event, phase: 'live' }, loadedAt, new Date('2026-11-14T15:00:00Z')),
    ).toBe('happening_now');
  });

  it('flips at the end', () => {
    expect(
      shownPhase(
        { ...event, phase: 'happening_now' },
        new Date('2026-11-14T20:00:00Z'),
        new Date('2026-11-15T01:00:00Z'),
      ),
    ).toBe('finished');
  });

  it('shows Live five minutes before the start on a device ten minutes fast', () => {
    const fast = Date.parse('2026-11-14T15:05:00Z');
    const clock = createServerClock(() => fast);

    clock.observe('Sat, 14 Nov 2026 14:55:00 GMT');

    expect(eventPhase({ ...event }, new Date(fast))).toBe('happening_now');
    expect(shownPhase({ ...event, phase: 'live' }, loadedAt, clock.now())).toBe('live');
  });
});

describe('endLabel', () => {
  const event = { startsAt: '2026-11-14T16:00:00+01:00' };

  it.each([
    ['live', '2026-11-14T14:59:59Z', 'callOff'],
    ['happening_now', '2026-11-14T15:00:00Z', 'endNow'],
    ['paused', '2026-11-14T14:00:00Z', 'callOff'],
    ['paused', '2026-11-14T16:00:00Z', 'endNow'],
    ['draft', '2026-11-14T14:00:00Z', null],
    ['finished', '2026-11-14T14:00:00Z', null],
  ] as const)('%s at %s offers %s', (phase, now, label) => {
    expect(endLabel(event, phase, new Date(now))).toBe(label);
  });
});

describe('calledOff', () => {
  const event = { startsAt: '2026-11-14T16:00:00+01:00' };

  it.each([
    ['ended', '2026-11-13T10:00:00+01:00', true],
    ['ended', '2026-11-14T18:00:00+01:00', false],
    ['live', '2026-11-15T02:00:00+01:00', false],
  ] as const)('%s, concluded %s: %s', (status, concludedAt, called) => {
    expect(calledOff({ ...event, status, concludedAt })).toBe(called);
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

  it('finished allows edit and delete, and not edit_schedule', () => {
    expect([...allowedActions('finished')].sort()).toEqual(['delete', 'edit']);
  });

  it('paused allows only end until sc-3586 says the rest', () => {
    expect(allowedActions('paused')).toEqual(['end']);
  });

  it('refuses an action nobody declared', () => {
    expect(eventAllows('live', 'publish')).toBe(false);
  });
});

describe('eventTransition', () => {
  it('takes a draft live, past three guards', () => {
    expect(eventTransition('draft', 'make_live')).toEqual({
      to: 'live',
      guards: ['end_not_passed', 'has_host', 'plan_limit'],
    });
  });

  it.each(['live', 'paused', 'ended'] as const)('has no make_live from %s', (state) => {
    expect(eventTransition(state, 'make_live')).toBeNull();
  });

  it.each(['live', 'paused'] as const)('ends %s while the end is ahead', (state) => {
    expect(eventTransition(state, 'end')).toEqual({ to: 'ended', guards: ['end_not_passed'] });
  });

  it.each(['draft', 'ended'] as const)('has no end from %s', (state) => {
    expect(eventTransition(state, 'end')).toBeNull();
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

  it('offers Make live five minutes before the end on a device ten minutes fast', () => {
    const clock = createServerClock(() => Date.parse('2026-11-15T01:05:00Z'));

    clock.observe('Sun, 15 Nov 2026 00:55:00 GMT');

    expect(makeLiveRow({ ...event, status: 'draft' }, clock.now())?.makeLive).toBe(true);
  });

  it('says the end has passed five minutes after it on a device ten minutes slow', () => {
    const clock = createServerClock(() => Date.parse('2026-11-15T00:55:00Z'));

    clock.observe('Sun, 15 Nov 2026 01:05:00 GMT');

    expect(makeLiveRow({ ...event, status: 'draft' }, clock.now())).toEqual({
      line: 'endPassed',
      makeLive: false,
    });
  });
});
