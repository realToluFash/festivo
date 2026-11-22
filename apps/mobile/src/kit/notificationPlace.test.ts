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

  it('opens Guest replies on the guest list under Changed since you looked, from the look before (sc-4331)', () => {
    expect(
      appPlace('/app/events/e1/guests?filter=changed&since=2026-11-02T09%3A01%3A00%2B00%3A00'),
    ).toBe('/events/e1?area=guests&filter=changed&since=2026-11-02T09%3A01%3A00%2B00%3A00');
    expect(appPlace('/app/events/e1/guests?filter=changed&since=all')).toBe(
      '/events/e1?area=guests&filter=changed&since=all',
    );
  });

  it('stays in the bell for a place the app has no screen for, or none', () => {
    expect(appPlace('/app/events/e1/guests')).toBeNull();
    expect(appPlace(null)).toBeNull();
  });
});
