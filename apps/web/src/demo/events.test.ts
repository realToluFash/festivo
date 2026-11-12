import { NO_EVENTS_FILTERS, whenSpan } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  CLOCKS,
  EVENTS_PAGES,
  EVENT_STATES,
  type EventStateName,
  type SampleEvent,
  cardOf,
  eventStateOf,
  listStart,
  listStateOf,
  listed,
  localDay,
  manageOf,
  matches,
  resetSample,
  sampleEvent,
  sampleEvents,
  stateFits,
  suggestionsFor,
  wallOf,
} from './events.ts';
import { meshFor } from '../mesh.ts';

const COLOURS = { wed: 'rose', ireti: 'teal', party: 'accent', draft: 'amber' } as const;

const DRAWN: Record<string, (typeof COLOURS)[keyof typeof COLOURS]> = {
  'evt-wed-4': 'rose',
  'evt-ireti-2': 'teal',
  'evt-gala-4': 'amber',
  'evt-party-2': 'accent',
  'evt-shower-2': 'rose',
  'evt-cena-4': 'teal',
  'evt-draft-4': 'amber',
  'evt-off': 'accent',
  'evt-grad-3': 'teal',
  'evt-rafa-2': 'rose',
  'evt-quince-4': 'amber',
  'evt-mtl-3': 'accent',
  'evt-chidi-2': 'teal',
  'evt-naming-3': 'amber',
  'evt-summer-3': 'accent',
  'evt-anniv-4': 'rose',
  'evt-sofia': 'teal',
  'evt-grace': 'amber',
  'evt-lea-2': 'rose',
  'evt-tomi-3': 'accent',
};

function event(id: string): SampleEvent {
  resetSample();
  const found = sampleEvent(id);
  if (found == null) throw new Error(id);

  return found;
}

function ids(events: readonly SampleEvent[]): string[] {
  return events.map((one) => one.id);
}

describe('Events in A at a desk, the model (sc-30304)', () => {
  it('holds the spec’s twenty ids, each in the colour main’s meshFor gives it', () => {
    resetSample();

    expect(ids(sampleEvents()).sort()).toEqual(Object.keys(DRAWN).sort());
    for (const one of sampleEvents()) {
      expect(COLOURS[meshFor(one.id)], one.id).toBe(DRAWN[one.id]);
      expect(one.mesh, one.id).toBe(meshFor(one.id));
    }
  });

  it('lists Upcoming soonest first, Drafts the passed one first, and Past most recently over first', () => {
    resetSample();
    const home = listed(sampleEvents(), CLOCKS.rest);

    expect(ids(home.upcoming)).toEqual(['evt-wed-4', 'evt-ireti-2', 'evt-gala-4', 'evt-party-2']);
    expect(ids(home.drafts)).toEqual(['evt-shower-2', 'evt-cena-4', 'evt-draft-4']);
    expect(home.past).toHaveLength(13);
    expect(home.past.at(-1)?.id).toBe('evt-tomi-3');
  });

  it('matches a name or venue ignoring case and accents, and a day of it in the span', () => {
    resetSample();
    const lucia = sampleEvents().filter((one) =>
      matches(one, { q: 'LUCIA', filters: NO_EVENTS_FILTERS }, null),
    );
    const nothing = {
      q: 'garden party',
      filters: { ...NO_EVENTS_FILTERS, types: ['wedding'] as const },
    };
    const inNovember = sampleEvents().filter((one) =>
      matches(one, { q: '', filters: NO_EVENTS_FILTERS }, { from: '2026-11-01', to: '2026-11-30' }),
    );

    expect(ids(lucia).sort()).toEqual(['evt-cena-4', 'evt-gala-4', 'evt-quince-4']);
    expect(sampleEvents().filter((one) => matches(one, nothing, null))).toEqual([]);
    expect(inNovember.length).toBeGreaterThan(0);
    expect(inNovember.length).toBeLessThan(sampleEvents().length);
  });

  it('gives the card one step for each phase', () => {
    const step = (id: string, now = CLOCKS.rest) => cardOf(event(id), now).step;

    expect(step('evt-draft-4')).toMatchObject({ kind: 'button', does: 'makeLive' });
    expect(step('evt-shower-2')).toMatchObject({ kind: 'button', does: 'changeDates' });
    expect(step('evt-party-2')).toMatchObject({ kind: 'button', does: 'resume' });
    expect(step('evt-off')).toMatchObject({ kind: 'button', does: 'duplicate' });
    expect(step('evt-wed-4', CLOCKS.finished)).toMatchObject({ kind: 'button', does: 'duplicate' });
    expect(step('evt-wed-4')).toMatchObject({
      kind: 'next',
      title: 'Next up: Adaeze & Tunde’s wedding starts',
    });
  });

  it('names the year on the card’s starts line only when it isn’t this year (sc-30413, 12 Nov)', () => {
    const line = (one: SampleEvent) => {
      const step = cardOf(one, CLOCKS.rest).step;

      return step.kind === 'next' ? step.line : null;
    };
    const nextYear = {
      ...event('evt-wed-4'),
      startsAt: '2027-01-09T14:00:00Z',
      endsAt: '2027-01-09T22:00:00Z',
    };

    expect(line(event('evt-wed-4'))).not.toMatch(/2026/);
    expect(line(nextYear)).toMatch(/2027.*14:00/);
  });

  it('offers Pause while live, Call off before it starts, End now while on, and only Duplicate and Delete once over', () => {
    expect(manageOf(event('evt-wed-4'), CLOCKS.rest)).toEqual([
      'duplicate',
      'pause',
      'callOff',
      'delete',
    ]);
    expect(manageOf(event('evt-wed-4'), CLOCKS.now)).toEqual([
      'duplicate',
      'pause',
      'endNow',
      'delete',
    ]);
    expect(manageOf(event('evt-wed-4'), CLOCKS.finished)).toEqual(['duplicate', 'delete']);
    expect(manageOf(event('evt-off'), CLOCKS.rest)).toEqual(['duplicate', 'delete']);
  });

  it('opens each state only on the event it was drawn on, and ignores a state it does not know', () => {
    expect(eventStateOf('nonsense')).toBeNull();
    expect(listStateOf('nonsense')).toBeNull();
    expect(stateFits('callOff', event('evt-wed-4'))).toBe(false);
    expect(stateFits('callOff', event('evt-party-2'))).toBe(true);
    for (const [state, id] of Object.entries(EVENT_STATES))
      expect(stateFits(state as EventStateName, event(id)), state).toBe(true);
  });

  it.each(['manyFilters', 'manyFiltersOpen', 'longHost'] as const)(
    'opens %s on results this week, not on no match',
    (state) => {
      const look = listStart(state).look;
      const today = localDay(CLOCKS.rest, 'Europe/London');

      expect(look).not.toBeNull();
      for (const firstDay of [0, 1, 6]) {
        const span = look == null ? null : whenSpan(look.filters.when, today, firstDay);

        expect(
          sampleEvents().some((one) => look != null && matches(one, look, span)),
          `week from day ${firstDay}`,
        ).toBe(true);
      }
    },
  );

  it('links every state from the demo home, on its own event', () => {
    const links = EVENTS_PAGES.flatMap((page) => page.states.map((one) => one.to));

    for (const [state, id] of Object.entries(EVENT_STATES))
      expect(links, state).toContain(`/demo/events/${id}?state=${state}`);
    for (const state of [
      'first',
      'drafts',
      'past',
      'pastMore',
      'offline',
      'filterOpen',
      'manyFilters',
      'manyFiltersOpen',
      'longHost',
    ])
      expect(links, state).toContain(`/demo/events?state=${state}`);
    expect(links).toContain('/demo/events?q=lucia');
    expect(links).toContain('/demo/events?type=wedding,birthday');
  });

  it('suggests a venue from three characters, and reads times in the event’s own zone', () => {
    expect(suggestionsFor('Ek')).toEqual([]);
    expect(suggestionsFor('Eko Hot').map((one) => one.name)).toEqual([
      'Eko Hotel',
      'Eko Hotel Convention Centre',
      'Eko Signature',
    ]);
    expect(wallOf('2026-11-14T18:30:00Z', 'Europe/Madrid')).toEqual({
      date: '2026-11-14',
      time: '19:30',
    });
    expect(wallOf('2026-10-11T00:00:00Z', 'America/Mexico_City')).toEqual({
      date: '2026-10-10',
      time: '18:00',
    });
  });
});
