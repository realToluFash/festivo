import type { StaffEntry } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  acts,
  asksAfterShare,
  helpLine,
  linkWord,
  offersMarkSent,
  offersReplace,
  rowLine,
  trailLine,
} from './staffRoster.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const entry = (over: Partial<StaffEntry> = {}): StaffEntry => ({
  id: 'st_1',
  fullName: 'Kunle Ajayi',
  mobile: '+2348031110009',
  email: null,
  job: { id: 'job_1', name: 'Waiter' },
  station: { id: 'sec_a', name: 'Section A', kind: 'section', tables: [] },
  stations: [],
  stationRemoved: null,
  leads: false,
  floorLead: false,
  shifts: [
    { id: 'sh_1', startsAt: '2030-11-14T17:00:00+01:00', endsAt: '2030-11-15T00:00:00+01:00' },
  ],
  link: 'none',
  linkBy: null,
  linkAt: null,
  briefing: 'none',
  briefingCopy: null,
  contactsErased: false,
  notice: null,
  inApp: false,
  ...over,
});

const SHARED = {
  link: 'shared' as const,
  linkBy: 'Kemi Adeyemi',
  linkAt: '2030-11-14T18:44:00+01:00',
};

describe('the Staff list’s rows (sc-77903)', () => {
  it('reads job, station and the first shift, with its other shifts as +n more', () => {
    expect(rowLine(t, entry(), 'en-GB')).toBe('Waiter · Section A · 17:00 to 00:00');
    expect(
      rowLine(
        t,
        entry({
          shifts: [
            {
              id: 'sh_2',
              startsAt: '2030-11-15T12:00:00+01:00',
              endsAt: '2030-11-15T16:00:00+01:00',
            },
            {
              id: 'sh_1',
              startsAt: '2030-11-14T17:00:00+01:00',
              endsAt: '2030-11-15T00:00:00+01:00',
            },
          ],
        }),
        'en-GB',
      ),
    ).toBe('Waiter · Section A · 17:00 to 00:00 +1 more');
  });

  it('says what is missing in its own words', () => {
    expect(rowLine(t, entry({ job: null, station: null, shifts: [] }), 'en-GB')).toBe(
      'No job yet · No station yet · Not on a shift yet',
    );
  });

  it('reads each status as the web does, Shared among them', () => {
    expect(
      (['none', 'copied', 'shared', 'sent', 'opened', 'no_mobile', 'erased'] as const).map((link) =>
        linkWord(t, link),
      ),
    ).toEqual([
      'No link yet',
      'Copied',
      'Shared',
      'Link sent',
      'Link opened',
      'Add a mobile number to send a link',
      'Contact details removed after the event',
    ]);
  });
});

describe('one person’s link screen (sc-77903)', () => {
  it('says who shared it and when, not yet marked as sent', () => {
    expect(trailLine(t, entry(SHARED), 'en-GB')).toBe(
      'Shared by Kemi Adeyemi · 18:44 · not marked as sent',
    );
    expect(
      trailLine(t, entry({ link: 'opened', linkAt: '2030-11-14T19:05:00+01:00' }), 'en-GB'),
    ).toBe('Opened 19:05');
    expect(trailLine(t, entry(), 'en-GB')).toBeNull();
  });

  it('asks whether it was sent after a share that reads Shared, and not on Link sent or Link opened', () => {
    expect(asksAfterShare(entry(SHARED))).toBe(true);
    expect(asksAfterShare(entry({ link: 'sent' }))).toBe(false);
    expect(asksAfterShare(entry({ link: 'opened' }))).toBe(false);
  });

  it('offers Mark as sent on Shared and Copied once nothing is being asked', () => {
    expect(offersMarkSent(entry(SHARED), true, false)).toBe(true);
    expect(offersMarkSent(entry({ link: 'copied' }), true, false)).toBe(true);
    expect(offersMarkSent(entry(SHARED), true, true)).toBe(false);
    expect(offersMarkSent(entry({ link: 'sent' }), true, false)).toBe(false);
  });

  it('offers no action without staff.manage, without a mobile number, or after the erasure', () => {
    expect(acts(entry(), true)).toBe(true);
    expect(acts(entry(), false)).toBe(false);
    expect(acts(entry({ mobile: null, link: 'no_mobile' }), true)).toBe(false);
    expect(acts(entry({ mobile: null, link: 'erased', contactsErased: true }), true)).toBe(false);
    expect(offersReplace(entry(SHARED), false)).toBe(false);
  });

  it('offers Replace link… once a link has been given', () => {
    expect(offersReplace(entry(), true)).toBe(false);
    expect(offersReplace(entry(SHARED), true)).toBe(true);
  });

  it('keeps the line saying why there is nothing to give', () => {
    expect(helpLine(t, 'no_mobile')).toBe(
      'Their mobile number is added on the web, in the roster.',
    );
    expect(helpLine(t, 'erased')).toBe(
      'There is nothing to share or copy: their number went 30 days after the event.',
    );
    expect(helpLine(t, 'shared')).toBe('It opens their own shift, from 12 hours before it starts.');
  });
});
