import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { openedOf, openedWithoutAsking, selectionIn } from './eventsOpen.ts';

const gala: OrganisationEvent = {
  id: 'evt_gala',
  organisationId: 'org_a',
  name: 'Gala',
  type: 'wedding',
  status: 'draft',
  startsAt: '2026-11-14T16:00',
  endsAt: '2026-11-14T23:00',
  venue: null,
  timeZone: 'Europe/London',
  dayCount: 1,
  currency: 'GBP',
  cover: null,
  madeLiveAt: null,
  pausedAt: null,
  phase: 'draft',
  concludedAt: null,
  createdAt: '2026-10-01T09:00:00Z',
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

  it('shows not found to a role that cannot read events', () => {
    expect(openedWithoutAsking(true, { permissions: ['members.read'] })).toEqual({
      kind: 'notFound',
    });
  });

  it('asks the API for a role that reads events', () => {
    expect(openedWithoutAsking(true, { permissions: ['events.read'] })).toBeNull();
  });
});
