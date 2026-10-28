import { describe, expect, it } from 'vitest';

import { eventDatesHref, upFromDates } from './eventDates.ts';

const stack = (...keys: string[]) => keys.map((key) => ({ key }));

describe('‹ Event on All dates (sc-18776)', () => {
  it('goes back to the event whose Coming up opened it', () => {
    expect(upFromDates(stack('home', 'events-1', 'dates-1'), 2, 'events-1')).toBe('back');
  });

  it('opens the event when a link opened it over Home', () => {
    expect(upFromDates(stack('home', 'dates-1'), 1, undefined)).toBe('open');
  });

  it('opens the event when a link opened it over a different event', () => {
    expect(upFromDates(stack('home', 'events-2', 'dates-1'), 2, undefined)).toBe('open');
  });

  it('opens the event when nothing is behind it', () => {
    expect(upFromDates(stack('dates-1'), 0, undefined)).toBe('open');
  });

  it('opens the event when its opener is no longer directly behind', () => {
    expect(upFromDates(stack('events-1', 'home', 'dates-1'), 2, 'events-1')).toBe('open');
  });

  it('carries the opener in the link', () => {
    expect(eventDatesHref('ev 1', 'events-1')).toBe('/events/ev%201/dates?from=events-1');
  });
});
