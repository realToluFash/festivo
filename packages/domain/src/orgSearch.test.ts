import { describe, expect, test } from 'vitest';

import { searchFieldKeys, searchGroups, searchMoved, searchTotal } from './orgSearch.ts';

const word = (key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`;
const now = new Date('2026-11-15T12:00:00Z');

const event = {
  id: 'e1',
  name: 'Gala',
  status: 'live' as const,
  startsAt: '2026-11-14T16:00:00+00:00',
  endsAt: '2026-11-14T23:00:00+00:00',
  timeZone: 'Europe/London',
  concludedAt: null,
  venue: { name: 'The Landmark', address: { city: 'London' } },
};

describe('the sidebar’s Search (sc-39534)', () => {
  test('the field names only the kinds the person may find, and nothing to find is Search with no hint', () => {
    expect(searchFieldKeys({ events: true, guests: true, members: true })).toEqual({
      placeholder: 'search.field.egm',
      hint: 'search.hint.egm',
    });
    expect(searchFieldKeys({ events: true, guests: false, members: true }).placeholder).toBe(
      'search.field.em',
    );
    expect(searchFieldKeys({ events: false, guests: false, members: false })).toEqual({
      placeholder: 'search.row',
      hint: null,
    });
  });

  test('groups keep Events, Guests, Members, leave out a kind with no match, and only Events offers more past five', () => {
    const groups = searchGroups(
      {
        events: { total: 7, matches: [event] },
        guests: { total: 0, matches: [] },
        members: null,
      },
      word,
      now,
      'en-GB',
    );

    expect(groups.map(({ key, total, more }) => ({ key, total, more }))).toEqual([
      { key: 'events', total: 7, more: true },
    ]);
    expect(groups[0]?.rows[0]?.line).toContain('search.line.venueCity');
    expect(searchTotal(groups)).toBe(7);
  });

  test('an event’s dates are the short weekday the demo draws, with the year only when not this year', () => {
    const next = {
      ...event,
      id: 'e2',
      startsAt: '2027-05-22T16:00:00+01:00',
      endsAt: '2027-05-23T01:00:00+01:00',
    };
    const [events] = searchGroups(
      { events: { total: 2, matches: [event, next] }, guests: null, members: null },
      (key, values) => (key === 'search.line.event' ? String(values?.dates) : word(key, values)),
      now,
      'en-US',
    );

    expect(events?.rows.map((row) => row.line)).toEqual([
      'Sat, Nov 14',
      'search.line.days {"first":"Sat, May 22, 2027","last":"Sun, May 23, 2027"}',
    ]);
  });

  test('a guest shows their event and its first day, never contact details', () => {
    const [guests] = searchGroups(
      {
        events: null,
        guests: {
          total: 6,
          matches: [
            {
              id: 'g1',
              name: 'Inês Duarte',
              event: { id: 'e1', name: 'Gala', startsAt: event.startsAt, timeZone: event.timeZone },
            },
          ],
        },
        members: null,
      },
      word,
      now,
      'en-GB',
    );

    expect(guests?.more).toBe(false);
    expect(guests?.rows[0]).toEqual({
      kind: 'guest',
      id: 'g1',
      name: 'Inês Duarte',
      line: 'search.line.guest {"event":"Gala","day":"Sat 14 Nov"}',
      event: 'e1',
    });
  });

  test('a member shows email and role, a standing when not Active, and an Invited person’s email as the name', () => {
    const [members] = searchGroups(
      {
        events: null,
        guests: null,
        members: {
          total: 2,
          matches: [
            {
              id: 'm1',
              kind: 'member',
              name: 'Inês Santos',
              email: 'ines@ire.events',
              role: { seededAs: 'member', name: null },
              status: 'suspended',
            },
            {
              id: 'i1',
              kind: 'invitation',
              name: null,
              email: 'ines.moura@example.com',
              role: { seededAs: 'administrator', name: null },
              status: 'invited',
            },
          ],
        },
      },
      word,
      now,
      'en-GB',
    );

    expect(members?.rows).toEqual([
      {
        kind: 'member',
        id: 'm1',
        name: 'Inês Santos',
        line: 'search.line.member {"email":"ines@ire.events","role":"roles.member"}',
        standing: 'suspended',
        invitation: false,
      },
      {
        kind: 'member',
        id: 'i1',
        name: 'ines.moura@example.com',
        line: 'roles.administrator',
        standing: 'invited',
        invitation: true,
      },
    ]);
  });

  test('the arrows stop at either end and Home and End jump there', () => {
    expect(searchMoved(0, 'ArrowUp', 3)).toBe(0);
    expect(searchMoved(2, 'ArrowDown', 3)).toBe(2);
    expect(searchMoved(1, 'End', 3)).toBe(2);
    expect(searchMoved(1, 'Home', 3)).toBe(0);
    expect(searchMoved(0, 'ArrowDown', 0)).toBeNull();
    expect(searchMoved(0, 'a', 3)).toBeNull();
  });
});
