import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  hasNoEvents,
  linkFromIn,
  openedOf,
  openedOrMoved,
  openedWithoutAsking,
  pageless,
  selectionIn,
} from './eventsOpen.ts';

const gala: OrganisationEvent = {
  id: 'evt_gala',
  organisationId: 'org_a',
  name: 'Gala',
  type: 'wedding',
  status: 'draft',
  startsAt: '2026-11-14T16:00',
  endsAt: '2026-11-14T23:00',
  venue: null,
  arrivalNote: null,
  timeZone: 'Europe/London',
  dayCount: 1,
  currency: 'GBP',
  cover: null,
  hosts: ['Funmi Adeyemi'],
  thankYou: null,
  madeLiveAt: null,
  pausedAt: null,
  phase: 'draft',
  concludedAt: null,
  createdAt: '2026-10-01T09:00:00Z',
  permissions: [],
};

function answered(status: number): ApiError {
  const problem = { type: 'https://soirely.com/errors/not_found', title: 'No.', status };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('the event open', () => {
  it('keeps a link followed on a cold start for the first organisation that loads', () => {
    const linked = { in: undefined, id: 'evt_gala' };

    expect(selectionIn(linked, undefined)).toBe(linked);
    expect(selectionIn(linked, 'org_a')).toEqual({ in: 'org_a', id: 'evt_gala' });
  });

  it('stays open within its organisation', () => {
    const open = { in: 'org_a', id: 'evt_gala' };

    expect(selectionIn(open, 'org_a')).toBe(open);
  });

  it('is cleared by switching organisation, and stays cleared on switching back', () => {
    const switched = selectionIn({ in: 'org_a', id: 'evt_gala' }, 'org_b');

    expect(switched).toEqual({ in: 'org_b', id: null });
    expect(selectionIn(switched, 'org_a')).toEqual({ in: 'org_a', id: null });
  });
});

describe('an event read on its own', () => {
  it('is shown when it belongs to the organisation', () => {
    expect(openedOf({ event: gala }, 'org_a')).toEqual({ kind: 'loaded', event: gala });
  });

  it('is not found when it belongs to another organisation', () => {
    expect(openedOf({ event: gala }, 'org_b')).toEqual({ kind: 'notFound' });
  });

  it('is not found when the API refuses it or has no such event', () => {
    expect(openedOf({ error: answered(403) }, 'org_a')).toEqual({ kind: 'notFound' });
    expect(openedOf({ error: answered(404) }, 'org_a')).toEqual({ kind: 'notFound' });
  });

  it('failed, to be tried again, on anything else', () => {
    expect(openedOf({ error: answered(500) }, 'org_a')).toEqual({ kind: 'failed' });
    expect(openedOf({ error: new TypeError('offline') }, 'org_a')).toEqual({ kind: 'failed' });
  });
});

describe('the event open, before asking the API', () => {
  it('waits for the account to load rather than showing not found', () => {
    expect(openedWithoutAsking(false, null)).toEqual({ kind: 'loading' });
  });

  it('shows not found to an account with no organisation', () => {
    expect(openedWithoutAsking(true, null)).toEqual({ kind: 'notFound' });
  });

  it('asks the API for a Member, who holds nothing across the organisation (sc-29914)', () => {
    expect(openedWithoutAsking(true, { permissions: [] })).toBeNull();
  });
});

describe('the pane beside the list on a tablet on its side', () => {
  const none = { kind: 'loaded', unfinished: [], pastTotal: 0 } as const;
  const listed = { kind: 'loaded', unfinished: [gala], pastTotal: 0 } as const;
  const onlyPast = { kind: 'loaded', unfinished: [], pastTotal: 1 } as const;

  it('is not shown for an organisation with no events', () => {
    expect(hasNoEvents(none)).toBe(true);
    expect(pageless(none, false)).toBe(true);
  });

  it("is not shown while the failed card takes the list's place", () => {
    expect(pageless({ kind: 'failed' }, false)).toBe(true);
  });

  it('shows beside the loading line', () => {
    expect(pageless({ kind: 'loading' }, false)).toBe(false);
  });

  it('shows once there are events to choose from, past ones included', () => {
    expect(pageless(listed, false)).toBe(false);
    expect(hasNoEvents(onlyPast)).toBe(false);
    expect(pageless(onlyPast, false)).toBe(false);
  });

  it('shows while an event is open in it, whatever the list shows', () => {
    expect(pageless(none, true)).toBe(false);
    expect(pageless({ kind: 'failed' }, true)).toBe(false);
  });
});

describe("a link to another of the account's organisations", () => {
  const memberships = [{ id: 'org_a' }, { id: 'org_b' }];

  it("moves the account into the event's organisation from Overview", () => {
    expect(openedOrMoved(gala, 'org_b', memberships, true, 'org_b')).toEqual({ moves: 'org_a' });
  });

  it('reads as not found from Guests, and stays where it is', () => {
    expect(openedOrMoved(gala, 'org_b', memberships, false, 'org_b')).toEqual({
      opened: { kind: 'notFound' },
    });
  });

  it('reads as not found where the account is no member', () => {
    expect(openedOrMoved(gala, 'org_b', [{ id: 'org_b' }], true, 'org_b')).toEqual({
      opened: { kind: 'notFound' },
    });
  });

  it('stays where the switcher puts it after the move, and reads not found there (sc-46032)', () => {
    const opened = linkFromIn({ eventId: 'ev_gala', from: 'org_b' }, 'ev_gala', 'org_b');
    const moved = linkFromIn(opened, 'ev_gala', 'org_a');
    const picked = linkFromIn(moved, 'ev_gala', 'org_b');

    expect(openedOrMoved(gala, 'org_b', memberships, true, opened.from)).toEqual({
      moves: 'org_a',
    });
    expect(picked.from).toBeNull();
    expect(openedOrMoved(gala, 'org_b', memberships, true, picked.from)).toEqual({
      opened: { kind: 'notFound' },
    });
  });

  it('moves from the first organisation to load on a cold start, and again for another event', () => {
    const cold = linkFromIn({ eventId: 'ev_gala', from: undefined }, 'ev_gala', 'org_b');
    const another = linkFromIn({ eventId: 'ev_gala', from: null }, 'ev_other', 'org_b');

    expect(openedOrMoved(gala, 'org_b', memberships, true, cold.from)).toEqual({ moves: 'org_a' });
    expect(another.from).toBe('org_b');
  });

  it('opens the event where it is held, from any area', () => {
    expect(openedOrMoved(gala, 'org_a', memberships, false, 'org_b')).toEqual({
      opened: { kind: 'loaded', event: gala },
    });
  });
});
