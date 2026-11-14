import { describe, expect, it } from 'vitest';

import { EVENT_AREA, FROM_HAPPENING_NOW } from './eventNav.ts';
import { SHOWN_EVENT, areaParams, upToEvent } from './upToEvent.ts';

const home = { params: {} };
const showing = (eventId: string | undefined) => ({ params: { [SHOWN_EVENT]: eventId } });
const dates = (eventId: string) => ({ params: { id: eventId } });

describe('‹ Event on All dates (sc-18776)', () => {
  it('goes back to the event whose Coming up opened it', () => {
    expect(upToEvent([home, showing('ev-1'), dates('ev-1')], 2, 'ev-1')).toBe('back');
  });

  it('goes back when a link opened it over the same event', () => {
    const linkedEvent = { params: { id: 'ev-1', [SHOWN_EVENT]: 'ev-1' } };

    expect(upToEvent([home, linkedEvent, dates('ev-1')], 2, 'ev-1')).toBe('back');
  });

  it('opens the event when a link opened it over Home', () => {
    expect(upToEvent([home, dates('ev-1')], 1, 'ev-1')).toBe('open');
  });

  it('opens the event when a link opened it over a different event', () => {
    expect(upToEvent([home, showing('ev-2'), dates('ev-1')], 2, 'ev-1')).toBe('open');
  });

  it('opens the event when Events behind it shows only the list', () => {
    expect(upToEvent([home, showing(undefined), dates('ev-1')], 2, 'ev-1')).toBe('open');
  });

  it('opens the event when nothing is behind it', () => {
    expect(upToEvent([dates('ev-1')], 0, 'ev-1')).toBe('open');
  });

  it('opens the event when it is shown further back, not directly behind', () => {
    expect(upToEvent([showing('ev-1'), home, dates('ev-1')], 2, 'ev-1')).toBe('open');
  });
});

describe('a save on Edit details (sc-21336)', () => {
  const form = (eventId: string) => ({ params: { id: eventId } });

  it('opens the event when a link opened the form over Home', () => {
    expect(upToEvent([home, form('ev-1')], 1, 'ev-1')).toBe('open');
  });

  it('goes back when the form is over Events showing the same event', () => {
    expect(upToEvent([home, showing('ev-1'), form('ev-1')], 2, 'ev-1')).toBe('back');
  });
});

describe('a menu area from All dates or Edit details (sc-22103)', () => {
  const page = (params: Record<string, string>) => ({ params: { id: 'ev-1', ...params } });
  const over = { params: { id: 'ev-1' } };

  it('keeps the page shown, so a later way up goes back to it', () => {
    expect(areaParams([home, page({ [SHOWN_EVENT]: 'ev-1' }), over], 2, 'ev-1', 'guests')).toEqual({
      id: 'ev-1',
      [SHOWN_EVENT]: 'ev-1',
      [EVENT_AREA]: 'guests',
    });
  });

  it('keeps Happening now, so Back keeps the tab that was showing', () => {
    expect(
      areaParams(
        [home, page({ [SHOWN_EVENT]: 'ev-1', [FROM_HAPPENING_NOW]: '1' }), over],
        2,
        'ev-1',
        'guests',
      ),
    ).toMatchObject({ [FROM_HAPPENING_NOW]: '1', [EVENT_AREA]: 'guests' });
  });

  it('replaces the area the page had', () => {
    expect(
      areaParams(
        [page({ [SHOWN_EVENT]: 'ev-1', [EVENT_AREA]: 'guests' }), over],
        1,
        'ev-1',
        'overview',
      ),
    ).toMatchObject({ [EVENT_AREA]: 'overview' });
  });

  it('skips a different event and Events showing this one', () => {
    expect(
      areaParams(
        [showing('ev-1'), page({ id: 'ev-2', [SHOWN_EVENT]: 'ev-2' }), over],
        2,
        'ev-1',
        'guests',
      ),
    ).toEqual({ id: 'ev-1', [EVENT_AREA]: 'guests' });
  });

  it('names only the event and the area when its page is not behind', () => {
    expect(areaParams([home, over], 1, 'ev-1', 'guests')).toEqual({
      id: 'ev-1',
      [EVENT_AREA]: 'guests',
    });
  });
});
