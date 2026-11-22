import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BACK_KEY, eventBack, overviewGivesWay } from './eventBack.ts';

const locales = ['en', 'es', 'fr', 'pt'].map(
  (locale) =>
    JSON.parse(readFileSync(join('src', 'i18n', 'locales', `${locale}.json`), 'utf8')) as Record<
      string,
      unknown
    >,
);

function over(name: string) {
  return eventBack([{ name }, { name: 'events/[id]/index' }], 1, undefined);
}

describe('an event’s ‹ names the screen behind it (sc-83008)', () => {
  it.each([
    ['events/index', 'events'],
    ['index', 'today'],
    ['calendar', 'calendar'],
    ['search', 'search'],
    ['notifications', 'notifications'],
    ['settings/data-and-control/audit-log', 'auditLog'],
    ['settings/data-and-control/audit-entry', 'entry'],
  ])('over %s reads %s and goes back to it', (route, screen) => {
    expect(over(route)).toEqual({ screen, way: 'back' });
  });

  it('reads Events and opens Events with nothing behind it', () => {
    expect(eventBack([{ name: 'events/[id]/index' }], 0, undefined)).toEqual({
      screen: 'events',
      way: 'events',
    });
  });

  it('reads Events and opens Events over a screen it has no name for', () => {
    expect(over('settings/members')).toEqual({ screen: 'events', way: 'events' });
    expect(over('constructor')).toEqual({ screen: 'events', way: 'events' });
  });

  it('opens Search again with what was typed when a tablet’s palette closed before the event', () => {
    expect(eventBack([{ name: 'calendar' }, { name: 'events/[id]/index' }], 1, 'gala')).toEqual({
      screen: 'search',
      way: 'search',
      term: 'gala',
    });
  });

  it('names each screen with a key every locale already has', () => {
    for (const key of Object.values(BACK_KEY)) {
      for (const messages of locales) {
        const found = key
          .split('.')
          .reduce<unknown>(
            (at, part) =>
              typeof at === 'object' && at != null
                ? (at as Record<string, unknown>)[part]
                : undefined,
            messages,
          );
        expect(typeof found, key).toBe('string');
      }
    }
  });
});

describe('Refreshing… gives way to Overview’s ‹ (sc-83008)', () => {
  it('on a phone and upright, where ‹ shows above Overview', () => {
    expect(overviewGivesWay('phone', true)).toBe(true);
    expect(overviewGivesWay('tabletPortrait', true)).toBe(true);
  });

  it('nowhere ‹ does not show', () => {
    expect(overviewGivesWay('tabletLandscape', true)).toBe(false);
    expect(overviewGivesWay('phone', false)).toBe(false);
  });
});
