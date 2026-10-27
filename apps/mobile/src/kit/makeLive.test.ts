import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { EVENT_PHASES } from '@soirely/domain';

import { PHASE_WORD, draftRowOf, endRefusalOf, refusalOf } from './makeLive.ts';

const STARTS = '2026-11-14T16:00:00+01:00';
const ENDS = '2026-11-15T02:00:00+01:00';
const BEFORE = new Date('2026-11-15T00:59:59Z');
const AFTER = new Date('2026-11-15T01:00:00Z');

function problem(code: string, extra: Record<string, unknown> = {}): ApiError {
  return new ApiError({
    type: `https://soirely.com/errors/${code}`,
    title: code,
    status: 409,
    ...extra,
  });
}

describe('draftRowOf', () => {
  it('offers Make live on a draft to somebody with events.manage', () => {
    expect(draftRowOf({ status: 'draft', startsAt: STARTS, endsAt: ENDS }, BEFORE, true)).toEqual({
      line: 'guestsBlocked',
      offersMakeLive: true,
    });
  });

  it('shows the line without Make live to somebody without it', () => {
    expect(draftRowOf({ status: 'draft', startsAt: STARTS, endsAt: ENDS }, BEFORE, false)).toEqual({
      line: 'guestsBlocked',
      offersMakeLive: false,
    });
  });

  it('says the end has passed, with no Make live, once it has', () => {
    expect(draftRowOf({ status: 'draft', startsAt: STARTS, endsAt: ENDS }, AFTER, true)).toEqual({
      line: 'endPassed',
      offersMakeLive: false,
    });
  });

  it.each(['live', 'paused', 'ended'] as const)(
    'shows nothing on an event that is %s',
    (status) => {
      expect(draftRowOf({ status, startsAt: STARTS, endsAt: ENDS }, BEFORE, true)).toBeNull();
    },
  );
});

describe('refusalOf', () => {
  it('reads a 409 event_state_invalid as changed elsewhere', () => {
    expect(refusalOf(problem('event_state_invalid'))).toEqual({ kind: 'changed' });
  });

  it('reads a 409 event_concluded as concluded', () => {
    expect(refusalOf(problem('event_concluded'))).toEqual({ kind: 'concluded' });
  });

  it('reads a 409 event_host_required as needing a host (sc-6713)', () => {
    expect(refusalOf(problem('event_host_required', { status: 409 }))).toEqual({
      kind: 'needsHost',
    });
  });

  it('reads a 403 plan_limit with its plan and limit', () => {
    expect(refusalOf(problem('plan_limit', { status: 403, plan: 'Free', limit: 3 }))).toEqual({
      kind: 'planLimit',
      plan: 'Free',
      limit: 3,
    });
  });

  it.each([new Error('offline'), problem('internal_error', { status: 500 })])(
    'reads anything else as failed',
    (error) => {
      expect(refusalOf(error)).toEqual({ kind: 'failed' });
    },
  );
});

describe('PHASE_WORD', () => {
  it('has a word for every declared phase, Happening now its own', () => {
    expect(Object.keys(PHASE_WORD).sort()).toEqual([...EVENT_PHASES].sort());
    expect(PHASE_WORD.happening_now).toBe('eventsScreen.happeningNow');
  });
});

describe('endRefusalOf', () => {
  it('reads a 409 event_state_invalid as changed elsewhere', () => {
    expect(endRefusalOf(problem('event_state_invalid'))).toEqual({ kind: 'changed' });
  });

  it('reads a 409 event_concluded as already over', () => {
    expect(endRefusalOf(problem('event_concluded'))).toEqual({ kind: 'concluded' });
  });

  it.each([new Error('offline'), problem('plan_limit', { status: 403 })])(
    'reads anything else as failed',
    (error) => {
      expect(endRefusalOf(error)).toEqual({ kind: 'failed' });
    },
  );
});
