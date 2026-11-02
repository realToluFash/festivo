import { afterEach, describe, expect, it } from 'vitest';

import {
  type HomeEvent,
  type HowSoon,
  cardDate,
  eventDays,
  eventsHome,
  forgetEventsTab,
  howSoon,
  howSoonPhrase,
  howSoonWords,
  nextStep,
  rememberEventsTab,
  rememberTabHolding,
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

  it('opens on the tab that holds the event last opened, and as it was after one Happening now (sc-22103)', () => {
    rememberEventsTab('org_1', 'past');
    rememberTabHolding('org_1', 'draft');
    expect(rememberedEventsTab('org_1')).toBe('drafts');

    rememberTabHolding('org_1', 'paused');
    expect(rememberedEventsTab('org_1')).toBe('upcoming');

    rememberTabHolding('org_1', 'finished');
    rememberTabHolding('org_1', 'happening_now');
    expect(rememberedEventsTab('org_1')).toBe('past');
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

describe('nextStep', () => {
  const NOW = new Date('2026-11-01T12:00:00Z');
  const ends = {
    at: '2026-11-15T02:00:00+01:00',
    title: 'Gala ends',
    note: null,
    owner: 'event' as const,
    area: 'event',
    action: null,
  };
  const draft = {
    status: 'draft' as const,
    endsAt: '2026-11-15T02:00:00+01:00',
    milestones: [ends],
  };

  it('asks a Draft to be made live, or its dates changed once its end has passed', () => {
    expect(nextStep(draft, 'draft', NOW)).toEqual({ kind: 'makeLive' });
    expect(nextStep({ ...draft, endsAt: '2026-10-09T23:30:00+01:00' }, 'draft', NOW)).toEqual({
      kind: 'changeDates',
    });
  });

  it('asks a Paused event to be resumed', () => {
    expect(nextStep({ ...draft, status: 'paused' }, 'paused', NOW)).toEqual({ kind: 'resume' });
  });

  it('names the next milestone of any other event, and nothing once none is next', () => {
    const live = { ...draft, status: 'live' as const };

    expect(nextStep(live, 'live', NOW)).toEqual({ kind: 'nextUp', milestone: ends });
    expect(nextStep({ ...live, milestones: [] }, 'happening_now', NOW)).toBeNull();
    expect(nextStep({ ...live, status: 'ended' }, 'finished', NOW)).toBeNull();
  });
});

describe('eventDays', () => {
  const lagos = {
    status: 'live' as const,
    startsAt: '2026-10-31T19:00:00+01:00',
    endsAt: '2026-10-31T23:30:00+01:00',
    timeZone: 'Africa/Lagos',
    concludedAt: null,
  };

  it('reads one day in the event’s own zone, wherever the reader is', () => {
    expect(eventDays({ ...lagos, endsAt: '2026-11-01T00:30:00+02:00' })).toEqual({
      kind: 'oneDay',
      startsAt: lagos.startsAt,
    });
  });

  it('reads the first and last day of one that runs past midnight there', () => {
    expect(eventDays({ ...lagos, endsAt: '2026-11-01T02:00:00+01:00' }).kind).toBe('days');
  });

  it('reads when it was called off', () => {
    expect(
      eventDays({ ...lagos, status: 'ended', concludedAt: '2026-09-30T10:00:00+01:00' }),
    ).toEqual({ kind: 'calledOffOn', concludedAt: '2026-09-30T10:00:00+01:00' });
  });
});

describe('howSoon', () => {
  const now = new Date('2026-10-31T19:57:00+01:00');
  const at = (startsAt: string, endsAt = '2026-12-31T23:00:00+01:00') => ({
    startsAt,
    endsAt,
    timeZone: 'Africa/Lagos',
  });

  it('counts minutes under an hour, rounded down', () => {
    expect(howSoon(at('2026-10-31T20:00:30+01:00'), 'live', now)).toEqual({
      to: 'start',
      count: 3,
      unit: 'minute',
    });
  });

  it('reads 0 minutes in the last minute, never 1', () => {
    expect(howSoon(at('2026-10-31T19:57:40+01:00'), 'live', now)).toEqual({
      to: 'start',
      count: 0,
      unit: 'minute',
    });
  });

  it('counts hours under a day, rounded down', () => {
    expect(howSoon(at('2026-10-31T21:56:00+01:00'), 'live', now)?.count).toBe(1);
    expect(howSoon(at('2026-11-01T10:57:00+01:00'), 'paused', now)).toEqual({
      to: 'start',
      count: 15,
      unit: 'hour',
    });
  });

  it('counts days by the dates in the event’s zone from 24 hours on, never weeks', () => {
    expect(howSoon(at('2026-11-01T20:57:00+01:00'), 'live', now)).toEqual({
      to: 'start',
      count: 1,
      unit: 'day',
    });
    expect(howSoon(at('2026-12-05T08:00:00+01:00'), 'live', now)?.count).toBe(35);
    expect(howSoon(at('2027-12-05T12:00:00+01:00'), 'draft', now)?.count).toBe(400);
  });

  it('counts to the end once under way', () => {
    expect(
      howSoon(at('2026-10-31T19:00:00+01:00', '2026-10-31T22:57:00+01:00'), 'happening_now', now),
    ).toEqual({ to: 'end', count: 3, unit: 'hour' });
    expect(
      howSoon(at('2026-10-31T19:00:00+01:00', '2026-11-03T22:00:00+01:00'), 'paused', now),
    ).toEqual({ to: 'end', count: 3, unit: 'day' });
  });

  it('says nothing once finished, past its end, or for a draft past its start', () => {
    expect(howSoon(at('2026-11-14T16:00:00+01:00'), 'finished', now)).toBeNull();
    expect(
      howSoon(at('2026-10-30T19:00:00+01:00', '2026-10-31T19:00:00+01:00'), 'live', now),
    ).toBeNull();
    expect(howSoon(at('2026-10-31T19:00:00+01:00'), 'draft', now)).toBeNull();
  });
});

describe('howSoonWords', () => {
  const words = (count: number, unit: HowSoon['unit'], locale: string) =>
    howSoonWords({ to: 'start', count, unit }, locale);

  it.each([
    ['en', 'in 32 days', 'tomorrow', 'in 40 minutes', 'this minute'],
    ['es', 'dentro de 32 días', 'mañana', 'dentro de 40 minutos', 'este minuto'],
    ['fr', 'dans 32 jours', 'demain', 'dans 40 minutes', 'cette minute-ci'],
    ['pt', 'dentro de 32 dias', 'amanhã', 'dentro de 40 minutos', 'este minuto'],
  ])('reads CLDR’s long form, auto, in %s', (locale, days, tomorrow, minutes, thisMinute) => {
    expect(words(32, 'day', locale)).toBe(days);
    expect(words(1, 'day', locale)).toBe(tomorrow);
    expect(words(40, 'minute', locale)).toBe(minutes);
    expect(words(0, 'minute', locale)).toBe(thisMinute);
  });
});

describe('howSoonPhrase', () => {
  const event = {
    startsAt: '2026-11-14T09:00:00+01:00',
    endsAt: '2026-11-14T23:00:00+01:00',
    timeZone: 'Europe/Madrid',
  };
  const endsIn = (time: string) => `Ends ${time}`;

  it('says how soon it starts, and how soon it ends once under way', () => {
    expect(howSoonPhrase(event, 'live', new Date('2026-11-13T08:00:00+01:00'), 'pt', endsIn)).toBe(
      'amanhã',
    );
    expect(
      howSoonPhrase(event, 'happening_now', new Date('2026-11-14T22:59:20+01:00'), 'en', endsIn),
    ).toBe('Ends this minute');
  });

  it('has no phrase for a finished event', () => {
    expect(
      howSoonPhrase(event, 'finished', new Date('2026-11-13T12:00:00+01:00'), 'en', endsIn),
    ).toBeNull();
  });
});
