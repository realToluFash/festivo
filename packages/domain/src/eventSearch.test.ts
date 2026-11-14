import { describe, expect, it } from 'vitest';

import {
  NO_EVENTS_FILTERS,
  eventsLookOf,
  eventsLookParams,
  eventsSearchOf,
  filtered,
  searching,
  whenOfSpan,
  whenSpan,
  withHostToggled,
  withTypeToggled,
} from './eventSearch.ts';

const MONDAY = 1;
const SUNDAY = 0;

describe('whenSpan', () => {
  it('starts This week on the locale’s first day', () => {
    expect(whenSpan({ kind: 'week' }, '2026-11-12', MONDAY)).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
    expect(whenSpan({ kind: 'week' }, '2026-11-12', SUNDAY)).toEqual({
      from: '2026-11-08',
      to: '2026-11-14',
    });
  });

  it('runs This month from its first to its last day', () => {
    expect(whenSpan({ kind: 'month' }, '2026-02-12', MONDAY)).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('runs Next 3 months from today, to the month’s last day where the date does not exist', () => {
    expect(whenSpan({ kind: 'next3' }, '2026-11-30', MONDAY)).toEqual({
      from: '2026-11-30',
      to: '2027-02-28',
    });
  });

  it('is nothing for Any time', () => {
    expect(whenSpan({ kind: 'any' }, '2026-11-12', MONDAY)).toBeNull();
  });
});

describe('whenOfSpan', () => {
  it('reads a preset’s days back as the preset', () => {
    expect(whenOfSpan('2026-11-01', '2026-11-30', '2026-11-12', MONDAY)).toEqual({
      kind: 'month',
    });
  });

  it('reads other days as Between dates', () => {
    expect(whenOfSpan('2026-11-02', '', '2026-11-12', MONDAY)).toEqual({
      kind: 'between',
      from: '2026-11-02',
      to: '',
    });
  });
});

describe('the address', () => {
  it('reads q, the types, the days and each host', () => {
    const look = eventsLookOf(
      new URLSearchParams(
        '?q=gala&type=birthday,wedding,dinner&from=2026-11-09&to=2026-11-15&host=Ana&host=Bo',
      ),
      '2026-11-12',
      MONDAY,
    );

    expect(look).toEqual({
      q: 'gala',
      filters: { types: ['wedding', 'birthday'], when: { kind: 'week' }, hosts: ['Ana', 'Bo'] },
    });
  });

  it('ignores a day that is not one', () => {
    expect(
      eventsLookOf(new URLSearchParams('?from=2026-13-40'), '2026-11-12', MONDAY).filters.when,
    ).toEqual({ kind: 'any' });
  });

  it('writes them back, keeping the other parameters', () => {
    const params = eventsLookParams(
      {
        q: 'gala',
        filters: { types: ['wedding', 'birthday'], when: { kind: 'week' }, hosts: ['Ana', 'Bo'] },
      },
      new URLSearchParams('?q=old&tab=past'),
      '2026-11-12',
      MONDAY,
    );

    expect(params.toString()).toBe(
      'tab=past&q=gala&type=wedding%2Cbirthday&from=2026-11-09&to=2026-11-15&host=Ana&host=Bo',
    );
  });
});

describe('eventsSearchOf', () => {
  it('is nothing while nothing is searched or filtered', () => {
    expect(eventsSearchOf({ q: 'g', filters: NO_EVENTS_FILTERS }, '2026-11-12', MONDAY)).toBeNull();
  });

  it('asks for the trimmed search and the days a When covers', () => {
    expect(
      eventsSearchOf(
        { q: ' gala ', filters: { ...NO_EVENTS_FILTERS, when: { kind: 'month' } } },
        '2026-11-12',
        MONDAY,
      ),
    ).toEqual({ q: 'gala', from: '2026-11-01', to: '2026-11-30' });
  });
});

describe('choices', () => {
  it('keeps the types in the menu’s order', () => {
    const one = withTypeToggled(NO_EVENTS_FILTERS, 'birthday');

    expect(withTypeToggled(one, 'wedding').types).toEqual(['wedding', 'birthday']);
    expect(withTypeToggled(one, 'birthday').types).toEqual([]);
  });

  it('keeps a host the menu no longer offers', () => {
    const kept = { ...NO_EVENTS_FILTERS, hosts: ['Gone'] };

    expect(withHostToggled(kept, 'Ana', ['Ana', 'Bo']).hosts).toEqual(['Ana', 'Gone']);
  });

  it('says what is searched and filtered', () => {
    expect([searching(' g '), searching('ga'), filtered(NO_EVENTS_FILTERS)]).toEqual([
      false,
      true,
      false,
    ]);
  });
});
