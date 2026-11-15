import { EVENT_TYPES } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { AREAS, EVENTS, MORE_AREAS, TYPE_WORDS, sampleEvent } from './EventsSample.ts';
import { meshFor } from '../../kit/today.ts';

const DRAWN: Record<string, string> = {
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

describe('the sample the app and web demos share', () => {
  it('has the spec’s twenty ids, each giving the colour the boards draw', () => {
    expect(EVENTS.map(({ id }) => id)).toEqual(Object.keys(DRAWN));
    for (const { id } of EVENTS) expect(meshFor(id)).toBe(DRAWN[id]);
  });

  it('starts and ends each event at its local time, in its own zone', () => {
    const local = (moment: string, timeZone: string) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        dateStyle: 'short',
        timeStyle: 'short',
        hourCycle: 'h23',
      }).format(new Date(moment));

    const quince = sampleEvent('evt-quince-4');
    expect(quince == null ? null : local(quince.startsAt, quince.timeZone)).toBe(
      '2026-10-10, 18:00',
    );
    const shower = sampleEvent('evt-shower-2');
    expect(shower == null ? null : local(shower.startsAt, shower.timeZone)).toBe(
      '2026-10-24, 13:00',
    );
    for (const event of EVENTS)
      expect(Date.parse(event.endsAt)).toBeGreaterThan(Date.parse(event.startsAt));
  });

  it('never falls on a Sunday', () => {
    for (const event of EVENTS)
      expect(
        new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: event.timeZone }).format(
          new Date(event.startsAt),
        ),
      ).not.toBe('Sun');
  });

  it('names every type in main’s words, and People after Staff', () => {
    expect(Object.keys(TYPE_WORDS)).toEqual([...EVENT_TYPES]);
    expect(AREAS.slice(6, 8)).toEqual(['staff', 'people']);
    expect(MORE_AREAS).toEqual(['seating', 'schedule', 'staff', 'people', 'budget', 'reports']);
  });
});
