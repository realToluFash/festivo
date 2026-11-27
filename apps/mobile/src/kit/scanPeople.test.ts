import type { CheckIn, CheckInGuest } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { scanned } from './doorScan.ts';
import { peopleOf, saidOf } from './scanPeople.ts';

const i18n = createInstance();
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const ADAEZE: CheckInGuest = {
  id: 'adaeze',
  fullName: 'Adaeze Okafor',
  reply: 'coming',
  repliedAt: '2030-11-01T10:00:00+01:00',
  code: 'a'.repeat(64),
  walkIn: false,
  arrival: null,
  seat: { kind: 'table', name: 'Table 4', section: 'Main hall' },
  companions: [{ id: 'obi', fullName: 'Obi', state: 'coming', arrival: null, seat: null }],
};

const SEATED: CheckIn = {
  state: 'open',
  opensAt: '2030-11-14T14:00:00+01:00',
  timeZone: 'Africa/Lagos',
  seated: true,
  count: { attended: 0, expected: 2 },
  guests: [ADAEZE],
};

function said(checkIn: CheckIn): string {
  const read = scanned(checkIn, ADAEZE.code ?? '');
  if (read.kind !== 'guest') throw new Error('the code should find Adaeze');

  return saidOf(peopleOf(i18n.t, read, checkIn, false, 'en'), false, 'Nothing new.');
}

describe("what the door's scan reads out (sc-60684)", () => {
  it("says each person's seat after their name, and No seat yet for a companion without one", () => {
    expect(said(SEATED)).toBe(
      'Adaeze Okafor, Table 4 · Main hall, Coming. Obi, No seat yet, Companion · Coming',
    );
  });

  it('says no seat at all on an event nobody is seated on', () => {
    expect(said({ ...SEATED, seated: false })).toBe(
      'Adaeze Okafor, Coming. Obi, Companion · Coming',
    );
  });
});
