import { createInstance } from 'i18next';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import en from './i18n/locales/en.json';
import { freshLine } from './kit/menuPicksWords.ts';

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
const t = i18n.t.bind(i18n);

/** 06:01 in London, the event's zone, as the API sends it. */
export const LONDON_UPDATED = '2030-11-10T06:01:00+00:00';

/** One device zone a file: a formatter keeps the zone it was made in, and the domain keeps one a locale. */
export function freshLineOnDevice(zone: string, clock: string): void {
  describe(`the picks' freshness on a device in ${zone}, for a London event (sc-89448)`, () => {
    const was = process.env.TZ;

    beforeAll(() => {
      process.env.TZ = zone;
    });

    afterAll(() => {
      if (was == null) delete process.env.TZ;
      else process.env.TZ = was;
    });

    it('reads the live line in the device’s time', () => {
      expect(freshLine(t, LONDON_UPDATED, false, 'en-GB')).toBe(
        `Updated at ${clock} · counts change while this is open. Pull down to refresh.`,
      );
    });

    it('reads the stale line in the device’s time', () => {
      expect(freshLine(t, LONDON_UPDATED, true, 'en-GB')).toBe(
        `Not updated since ${clock}. Counts may be behind. Trying again.`,
      );
    });
  });
}
