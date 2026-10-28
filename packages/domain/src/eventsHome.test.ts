import { afterEach, describe, expect, it } from 'vitest';

import {
  type HomeEvent,
  cardDate,
  eventsHome,
  forgetEventsTab,
  rememberEventsTab,
  rememberedEventsTab,
  withPastPage,
} from './eventsHome.ts';

const LOADED = new Date('2026-11-01T12:00:00Z');

function event(name: string, rest: Partial<HomeEvent> = {}): HomeEvent {
  return {
    id: name,
    name,
    status: 'live',
    phase: 'live',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
    concludedAt: null,
    ...rest,
  };
}

function home(unfinished: HomeEvent[], now: Date, past: HomeEvent[] = [], pastTotal = past.length) {
  const grouped = eventsHome({ unfinished, past, pastTotal, at: LOADED }, now, 'en');
  const names = (events: HomeEvent[]) => events.map(({ name }) => name);

  return {
    happeningNow: names(grouped.happeningNow),
    upcoming: names(grouped.upcoming),
    drafts: names(grouped.drafts),
    past: names(grouped.past),
    pastCount: grouped.pastCount,
  };
}

describe('eventsHome', () => {
  it('puts each event where its phase is, Paused with the Upcoming', () => {
    const grouped = home(
      [
        event('Tonight', {
          phase: 'happening_now',
          startsAt: '2026-11-01T09:00:00+01:00',
          endsAt: '2026-11-01T23:00:00+01:00',
        }),
        event('Later'),
        event('Paused', {
          status: 'paused',
          phase: 'paused',
          startsAt: '2026-11-10T16:00:00+01:00',
        }),
        event('Draft', { status: 'draft', phase: 'draft' }),
      ],
      LOADED,
      [event('Over', { status: 'ended', phase: 'finished', concludedAt: '2026-10-01T10:00:00Z' })],
    );

    expect(grouped).toEqual({
      happeningNow: ['Tonight'],
      upcoming: ['Paused', 'Later'],
      drafts: ['Draft'],
      past: ['Over'],
      pastCount: 1,
    });
  });

  it('orders by start, the same start by name in the reader’s collation', () => {
    const same = '2026-11-14T16:00:00+01:00';
    const grouped = eventsHome(
      {
        unfinished: [
          event('Zoë', { startsAt: same }),
          event('Émile', { startsAt: same }),
          event('Ada', { startsAt: '2026-11-20T10:00:00Z' }),
        ],
        past: [],
        pastTotal: 0,
        at: LOADED,
      },
      LOADED,
      'fr',
    );

    expect(grouped.upcoming.map(({ name }) => name)).toEqual(['Émile', 'Zoë', 'Ada']);
  });

  it('lists the Finished most recently finished first, a call-off by when it was called off', () => {
    const grouped = home([], LOADED, [
      event('Ended in October', {
        status: 'live',
        phase: 'finished',
        endsAt: '2026-10-20T10:00:00Z',
        concludedAt: '2026-10-20T10:00:00Z',
      }),
      event('Called off', {
        status: 'ended',
        phase: 'finished',
        startsAt: '2026-12-01T10:00:00Z',
        concludedAt: '2026-10-25T10:00:00Z',
      }),
      event('Bravo', { phase: 'finished', concludedAt: '2026-09-01T10:00:00Z' }),
      event('Alpha', { phase: 'finished', concludedAt: '2026-09-01T10:00:00Z' }),
    ]);

    expect(grouped.past).toEqual(['Called off', 'Ended in October', 'Alpha', 'Bravo']);
  });

  it('moves a Live event to Happening now at its start, and to Past at its end', () => {
    const party = event('Party', {
      startsAt: '2026-11-01T14:00:00Z',
      endsAt: '2026-11-01T20:00:00Z',
    });

    expect(home([party], new Date('2026-11-01T13:59:59Z')).upcoming).toEqual(['Party']);
    expect(home([party], new Date('2026-11-01T14:00:00Z')).happeningNow).toEqual(['Party']);
    expect(home([party], new Date('2026-11-01T19:59:59Z')).happeningNow).toEqual(['Party']);

    const over = home([party], new Date('2026-11-01T20:00:00Z'), [], 12);

    expect([over.happeningNow, over.past, over.pastCount]).toEqual([[], ['Party'], 13]);
  });

  it('moves a Paused event to Past at its end, never to Happening now', () => {
    const paused = event('Paused', {
      status: 'paused',
      phase: 'paused',
      startsAt: '2026-11-01T14:00:00Z',
      endsAt: '2026-11-01T20:00:00Z',
    });

    expect(home([paused], new Date('2026-11-01T15:00:00Z')).upcoming).toEqual(['Paused']);
    expect(home([paused], new Date('2026-11-01T20:00:00Z')).past).toEqual(['Paused']);
  });

  it('keeps a Draft in Drafts past its start and its end', () => {
    const draft = event('Draft', {
      status: 'draft',
      phase: 'draft',
      startsAt: '2026-11-01T14:00:00Z',
      endsAt: '2026-11-01T20:00:00Z',
    });

    expect(home([draft], new Date('2026-11-02T00:00:00Z')).drafts).toEqual(['Draft']);
  });

  it('starts an event at midnight in its own zone, whatever the date is elsewhere', () => {
    const midnight = event('New Year', {
      startsAt: '2027-01-01T00:00:00+14:00',
      endsAt: '2027-01-01T06:00:00+14:00',
    });

    expect(home([midnight], new Date('2026-12-31T09:59:59Z')).upcoming).toEqual(['New Year']);
    expect(home([midnight], new Date('2026-12-31T10:00:00Z')).happeningNow).toEqual(['New Year']);
  });

  it('keeps the phase the server gave until the clock passes a boundary after loading', () => {
    const served = event('Served live', {
      phase: 'happening_now',
      startsAt: '2026-11-01T12:30:00Z',
    });

    expect(home([served], LOADED).happeningNow).toEqual(['Served live']);
  });

  it('lists an event loaded in both once, as the Finished page has it', () => {
    const party = event('Party', {
      startsAt: '2026-11-01T10:00:00Z',
      endsAt: '2026-11-01T12:30:00Z',
      phase: 'happening_now',
    });
    const finished = { ...party, phase: 'finished' as const, concludedAt: '2026-11-01T12:30:00Z' };
    const grouped = home([party], new Date('2026-11-01T13:00:00Z'), [finished], 1);

    expect([grouped.happeningNow, grouped.past, grouped.pastCount]).toEqual([[], ['Party'], 1]);
  });
});

describe('withPastPage', () => {
  const past = (count: number, from = 0) =>
    Array.from({ length: count }, (_, index) => event(`Past ${from + index}`));

  it('adds what the page has that is not loaded yet, and keeps the count shown', () => {
    const loaded = { past: past(10), pastPages: 1, pastTotal: 25 };
    const read = withPastPage(loaded, { events: past(10, 9), total: 26 }, 10);

    expect([read.added, read.load.past.length, read.load.pastPages, read.load.pastTotal]).toEqual([
      9, 19, 2, 25,
    ]);
  });

  it('drops the count to what is loaded when the last page leaves fewer than it said', () => {
    const loaded = { past: past(20), pastPages: 2, pastTotal: 25 };
    const read = withPastPage(loaded, { events: past(4, 20), total: 24 }, 10);

    expect(read.load.pastTotal).toBe(24);
  });
});

describe('the tab chosen', () => {
  afterEach(() => forgetEventsTab());

  it('opens on Upcoming, keeps the one chosen, and opens another organisation on Upcoming', () => {
    expect(rememberedEventsTab('org_1')).toBe('upcoming');

    rememberEventsTab('org_1', 'past');

    expect(rememberedEventsTab('org_1')).toBe('past');
    expect(rememberedEventsTab('org_2')).toBe('upcoming');
  });

  it('opens on Upcoming once forgotten', () => {
    rememberEventsTab('org_1', 'drafts');
    forgetEventsTab();

    expect(rememberedEventsTab('org_1')).toBe('upcoming');
  });
});

describe('cardDate', () => {
  const live = { ...event('Gala'), timeZone: 'Europe/Madrid' };
  const NOW = new Date('2026-11-14T12:00:00Z');

  it('reads the start with its distance while it is ahead', () => {
    expect(cardDate(live, 'live', NOW)).toEqual({ kind: 'dateAway', startsAt: live.startsAt });
  });

  it('reads when it started while it is happening', () => {
    expect(cardDate(live, 'happening_now', NOW)).toEqual({
      kind: 'startedToday',
      startsAt: live.startsAt,
    });
  });

  it('reads the day it started once that day is over in its zone', () => {
    const lagos = { ...live, startsAt: '2026-10-27T11:13:00+01:00', timeZone: 'Africa/Lagos' };

    expect(cardDate(lagos, 'happening_now', new Date('2026-10-27T22:59:00Z'))).toEqual({
      kind: 'startedToday',
      startsAt: lagos.startsAt,
    });
    expect(cardDate(lagos, 'happening_now', new Date('2026-10-27T23:00:00Z'))).toEqual({
      kind: 'startedOn',
      startsAt: lagos.startsAt,
    });
  });

  it('reads a start at 23:59 the day before as that day, and one at 00:00 as today', () => {
    const now = new Date('2026-10-28T09:00:00+01:00');
    const lateEvening = {
      ...live,
      startsAt: '2026-10-27T23:59:00+01:00',
      timeZone: 'Africa/Lagos',
    };
    const midnight = { ...lateEvening, startsAt: '2026-10-28T00:00:00+01:00' };

    expect(cardDate(lateEvening, 'happening_now', now).kind).toBe('startedOn');
    expect(cardDate(midnight, 'happening_now', now).kind).toBe('startedToday');
  });

  it('counts the date in the event’s zone, not the reader’s', () => {
    const lagos = { ...live, startsAt: '2026-10-27T22:00:00+01:00', timeZone: 'Africa/Lagos' };
    const stillTheSameDayInNewYork = new Date('2026-10-28T01:00:00+01:00');

    expect(cardDate(lagos, 'happening_now', stillTheSameDayInNewYork).kind).toBe('startedOn');

    const auckland = {
      ...live,
      startsAt: '2026-10-28T08:00:00+13:00',
      timeZone: 'Pacific/Auckland',
    };
    const stillTheDayBeforeInLondon = new Date('2026-10-28T09:00:00+13:00');

    expect(cardDate(auckland, 'happening_now', stillTheDayBeforeInLondon).kind).toBe(
      'startedToday',
    );
  });

  it('reads when it was called off', () => {
    const calledOff = {
      ...live,
      status: 'ended' as const,
      concludedAt: '2026-09-30T10:00:00+02:00',
    };

    expect(cardDate(calledOff, 'finished', NOW)).toEqual({
      kind: 'calledOffOn',
      concludedAt: '2026-09-30T10:00:00+02:00',
    });
  });

  it('reads the start of one that ended after it began', () => {
    const ended = { ...live, status: 'ended' as const, concludedAt: '2026-11-14T23:00:00+01:00' };

    expect(cardDate(ended, 'finished', NOW)).toEqual({
      kind: 'dateAway',
      startsAt: ended.startsAt,
    });
  });
});
