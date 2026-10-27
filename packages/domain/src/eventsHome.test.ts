import { describe, expect, it } from 'vitest';

import { type HomeEvent, eventsHome, withPastPage } from './eventsHome.ts';

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
