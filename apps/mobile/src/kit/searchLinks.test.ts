import { describe, expect, it } from 'vitest';

import { eventsSearchHref, searchOffered, searchRowHref } from './searchLinks.ts';

describe('Search’s links (sc-39534)', () => {
  it('opens an event on its page', () => {
    expect(searchRowHref({ kind: 'event', id: 'ev 1', name: 'Gala', line: '' })).toBe(
      '/events/ev%201',
    );
  });

  it('opens a guest’s details on their event’s Guests', () => {
    expect(searchRowHref({ kind: 'guest', id: 'g1', name: 'Inês', line: '', event: 'ev1' })).toBe(
      '/events/ev1?area=guests&guest=g1',
    );
  });

  it('opens Members on a member’s row', () => {
    expect(
      searchRowHref({
        kind: 'member',
        id: 'm1',
        name: 'Ada',
        line: '',
        standing: null,
        invitation: false,
      }),
    ).toBe('/settings/members?member=m1');
  });

  it('opens Events searched for the term', () => {
    expect(eventsSearchHref('garden & co')).toBe('/events?q=garden%20%26%20co');
  });
});

describe('Search while suspended (sc-82858)', () => {
  it('is absent while the member is suspended from the organisation in use', () => {
    expect(searchOffered({ organisation: { id: 'b' }, pausedIn: { id: 'a' } })).toBe(false);
  });

  it('is back once the member switches to an organisation they can act in', () => {
    expect(searchOffered({ organisation: { id: 'b' }, pausedIn: null })).toBe(true);
  });

  it('is absent with no organisation at all', () => {
    expect(searchOffered({ organisation: null })).toBe(false);
  });
});
