import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { type Translate } from './eventWords.ts';
import { limitRefusalOf } from './limitRefusal.ts';

const t = ((key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as Translate;

function refused(code: string, members: Record<string, unknown>): ApiError {
  return new ApiError({
    type: `https://soirely.com/errors/${code}`,
    title: 'No.',
    status: 403,
    ...members,
  });
}

const PLAN = { limit: 'live_events', plan: 'free', used: 2, allowed: 2 };

describe('limitRefusalOf (sc-3930)', () => {
  it('reads anything but the two problems as no refusal', () => {
    expect(limitRefusalOf(new Error('offline'), 'makeLive', t, 'en-GB')).toBeNull();
    expect(limitRefusalOf(refused('event_concluded', {}), 'makeLive', t, 'en-GB')).toBeNull();
  });

  it('names the event that ends first in its own zone, and offers no plan way', () => {
    const refusal = limitRefusalOf(
      refused('plan_limit_reached', {
        ...PLAN,
        event: {
          id: 'ev_9',
          name: 'Summer gala',
          endsAt: '2026-11-07T23:00:00+00:00',
          timeZone: 'Europe/London',
        },
      }),
      'makeLive',
      t,
      'en-GB',
    );

    expect(refusal).toEqual({
      title: 'limitReached.title.live {"count":2}',
      line: null,
      figure: 'limitReached.figure.live {"count":2,"allowed":2,"plan":"Free"}',
      safe: 'limitReached.safe.draft',
      goLive:
        'limitReached.goLive {"event":"Summer gala","date":"Saturday 7 November","time":"23:00"}',
      ways: [],
      untick: null,
      planLimit: true,
      back: 'limitReached.back.draft',
    });
  });

  it('gives an accepted invitation no figure, no way past and no plan line', () => {
    const refusal = limitRefusalOf(
      refused('plan_limit_reached', { ...PLAN, limit: 'team_seats', organisation: 'Ìrè Events' }),
      'seatAccept',
      t,
      'en-GB',
    );

    expect(refusal).toMatchObject({
      title: 'limitReached.title.accept {"organisation":"Ìrè Events"}',
      figure: null,
      ways: [],
      planLimit: false,
      back: 'limitReached.back.notNow',
    });
  });

  it('gives the ceiling Remove a guest alone, and no plan line', () => {
    const refusal = limitRefusalOf(
      refused('event_capacity_reached', { ceiling: 10000, onEvent: 10000, adding: 1 }),
      'guestAdded',
      t,
      'en-GB',
    );

    expect(refusal).toMatchObject({ ways: ['removeGuest'], planLimit: false });
  });

  it('gives a copy the untick line and never Remove a guest', () => {
    const refusal = limitRefusalOf(
      refused('plan_limit_reached', {
        ...PLAN,
        limit: 'guests_per_event',
        allowed: 100,
        adding: 142,
      }),
      'copy',
      t,
      'en-GB',
    );

    expect(refusal).toMatchObject({
      line: 'limitReached.copy.overPlan {"count":142,"limit":100}',
      ways: [],
      untick: 'limitReached.copy.untick',
    });
  });
});
