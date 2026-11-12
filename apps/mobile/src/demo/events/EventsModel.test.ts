import { init } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';

import {
  NO_FILTERS,
  cardStep,
  cardTags,
  clockOf,
  datesRow,
  dayTiles,
  editOf,
  finalNumbersOf,
  emptyTabOf,
  eventHref,
  eventStateOf,
  homeOf,
  hostNames,
  hostsRow,
  howSoon,
  instantOf,
  listStart,
  listStateOf,
  manageOf,
  matchesFilters,
  matchesSearch,
  needsName,
  resultsOf,
  rowLine,
  rowTag,
  shownEvent,
  summaryLine,
  tabWidths,
  wallOf,
  withoutTab,
} from './EventsModel.ts';
import { CLOCKS, EVENTS, type SampleEvent, sampleEvent } from './EventsSample.ts';
import { seedFinalNumbers } from './FinalNumbers.ts';
import { say } from './EventsWords.ts';
import { peopleOn } from '../guests/GuestsModel.ts';

const LOCALE = 'en-US';
const reader = new Date(CLOCKS.reader);
const happening = new Date(CLOCKS.happening);
const finished = new Date(CLOCKS.finished);

function event(id: string): SampleEvent {
  const found = sampleEvent(id);
  if (found == null) throw new Error(`${id} is in the sample.`);

  return found;
}

const shown = (id: string, at = reader) => shownEvent(event(id), at);

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);
const names = (events: readonly { name: string }[]) => events.map(({ name }) => name);

describe('the counts', () => {
  const home = homeOf(EVENTS, reader, LOCALE);

  it('holds 4 upcoming, 3 drafts and 13 past on the reader’s clock', () => {
    expect([home.upcoming.length, home.drafts.length, home.past.length]).toEqual([4, 3, 13]);
    expect(summaryLine(home)).toBe('4 upcoming · 3 drafts');
  });

  it('puts the soonest first on Upcoming and Drafts, the latest over first on Past', () => {
    expect(names(home.upcoming)).toEqual([
      'Adaeze & Tunde’s wedding',
      'Ireti at 40',
      'Gala Fundación Lucía',
      'Ire Events end-of-year party',
    ]);
    expect(names(home.drafts)[0]).toBe('Kemi’s baby shower');
    expect(names(home.past).slice(0, 3)).toEqual([
      'Team offsite',
      'Ana’s graduation lunch',
      'Rafael & Inês’s wedding',
    ]);
    expect(names(home.past).at(-1)).toBe('Tomi’s graduation');
  });

  it('counts the wedding as happening now on its second day', () => {
    const now = homeOf(EVENTS, happening, LOCALE);

    expect(now.happeningNow).toBe(1);
    expect(summaryLine(now)).toBe('1 happening now · 3 upcoming · 3 drafts');
  });
});

describe('a row', () => {
  it('says main’s days and the place', () => {
    expect(rowLine(shown('evt-wed-4'), LOCALE)).toBe(
      'Thursday, Nov 5 to Saturday, Nov 7 · The Landmark, London',
    );
    expect(rowLine(shown('evt-gala-4'), LOCALE)).toBe('Saturday, Nov 14 · Casa de América, Madrid');
    expect(rowLine(shown('evt-cena-4'), LOCALE)).toBe('Saturday, Dec 12 · Venue to be confirmed');
    expect(rowLine(shown('evt-off'), LOCALE)).toBe(
      'Called off on Oct 30 · Quinta da Regaleira, Sintra',
    );
  });

  it('is tagged off its tab’s rule, and with its phase in results', () => {
    expect(rowTag(shown('evt-ireti-2'), false)).toBeNull();
    expect(rowTag(shown('evt-party-2'), false)?.word).toBe('Paused');
    expect(rowTag(shown('evt-off'), false)?.word).toBe('Called off');
    expect(rowTag(shown('evt-wed-4', happening), false)?.word).toBe('Happening now');
    expect(rowTag(shown('evt-gala-4'), true)?.word).toBe('Live');
    expect(rowTag(shown('evt-cena-4'), true)?.word).toBe('Draft');
    expect(rowTag(shown('evt-quince-4'), true)?.word).toBe('Finished');
  });

  it('says how soon it starts', () => {
    expect(howSoon(shown('evt-wed-4'), reader)).toBe('in 2 days');
    expect(howSoon(shown('evt-ireti-2'), reader)).toBe('in 10 days');
    expect(howSoon(shown('evt-gala-4'), reader)).toBe('in 11 days');
    expect(howSoon(shown('evt-party-2'), reader)).toBe('in 30 days');
    expect(howSoon(shown('evt-cena-4'), reader)).toBe('in 39 days');
    expect(howSoon(shown('evt-draft-4'), reader)).toBe('in 67 days');
    expect(howSoon(shown('evt-shower-2'), reader)).toBeNull();
  });
});

describe('the card’s one step, by nextStep', () => {
  const step = (id: string, at = reader) => cardStep(shown(id, at), at, LOCALE);

  it('asks a draft to be made live, or its dates changed once its end has passed', () => {
    expect(step('evt-draft-4')).toMatchObject({ action: 'makeLive' });
    expect(step('evt-shower-2')).toMatchObject({ action: 'changeDates' });
  });

  it('says what happens next while it is live or happening', () => {
    expect(step('evt-wed-4')).toEqual({
      kind: 'next',
      title: 'Next up: Adaeze & Tunde’s wedding starts',
      when: 'Thu, Nov 5, 18:00 · in 2 days',
      you: false,
      overdue: false,
    });
    expect(step('evt-wed-4', happening)).toEqual({
      kind: 'next',
      title: 'Next up: Adaeze & Tunde’s wedding ends',
      when: 'Sat, Nov 7, 15:00 · in 1 day',
      you: false,
      overdue: false,
    });
  });

  it('shows final numbers due as Next up, marked You, with no action, until a copy (sc-30812)', () => {
    seedFinalNumbers('finalNumbers');
    expect(step('evt-wed-4')).toEqual({
      kind: 'next',
      title: 'Next up: Give final numbers to the kitchen',
      when: 'Tue, Nov 3, 23:59 · today',
      you: true,
      overdue: false,
    });
    expect(step('evt-ireti-2')).toMatchObject({ you: false });

    seedFinalNumbers('finalNumbersOverdue');
    expect(step('evt-wed-4')).toMatchObject({
      when: 'Mon, Nov 2, 23:59 · 1 day ago',
      you: true,
      overdue: true,
    });
    expect(step('evt-wed-4', happening)).toMatchObject({ you: false });

    seedFinalNumbers('finalNumbersGiven');
    expect(step('evt-wed-4')).toMatchObject({
      title: 'Next up: Adaeze & Tunde’s wedding starts',
      you: false,
    });
    seedFinalNumbers(null);
  });

  it('brings back Give the changes to the kitchen after a copy, due at the date or at the start, never with an action (sc-30692)', () => {
    seedFinalNumbers('changes_due');
    expect(step('evt-wed-4')).toEqual({
      kind: 'next',
      title: 'Next up: Give the changes to the kitchen',
      when: 'Tue, Nov 3, 23:59 · today',
      you: true,
      overdue: false,
    });

    seedFinalNumbers('changes_overdue');
    expect(step('evt-wed-4')).toMatchObject({
      title: 'Next up: Give the changes to the kitchen',
      when: 'Mon, Nov 2, 23:59 · 1 day ago',
      overdue: true,
    });
    expect(step('evt-wed-4', happening)).toMatchObject({ you: false });

    seedFinalNumbers('changes_late');
    expect(finalNumbersOf(sampleEvent('evt-wed-4') as SampleEvent, reader)).toEqual([
      expect.objectContaining({
        title: 'Give the changes to the kitchen',
        at: (sampleEvent('evt-wed-4') as SampleEvent).startsAt,
        action: null,
      }),
    ]);
    seedFinalNumbers(null);
  });

  it('resumes a paused event, and duplicates one that is over', () => {
    expect(step('evt-party-2')).toMatchObject({ action: 'resume' });
    expect(step('evt-wed-4', finished)).toMatchObject({
      action: 'duplicate',
      line: 'Nothing coming up. Every date on this event has passed.',
    });
    expect(step('evt-off')).toMatchObject({
      action: 'duplicate',
      line: "Called off on Fri, Oct 30, 2026, before it started. Guests following their link are told it won't go ahead.",
    });
  });

  it('carries the phase and how soon, or the day it is on', () => {
    expect(cardTags(shown('evt-wed-4'), reader)).toEqual([
      { word: 'Live', mark: 'live' },
      { word: 'in 2 days' },
    ]);
    expect(cardTags(shown('evt-wed-4', happening), happening)).toEqual([
      { word: 'Happening now', mark: 'now' },
      { word: 'Day 2 of 3' },
    ]);
    expect(cardTags(shown('evt-shower-2'), reader)).toEqual([{ word: 'Draft', mark: 'draft' }]);
    expect(cardTags(shown('evt-off'), reader)).toEqual([{ word: 'Called off', mark: 'calledOff' }]);
    expect(cardTags(shown('evt-wed-4', finished), finished)).toEqual([
      { word: 'Finished', mark: 'finished' },
    ]);
    expect(cardTags(shown('evt-party-2'), reader)[0]).toEqual({ word: 'Paused', mark: 'paused' });
  });

  it('draws a tile per day only for an event over several days that is not over', () => {
    expect(
      dayTiles(shown('evt-wed-4'), reader, LOCALE)?.map((tile) => tile.kind === 'day' && tile.day),
    ).toEqual(['5', '6', '7']);
    expect(
      dayTiles(shown('evt-wed-4', happening), happening, LOCALE)?.map(
        (tile) => tile.kind === 'day' && tile.today,
      ),
    ).toEqual([false, true, false]);
    expect(dayTiles(shown('evt-ireti-2'), reader, LOCALE)?.length).toBe(2);
    expect(dayTiles(shown('evt-gala-4'), reader, LOCALE)).toBeNull();
    expect(dayTiles(shown('evt-off'), reader, LOCALE)).toBeNull();
  });
});

describe('the page', () => {
  it('lists only what the phase allows in Manage', () => {
    expect(manageOf(shown('evt-draft-4'), reader)).toEqual(['duplicate', 'delete']);
    expect(manageOf(shown('evt-wed-4'), reader)).toEqual([
      'duplicate',
      'pause',
      'callOff',
      'delete',
    ]);
    expect(manageOf(shown('evt-wed-4', happening), happening)).toEqual([
      'duplicate',
      'pause',
      'endNow',
      'delete',
    ]);
    expect(manageOf(shown('evt-party-2'), reader)).toEqual(['duplicate', 'callOff', 'delete']);
    expect(manageOf(shown('evt-wed-4', finished), finished)).toEqual(['duplicate', 'delete']);
  });

  it('writes Dates with main’s range, and locks them once it is over', () => {
    expect(datesRow(shown('evt-wed-4'), LOCALE)).toEqual({
      title: 'Thu, Nov 5, 2026, 18:00 – Sat, Nov 7, 2026, 15:00',
      line: 'Dates · 3 days · Europe/London',
    });
    expect(datesRow(shown('evt-gala-4'), LOCALE)).toEqual({
      title: 'Sat, Nov 14, 2026, 19:30 – 23:30',
      line: 'Dates · Europe/Madrid',
    });
    expect(datesRow(shown('evt-wed-4', finished), LOCALE).line).toBe(
      "Dates · This event is over, so its start, end and time zone can't be changed.",
    );
  });

  it('names the hosts, or says what having none waits for', () => {
    expect(hostsRow(event('evt-wed-4'), LOCALE).title).toBe('Adaeze Obi and Tunde Bakare');
    expect(hostsRow(event('evt-draft-4'), LOCALE)).toEqual({
      title: 'No hosts yet',
      line: 'Hosted by · The event can be made live once it has at least one.',
    });
  });

  it('asks for the name to be typed once an event has been live, or has anybody on its list', () => {
    expect(needsName(event('evt-cena-4'), peopleOn('evt-cena-4'))).toBe(false);
    expect(needsName(event('evt-draft-4'), peopleOn('evt-draft-4'))).toBe(true);
    expect(needsName(event('evt-wed-4'), 0)).toBe(true);
  });

  it('counts the guest list in Delete as the Guests header does, guests and companions together', () => {
    expect(peopleOn('evt-wed-4')).toBe(156);
    expect(peopleOn('evt-draft-4')).toBe(12);
    expect(peopleOn('evt-cena-4')).toBe(0);
    expect(say.removesGuests('156', 156)).toBe('its guest list, with the 156 people on it');
    expect(say.removesGuests('1', 1)).toBe('its guest list, with the 1 person on it');
  });
});

describe('search and filters (sc-30302)', () => {
  it('finds any part of an event’s or a venue’s name, accents ignored', () => {
    const found = resultsOf(EVENTS, 'lucia', NO_FILTERS, reader, LOCALE);

    expect(found.count).toBe(3);
    expect(found.groups.map(({ tab, events }) => [tab, names(events)])).toEqual([
      ['upcoming', ['Gala Fundación Lucía']],
      ['drafts', ['Cena benéfica Fundación Lucía']],
      ['past', ['Lucía’s quinceañera']],
    ]);
    expect(matchesSearch(event('evt-wed-4'), 'landmark')).toBe(true);
    expect(matchesSearch(event('evt-wed-4'), 'l')).toBe(true);
    expect(matchesSearch(event('evt-ireti-2'), 'landmark')).toBe(false);
  });

  it('widens within a filter and narrows across filters', () => {
    const types = { ...NO_FILTERS, types: ['wedding', 'birthday'] as const };
    const found = resultsOf(EVENTS, '', types, reader, LOCALE);

    expect(found.count).toBe(5);
    expect(found.groups.map(({ events }) => names(events))).toEqual([
      ['Adaeze & Tunde’s wedding', 'Ireti at 40'],
      ['Rafael & Inês’s wedding', 'Chidi’s 30th', 'Festa da Sofia'],
    ]);
    expect(
      resultsOf(EVENTS, '', { ...types, hosts: ['Ireti Bankole'] }, reader, LOCALE).count,
    ).toBe(1);
  });

  it('reads When on the reader’s calendar', () => {
    expect(
      matchesFilters(event('evt-wed-4'), { ...NO_FILTERS, when: { kind: 'week' } }, reader),
    ).toBe(true);
    expect(
      matchesFilters(event('evt-ireti-2'), { ...NO_FILTERS, when: { kind: 'week' } }, reader),
    ).toBe(false);
    const between = { kind: 'between', from: '2026-11-14', to: '2026-12-12' } as const;
    expect(
      resultsOf(EVENTS, '', { ...NO_FILTERS, when: between }, reader, LOCALE).groups.map(
        ({ events }) => names(events),
      ),
    ).toEqual([
      ['Ireti at 40', 'Gala Fundación Lucía', 'Ire Events end-of-year party'],
      ['Cena benéfica Fundación Lucía'],
    ]);
  });

  it('matches nothing for the no-match board', () => {
    const wedding = { ...NO_FILTERS, types: ['wedding'] as const };

    expect(resultsOf(EVENTS, 'garden party', wedding, reader, LOCALE).count).toBe(0);
  });

  it('lists every host on the organisation’s events, A to Z', () => {
    const hosts = hostNames(EVENTS, LOCALE);

    expect(hosts[0]).toBe('Adaeze Obi');
    expect(hosts).toContain('Fundación Lucía');
    expect(new Set(hosts).size).toBe(hosts.length);
  });
});

describe('the states', () => {
  it('opens each list state where the boards draw it, and an unknown one at rest', () => {
    expect(listStart(listStateOf('search')).typed).toBe('lucia');
    expect(listStart(listStateOf('pastMore'))).toMatchObject({ tab: 'past', pastShown: 20 });
    expect(listStateOf('nonsense')).toBeNull();
  });

  it.each(['manyFilters', 'manyFiltersOpen', 'longHost'] as const)(
    'opens %s on results, not on no match',
    (state) => {
      const { typed, filters } = listStart(state);

      expect(resultsOf(EVENTS, typed, filters, reader, LOCALE).count).toBeGreaterThan(0);
    },
  );

  it('opens loading on Upcoming, with no tab emptied', () => {
    expect(listStateOf('loading')).toBe('loading');
    expect(listStart('loading').tab).toBe('upcoming');
    expect(emptyTabOf('loading')).toBeNull();
  });

  it.each([
    ['emptyUpcoming', 'upcoming'],
    ['emptyDrafts', 'drafts'],
    ['emptyPast', 'past'],
  ] as const)('opens %s on %s, with nothing there and events on the other tabs', (state, tab) => {
    expect(listStart(state).tab).toBe(tab);
    expect(emptyTabOf(state)).toBe(tab);
    const home = homeOf(withoutTab(EVENTS, tab, reader, LOCALE), reader, LOCALE);

    expect(home[tab]).toEqual([]);
    for (const other of (['upcoming', 'drafts', 'past'] as const).filter((each) => each !== tab))
      expect(home[other].length).toBeGreaterThan(0);
  });

  it('a state that is not an empty tab empties none', () => {
    expect(emptyTabOf('drafts')).toBeNull();
    expect(emptyTabOf(null)).toBeNull();
  });

  it('reads the clock and the edit from the event’s state', () => {
    expect(clockOf(eventStateOf('now')).toISOString()).toBe('2026-11-06T16:10:00.000Z');
    expect(clockOf(eventStateOf('finished')).toISOString()).toBe('2026-11-11T09:41:00.000Z');
    expect(clockOf(eventStateOf('nonsense')).toISOString()).toBe('2026-11-03T09:41:00.000Z');
    expect(editOf(eventStateOf('showLatest'))).toBe('dates');
    expect(editOf(eventStateOf('lastHost'))).toBe('hosts');
    expect(editOf(eventStateOf('pause'))).toBeNull();
    expect(editOf(eventStateOf('saved'))).toBeNull();
    expect(eventStateOf('loading')).toBe('loading');
    expect(editOf(eventStateOf('loading'))).toBeNull();
  });
});

describe('the wall clock and the instant', () => {
  it('reads a moment as its zone’s day and 24-hour time', () => {
    expect(wallOf('2026-11-05T14:00:00Z', 'Africa/Lagos')).toEqual({
      date: '2026-11-05',
      time: '15:00',
    });
    expect(wallOf('2026-11-05T23:30:00Z', 'Asia/Tokyo')).toEqual({
      date: '2026-11-06',
      time: '08:30',
    });
  });

  it('turns a wall clock back into the instant, either side of a clock change', () => {
    expect(instantOf('2026-11-05', '15:00', 'Africa/Lagos')).toBe('2026-11-05T14:00:00.000Z');
    expect(instantOf('2026-07-01', '09:00', 'Europe/London')).toBe('2026-07-01T08:00:00.000Z');
    expect(instantOf('2026-12-01', '09:00', 'Europe/London')).toBe('2026-12-01T09:00:00.000Z');
    expect(instantOf('2026-11-06', '08:30', 'Asia/Tokyo')).toBe('2026-11-05T23:30:00.000Z');
  });

  it('writes the demo’s paths with their query', () => {
    expect(eventHref('evt-wed-4')).toBe('/demo/events/evt-wed-4');
    expect(eventHref('evt-wed-4', { state: 'dates', area: 'guests' })).toBe(
      '/demo/events/evt-wed-4?state=dates&area=guests',
    );
  });
});

describe('the tabs’ widths', () => {
  it('grows the lit tab to its words and shares the rest, as the board’s 350 row does', () => {
    expect(tabWidths(340, [128, 79, 75])).toEqual([128, 106, 106]);
  });

  it('shares the room equally when every tab’s words fit', () => {
    expect(tabWidths(340, [90, 79, 75])).toEqual([340 / 3, 340 / 3, 340 / 3]);
  });

  it('keeps every tab’s words when the room is too small for them', () => {
    expect(tabWidths(200, [128, 79, 75])).toEqual([128, 79, 75]);
  });
});
