import { describe, expect, it } from 'vitest';

import { appPlace } from './notificationPlace.ts';

describe("a bell item's place in the app (sc-3980)", () => {
  it("opens the app's screen for the web's path", () => {
    expect(appPlace('/app/events/e1')).toBe('/events/e1');
    expect(appPlace('/app/events')).toBe('/events');
    expect(appPlace('/app/account/notifications')).toBe('/settings/notifications');
  });

  it("opens a run-of-show card's track on the night (sc-66580)", () => {
    expect(appPlace('/app/events/e1/schedule?track=2026-11-20%7CGarden')).toBe(
      '/events/e1/night?track=2026-11-20%7CGarden',
    );
  });

  it('stays in the bell for a place the app has no screen for, or none', () => {
    expect(appPlace('/app/events/e1/guests')).toBeNull();
    expect(appPlace(null)).toBeNull();
  });
});
