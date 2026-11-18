import { describe, expect, it } from 'vitest';

import { SWITCHER_PAGES } from './switcher.ts';
import {
  E1,
  E2,
  E3,
  E4,
  OUTSIDE_API,
  OUTSIDE_MEMBER_PAGE,
  OUTSIDE_PAGE,
  OUTSIDE_STATES,
  areasAt,
  inOrder,
  openingOf,
  outsideOf,
  outsidePageOf,
  rowLabel,
  rowLine,
  underWay,
  wallClock,
  wallDay,
} from './outsideEvents.ts';

const NOW = new Date('2026-11-07T16:00:00Z');
const names = (events: readonly { id: string }[]) => events.map((event) => event.id);

describe('events from outside (sc-68438)', () => {
  it('is under way from its start, up to but not at its end, compared as instants', () => {
    expect(underWay(E1, NOW)).toBe(true);
    expect(underWay(E1, new Date('2026-11-07T08:30:00Z'))).toBe(true);
    expect(underWay(E1, new Date('2026-11-07T19:00:00Z'))).toBe(false);
    expect(underWay(E3, new Date('2026-11-21T18:30:00Z'))).toBe(true);
    expect(underWay(E3, new Date('2026-11-21T18:29:00Z'))).toBe(false);
    expect(underWay(E2, NOW)).toBe(false);
  });

  it('puts under way first and keeps the API’s order otherwise, never sorting again', () => {
    expect(names(inOrder([E2, E3, E1], NOW))).toEqual([E1.id, E2.id, E3.id]);
    expect(names(inOrder([E3, E4], NOW))).toEqual([E3.id, E4.id]);
    expect(names(inOrder([E4, E3], NOW))).toEqual([E4.id, E3.id]);
    expect(names(inOrder(OUTSIDE_API, NOW))).toEqual([E1.id, E2.id, E3.id, E4.id]);
    expect(names(inOrder(OUTSIDE_API, new Date('2026-11-21T19:00:00Z')))).toEqual([
      E3.id,
      E4.id,
      E1.id,
      E2.id,
    ]);
  });

  it('writes the date and start as the event’s own zone has them, in the reader’s locale', () => {
    expect(wallDay(E3.startsAt, 'en-US')).toBe('Sat, Nov 21');
    expect(wallDay(E3.endsAt, 'en-US')).toBe('Sun, Nov 22');
    expect(wallDay('2026-11-21T23:30:00-08:00', 'en-US')).toBe('Sat, Nov 21');
    expect(wallClock(E3.startsAt)).toBe('19:30');
    expect(rowLine(E2, 'en-US')).toBe('Lumen Feiras · Sat, Nov 14 · 15:00');
    expect(rowLine(E3, 'fr-FR')).toBe(
      'Les Salons de la Bastide Réceptions et Événements · Sat 21 Nov · 19:30',
    );
  });

  it('labels a row with its name, its line and its marks', () => {
    expect(rowLabel(E1, { now: true, here: false })).toBe(`${E1.name}. ${rowLine(E1)}. Under way`);
    expect(rowLabel(E2, { now: false, here: true })).toBe(
      `${E2.name}. ${rowLine(E2)}. You’re here`,
    );
  });

  it('opens each level’s areas, Can edit as the member sidebar has them but Budget', () => {
    expect(areasAt('Can view')).toEqual(['overview', 'guests', 'schedule', 'seating', 'people']);
    expect(areasAt('Can check guests in')).toEqual([
      'checkIn',
      'overview',
      'guests',
      'schedule',
      'seating',
      'people',
    ]);
    expect(areasAt('Can edit')).toEqual([
      'overview',
      'guests',
      'menu',
      'seating',
      'messages',
      'schedule',
      'staff',
      'people',
      'reports',
    ]);
  });

  it('holds each state’s list, and opens a gone grant on the not-found page', () => {
    expect(names(outsideOf('outside-one').held)).toEqual([E2.id]);
    expect(names(outsideOf('outside-two').held)).toEqual([E2.id, E3.id]);
    expect(outsideOf('outside-gone').gone).toEqual([E4.id]);
    expect(outsideOf('inside-member').member).toBe(true);
    expect(openingOf(E4, E2.id, outsideOf('outside-gone'))).toBe(
      `/demo/events/${E4.id}?state=outside-gone-page&from=${E2.id}`,
    );
    expect(openingOf(E3, E2.id, outsideOf('outside-gone'))).toBe(
      `/demo/events/${E3.id}?state=outside-in`,
    );
    expect(outsidePageOf('outside-in')).toBe('outside-in');
    expect(outsidePageOf('no-org')).toBeNull();
  });

  it('links every state from the demo’s home', () => {
    const linked = [...OUTSIDE_PAGE.states, ...OUTSIDE_MEMBER_PAGE.states].map((one) => one.to);

    expect(linked).toEqual(OUTSIDE_STATES.map((state) => `/demo/events/${E2.id}?state=${state}`));
    expect(SWITCHER_PAGES.flatMap((page) => page.states.map((one) => one.to))).toEqual(
      expect.arrayContaining([
        '/demo/today?switcher=outside',
        '/demo/today?switcher=outside-one-org',
      ]),
    );
  });
});
