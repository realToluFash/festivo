import { describe, expect, it } from 'vitest';

import {
  LIMITS,
  LW,
  answerOf,
  endOf,
  limitStateOf,
  mayAsk,
  planWayOf,
  refusalOf,
} from './limitRules.ts';

describe('the refusal at a limit, in the app (sc-3930)', () => {
  it('titles each limit with its count, without a full stop', () => {
    expect(refusalOf('liveEvents').title).toBe('Your plan allows 2 live events at once');
    expect(refusalOf('guestImport').title).toBe('Your plan allows 100 people per event');
    expect(refusalOf('seatInvite').title).toBe('Your plan allows 3 team seats');
    expect(LW.seatsTitle(1)).toBe('Your plan allows 1 team seat');
    expect(refusalOf('seatAccept').title).toBe('Every team seat at Ìrè Events is in use');
    expect(refusalOf('ceilingGuest').title).toBe('An event can have up to 10,000 people');
    for (const limit of LIMITS) expect(refusalOf(limit).title.endsWith('.')).toBe(false);
  });

  it('gives a figure line ending with the plan, none on an accept, no plan under the ceiling', () => {
    expect(refusalOf('liveEvents').figure).toBe('2 of 2 live events · Free plan');
    expect(refusalOf('guestImport').figure).toBe(
      '62 of 100 people · companions in the file count as people · Free plan',
    );
    expect(refusalOf('seatAccept').figure).toBeNull();
    expect(refusalOf('ceilingImport').figure).not.toMatch(/plan/u);
  });

  it('says the file’s count and the room left on an import', () => {
    expect(refusalOf('guestImport').line).toMatch(
      /50 people, and this event has room for 38 more/u,
    );
    expect(refusalOf('ceilingImport').line).toMatch(
      /420 people, and this event has room for 180 more/u,
    );
  });

  it('gives billing.manage the in-app line, Ask an owner otherwise, and neither under the ceiling', () => {
    expect(planWayOf(refusalOf('liveEvents'), 'manage')).toBe('inApp');
    expect(LW.inApp).not.toMatch(/web|website|online|upgrade/iu);
    expect(planWayOf(refusalOf('liveEvents'), 'other')).toBe('ask');
    expect(planWayOf(refusalOf('seatAccept'), 'manage')).toBe('ask');
    expect(planWayOf(refusalOf('ceilingGuest'), 'manage')).toBeNull();
    expect(planWayOf(refusalOf('ceilingImport'), 'other')).toBeNull();
  });

  it('lists the free ways past in order, and one way back for each', () => {
    expect(refusalOf('seatInvite').ways).toEqual(['withdraw', 'removeMember']);
    expect(refusalOf('liveEvents').ways).toEqual(['goLive']);
    expect(refusalOf('ceilingGuest').ways).toEqual(['removeGuest']);
    expect(refusalOf('seatAccept').back).toBe('Not now');
    expect(refusalOf('liveEvents').back).toBe('Back to the draft');
    expect(refusalOf('ceilingImport').back).toBe('Back to the import');
  });

  it('names the first event to end in its own zone, 24-hour', () => {
    const { date, time } = endOf('2026-07-04T22:00:00Z', 'Europe/London');

    expect(LW.goLive('Summer gala', date, time)).toBe(
      'Another event can go live when Summer gala ends, on Saturday 4 July at 23:00.',
    );
  });

  it('sends only from ready or Not sent, and goes Not sent offline', () => {
    expect(mayAsk({ now: 'ready' })).toBe(true);
    expect(mayAsk({ now: 'notSent' })).toBe(true);
    expect(mayAsk({ now: 'sending' })).toBe(false);
    expect(mayAsk({ now: 'sent', owners: 'one' })).toBe(false);
    expect(answerOf(true, 'one')).toEqual({ now: 'notSent' });
    expect(answerOf(false, 'one')).toEqual({ now: 'sent', owners: 'one' });
  });

  it('opens an unknown state as live events for billing.manage', () => {
    expect(limitStateOf('nonsense')).toBe('liveManage');
    expect(limitStateOf(undefined)).toBe('liveManage');
  });
});
