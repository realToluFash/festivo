import { describe, expect, it } from 'vitest';

import { SHOWN_EVENT, upFromDates } from './eventDates.ts';

const home = { params: {} };
const showing = (eventId: string | undefined) => ({ params: { [SHOWN_EVENT]: eventId } });
const dates = (eventId: string) => ({ params: { id: eventId } });

describe('‹ Event on All dates (sc-18776)', () => {
  it('goes back to the event whose Coming up opened it', () => {
    expect(upFromDates([home, showing('ev-1'), dates('ev-1')], 2, 'ev-1')).toBe('back');
  });

  it('goes back when a link opened it over the same event', () => {
    const linkedEvent = { params: { id: 'ev-1', [SHOWN_EVENT]: 'ev-1' } };

    expect(upFromDates([home, linkedEvent, dates('ev-1')], 2, 'ev-1')).toBe('back');
  });

  it('opens the event when a link opened it over Home', () => {
    expect(upFromDates([home, dates('ev-1')], 1, 'ev-1')).toBe('open');
  });

  it('opens the event when a link opened it over a different event', () => {
    expect(upFromDates([home, showing('ev-2'), dates('ev-1')], 2, 'ev-1')).toBe('open');
  });

  it('opens the event when Events behind it shows only the list', () => {
    expect(upFromDates([home, showing(undefined), dates('ev-1')], 2, 'ev-1')).toBe('open');
  });

  it('opens the event when nothing is behind it', () => {
    expect(upFromDates([dates('ev-1')], 0, 'ev-1')).toBe('open');
  });

  it('opens the event when it is shown further back, not directly behind', () => {
    expect(upFromDates([showing('ev-1'), home, dates('ev-1')], 2, 'ev-1')).toBe('open');
  });
});
