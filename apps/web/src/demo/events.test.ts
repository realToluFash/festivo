import { describe, expect, it } from 'vitest';

import {
  CLOCKS,
  EVENTS_PAGES,
  EVENT_STATES,
  type EventStateName,
  NO_FILTERS,
  type SampleEvent,
  cardOf,
  eventStateOf,
  filtersOf,
  listStateOf,
  listed,
  manageOf,
  matches,
  noMatchLine,
  paramsOf,
  resetSample,
  sampleEvent,
  sampleEvents,
  stateFits,
  suggestionsFor,
  wallOf,
  whenOf,
  whenRange,
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

  it('reads search and filters from the address, several types as one comma list, and writes them back without the state', () => {
    const filters = filtersOf(new URLSearchParams('q=lucia&type=birthday,wedding,nonsense'));

    expect(filters).toEqual({ ...NO_FILTERS, q: 'lucia', types: ['wedding', 'birthday'] });
    expect(paramsOf(filters, new URLSearchParams('state=search&area=x')).toString()).toBe(
      'area=x&q=lucia&type=wedding%2Cbirthday',
    );
  });

  it('matches a name or venue ignoring case and accents, and says what found nothing', () => {
    resetSample();
    const lucia = sampleEvents().filter((one) => matches(one, { ...NO_FILTERS, q: 'LUCIA' }));
    const nothing = { ...NO_FILTERS, q: 'garden party', types: ['wedding'] as const };

    expect(ids(lucia).sort()).toEqual(['evt-cena-4', 'evt-gala-4', 'evt-quince-4']);
    expect(sampleEvents().filter((one) => matches(one, nothing))).toEqual([]);
    expect(noMatchLine(nothing, CLOCKS.rest)).toBe(
      'You searched for “garden party” and filtered by Wedding.',
    );
  });

  it('turns This week, This month and the next three months into days, and back', () => {
    expect(whenRange('week', CLOCKS.rest)).toEqual(['2026-11-02', '2026-11-08']);
    expect(whenRange('month', CLOCKS.rest)).toEqual(['2026-11-01', '2026-11-30']);
    expect(whenRange('quarter', CLOCKS.rest)).toEqual(['2026-11-03', '2027-02-03']);

    const [from, to] = whenRange('week', CLOCKS.rest);
    expect(whenOf({ ...NO_FILTERS, from, to }, CLOCKS.rest)).toBe('week');
    expect(whenOf({ ...NO_FILTERS, from, to: '2026-11-20' }, CLOCKS.rest)).toBe('between');
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
    expect(cardOf(event('evt-off'), CLOCKS.rest).tiles).toEqual([]);
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

  it('links every state from the demo home, on its own event', () => {
    const links = EVENTS_PAGES.flatMap((page) => page.states.map((one) => one.to));

    for (const [state, id] of Object.entries(EVENT_STATES))
      expect(links, state).toContain(`/demo/events/${id}?state=${state}`);
    for (const state of ['first', 'drafts', 'past', 'pastMore', 'offline', 'filterOpen'])
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
