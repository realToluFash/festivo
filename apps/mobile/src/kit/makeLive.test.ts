import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { draftRowOf, refusalOf } from './makeLive.ts';

const ENDS = '2026-11-15T02:00:00+01:00';
const BEFORE = Date.parse('2026-11-15T00:59:59Z');
const AFTER = Date.parse('2026-11-15T01:00:00Z');

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
    expect(draftRowOf({ status: 'draft', endsAt: ENDS }, BEFORE, true)).toEqual({
      line: 'guestsBlocked',
      offersMakeLive: true,
    });
  });

  it('shows the line without Make live to somebody without it', () => {
    expect(draftRowOf({ status: 'draft', endsAt: ENDS }, BEFORE, false)).toEqual({
      line: 'guestsBlocked',
      offersMakeLive: false,
    });
  });

  it('says the end has passed, with no Make live, once it has', () => {
    expect(draftRowOf({ status: 'draft', endsAt: ENDS }, AFTER, true)).toEqual({
      line: 'endPassed',
      offersMakeLive: false,
    });
  });

  it.each(['live', 'paused', 'ended'] as const)(
    'shows nothing on an event that is %s',
    (status) => {
      expect(draftRowOf({ status, endsAt: ENDS }, BEFORE, true)).toBeNull();
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
