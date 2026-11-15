import { describe, expect, it } from 'vitest';

import { startOf } from './guest.ts';
import {
  GUEST_PROGRAMME_PAGES,
  GUEST_PROGRAMME_STATES,
  LIVE_MARKS,
  byDay,
  dateTimeOf,
  guestProgramme,
  headingOf,
  isHappening,
  roundedToFive,
  scheduleOf,
  showsPlaces,
  showsProgramme,
  timeText,
  wallIn,
} from './guestProgramme.ts';

const live = (at: string) => ({ at, marks: LIVE_MARKS });
const titles = (set: Parameters<typeof scheduleOf>[0]) =>
  guestProgramme(scheduleOf(set), null).map((one) => one.title);

describe('what the guest API returns (sc-3899)', () => {
  it('holds only the items shown to guests, in order', () => {
    expect(titles('days')).toEqual([
      'Welcome drinks',
      'Ceremony',
      'Drinks reception',
      'Grand entrance',
      'Dinner',
      'First dance',
    ]);
    expect(titles('none')).toEqual([]);
  });

  it('carries id, title, time, day and place, and nothing else', () => {
    for (const one of guestProgramme(scheduleOf('days'), live('2026-11-06T17:25'))) {
      expect(Object.keys(one).sort()).toEqual(['day', 'id', 'place', 'startsAt', 'title']);
    }
  });

  it('keeps planned times before the event and after it', () => {
    const dinner = guestProgramme(scheduleOf('days'), null).find((one) => one.title === 'Dinner');

    expect(dinner?.startsAt).toBe('2026-11-06T17:30');
  });
});

describe('expected times while Happening now', () => {
  const at = (clock: string) =>
    Object.fromEntries(
      guestProgramme(scheduleOf('days'), live(clock)).map((one) => [one.title, one.startsAt]),
    );

  it('moves what is still to come by sc-1404’s rules, rounded down to 5 minutes', () => {
    expect(at('2026-11-06T17:25')).toEqual({
      'Welcome drinks': '2026-11-05T18:00',
      Ceremony: '2026-11-06T14:05',
      'Drinks reception': '2026-11-06T15:05',
      'Grand entrance': '2026-11-06T17:20',
      Dinner: '2026-11-06T17:35',
      'First dance': '2026-11-06T20:00',
    });
  });

  it('catches up as the running item overruns, and leaves a fixed time where it is', () => {
    expect(at('2026-11-06T17:45').Dinner).toBe('2026-11-06T17:45');
    expect(at('2026-11-06T17:45')['First dance']).toBe('2026-11-06T20:00');
  });

  it('counts the items hidden from guests: lateness on a track moves what follows', () => {
    const shown = scheduleOf('days').map((one) =>
      one.id === 'dinner'
        ? { ...one, lasts: 120 }
        : one.id === 'dance'
          ? { ...one, fixed: false }
          : one,
    );
    const programme = guestProgramme(shown, live('2026-11-06T17:25'));

    expect(programme.find((one) => one.title === 'First dance')?.startsAt).toBe('2026-11-06T20:05');
  });

  it('rounds down to 5 minutes, never later than the start', () => {
    expect(roundedToFive('2026-11-06T17:22')).toBe('2026-11-06T17:20');
    expect(roundedToFive('2026-11-06T17:24')).toBe('2026-11-06T17:20');
    expect(roundedToFive('2026-11-06T17:25')).toBe('2026-11-06T17:25');
    expect(roundedToFive('2026-11-07T00:03')).toBe('2026-11-07T00:00');
  });

  it('is only while the event has started and is not over', () => {
    expect(isHappening(startOf('programmeHappening'))).toBe(true);
    expect(isHappening(startOf('programmeOnTheDay'))).toBe(false);
    expect(isHappening(startOf('programmeOver'))).toBe(false);
  });

  it('reads the event’s clock in its zone', () => {
    expect(wallIn('2026-11-06T17:25:00Z', 'Europe/London')).toBe('2026-11-06T17:25');
  });
});

describe('what the section shows', () => {
  it('reads The day for one event day, a start at 00:30 included, and Programme for more', () => {
    const one = guestProgramme(scheduleOf('oneDay'), null);

    expect(byDay(one).map((day) => day.day)).toEqual(['2026-11-06']);
    expect(headingOf(one, 'en')).toBe('The day');
    expect(headingOf(guestProgramme(scheduleOf('days'), null), 'en')).toBe('Programme');
  });

  it('names places only when the items shown have more than one', () => {
    expect(showsPlaces(guestProgramme(scheduleOf('days'), null))).toBe(true);
    expect(showsPlaces(guestProgramme(scheduleOf('onePlace'), null))).toBe(false);
  });

  it('gives a start past midnight its weekday, as the Schedule page does', () => {
    const late = guestProgramme(scheduleOf('oneDay'), null).at(-1);

    expect(late?.title).toBe('Late food');
    expect(late == null ? '' : timeText(late, 'en-US')).toBe('Sat 00:30');
    expect(late == null ? '' : timeText(late, 'fr-FR')).toBe('sam. 00:30');
  });

  it('is shown whatever the answer, and not once the event is called off', () => {
    expect(showsProgramme(startOf('programmeNotComing'))).toBe(true);
    expect(showsProgramme(startOf('programmeNotSure'))).toBe(true);
    expect(showsProgramme(startOf('programmeNone'))).toBe(false);
    expect(showsProgramme(startOf('programmeCalledOff'))).toBe(false);
  });

  it('is linked once per state from the demo home', () => {
    expect(GUEST_PROGRAMME_PAGES.flatMap((page) => page.states).map((one) => one.to)).toEqual(
      Object.keys(GUEST_PROGRAMME_STATES).map((state) => `/demo/guest?state=${state}`),
    );
  });
});

describe('the time element’s dateTime', () => {
  it('gives the wall time the event zone’s offset, summer and winter', () => {
    expect(dateTimeOf('2026-11-06T17:20', 'Europe/London')).toBe('2026-11-06T17:20+00:00');
    expect(dateTimeOf('2026-07-06T17:20', 'Europe/London')).toBe('2026-07-06T17:20+01:00');
    expect(dateTimeOf('2026-11-06T17:20', 'America/Sao_Paulo')).toBe('2026-11-06T17:20-03:00');
    expect(dateTimeOf('2026-11-06T17:20', 'Asia/Kolkata')).toBe('2026-11-06T17:20+05:30');
  });

  it('takes the offset that applies after the clocks change', () => {
    expect(dateTimeOf('2026-10-25T03:00', 'Europe/London')).toBe('2026-10-25T03:00+00:00');
    expect(dateTimeOf('2026-03-29T03:00', 'Europe/London')).toBe('2026-03-29T03:00+01:00');
  });
});
