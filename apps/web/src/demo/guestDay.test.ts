import { describe, expect, it } from 'vitest';

import { ARRIVAL_NOTE } from './arrivalNote.ts';
import { startOf } from './guest.ts';
import {
  GUEST_DAY_PAGES,
  GUEST_DAY_STATES,
  dayAt,
  hasWhere,
  inDayOrder,
  isTheDay,
  leadsWithCode,
  mapsLink,
  placeOf,
} from './guestDay.ts';
import { wantsLock } from './useWakeLock.ts';

const LONDON = {
  startsAt: '2026-11-05T18:00:00Z',
  endsAt: '2026-11-07T15:00:00Z',
  timeZone: 'Europe/London',
};

describe('the event’s day (sc-24381)', () => {
  it('starts at 00:00 on the start date in the event’s timezone and ends at its end time', () => {
    expect(isTheDay(new Date('2026-11-04T23:59:59Z'), LONDON)).toBe(false);
    expect(isTheDay(new Date('2026-11-05T00:00:00Z'), LONDON)).toBe(true);
    expect(isTheDay(new Date('2026-11-07T14:59:59Z'), LONDON)).toBe(true);
    expect(isTheDay(new Date('2026-11-07T15:00:00Z'), LONDON)).toBe(false);
  });

  it('follows the event’s timezone, not the reader’s', () => {
    const auckland = {
      startsAt: '2026-11-05T05:00:00Z',
      endsAt: '2026-11-05T11:00:00Z',
      timeZone: 'Pacific/Auckland',
    };

    expect(isTheDay(new Date('2026-11-04T11:30:00Z'), auckland)).toBe(true);
    expect(isTheDay(new Date('2026-11-04T10:30:00Z'), auckland)).toBe(false);
  });

  it('names the day before, the day and after the end', () => {
    expect(dayAt(new Date('2026-11-04T09:00:00Z'), LONDON)).toBe('before');
    expect(dayAt(new Date('2026-11-05T09:00:00Z'), LONDON)).toBe('onTheDay');
    expect(dayAt(new Date('2026-11-07T16:00:00Z'), LONDON)).toBe('after');
  });
});

describe('Where, as the host filled it in', () => {
  it('keeps each of the name, the address and the note optional', () => {
    const live = { phase: 'live', note: 'none' } as const;

    expect(placeOf({ ...live, where: 'full' })).toEqual({
      name: 'The Landmark',
      address: '222 Marylebone Road, London NW1 6JQ',
      note: null,
    });
    expect(placeOf({ ...live, where: 'nameOnly' }).address).toBeNull();
    expect(placeOf({ ...live, where: 'addressOnly' }).name).toBeNull();
    expect(hasWhere(placeOf({ ...live, where: 'none' }))).toBe(false);
  });

  it('reads the note from the event’s arrival note, the same before and on the day', () => {
    const full = placeOf({ phase: 'live', note: 'host', where: 'full' });
    const alone = placeOf({ phase: 'live', note: 'alone', where: 'full' });

    expect(full.note).toBe(ARRIVAL_NOTE);
    expect(alone).toEqual({ name: null, address: null, note: ARRIVAL_NOTE });
    expect(hasWhere(alone)).toBe(true);
    expect(placeOf({ phase: 'over', note: 'host', where: 'full' }).note).toBeNull();
  });

  it('opens Google Maps’ search on the address alone', () => {
    expect(mapsLink('222 Marylebone Road, London NW1 6JQ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=222%20Marylebone%20Road%2C%20London%20NW1%206JQ',
    );
  });
});

describe('the day’s order', () => {
  it('leads with the code only for a Coming guest’s live page on the day', () => {
    const led = Object.keys(GUEST_DAY_STATES).filter((state) => startOf(state).dayOrder);

    expect(led).toEqual([
      'onTheDay',
      'onTheDayStarted',
      'onTheDayNameOnly',
      'onTheDayAddressOnly',
      'onTheDayNoteOnly',
      'onTheDayNoWhere',
      'onTheDayLoading',
      'onTheDayFrench',
    ]);
  });

  it('is set when the page loads: answering Coming on the day keeps the usual order', () => {
    const loaded = startOf('onTheDayNoAnswer');
    const answered = {
      ...loaded,
      recorded: { answer: 'coming', on: '2026-11-05' },
      view: { kind: 'recorded', same: false },
    } as const;

    expect(leadsWithCode(answered)).toBe(true);
    expect(inDayOrder(answered)).toBe(false);
  });

  it('gives way while the answer is being changed, and comes back on Keep my answer', () => {
    const loaded = startOf('onTheDay');

    expect(inDayOrder({ ...loaded, view: { kind: 'changing', busy: null } })).toBe(false);
    expect(inDayOrder(loaded)).toBe(true);
  });

  it('is linked once per state from the demo home', () => {
    expect(GUEST_DAY_PAGES.flatMap((page) => page.states).map((one) => one.to)).toEqual(
      Object.keys(GUEST_DAY_STATES).map((state) => `/demo/guest?state=${state}`),
    );
  });
});

describe('the screen kept on', () => {
  it('is wanted only while the code card is in view and the page is shown', () => {
    expect(wantsLock(true, true)).toBe(true);
    expect(wantsLock(false, true)).toBe(false);
    expect(wantsLock(true, false)).toBe(false);
  });
});
