import { describe, expect, it } from 'vitest';

import { appPlace, badgeOf, whenShown } from './notificationPlace.ts';

describe("a bell item's place in the app (sc-3980)", () => {
  it("opens the app's screen for the web's path", () => {
    expect(appPlace('/app/events/e1')).toBe('/events/e1');
    expect(appPlace('/app/events')).toBe('/events');
    expect(appPlace('/app/account/notifications')).toBe('/settings/notifications');
  });

  it('stays in the bell for a place the app has no screen for, or none', () => {
    expect(appPlace('/app/events/e1/guests')).toBeNull();
    expect(appPlace(null)).toBeNull();
  });
});

describe('the time on a bell item', () => {
  it('is the time today, on a 24-hour clock', () => {
    expect(whenShown('2026-10-29T14:05:00', new Date('2026-10-29T18:00:00'), 'en')).toEqual({
      today: true,
      time: '14:05',
    });
  });

  it("is the locale's date before today", () => {
    expect(whenShown('2026-10-20T09:00:00', new Date('2026-10-29T18:00:00'), 'en')).toEqual({
      today: false,
      date: 'Tuesday, Oct 20',
    });
  });
});

describe('the badge', () => {
  it('counts 1 to 99, then 99+, and shows nothing at 0', () => {
    expect(badgeOf(0, '99+')).toBeNull();
    expect(badgeOf(1, '99+')).toBe('1');
    expect(badgeOf(99, '99+')).toBe('99');
    expect(badgeOf(100, '99+')).toBe('99+');
  });
});
