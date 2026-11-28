import { describe, expect, it } from 'vitest';

import {
  READ_ONLY_PAGES,
  bannerOf,
  mailOf,
  pageOf,
  readOnlyOn,
  readOnlyStateOf,
  refuses,
  runsNormally,
  wayPastOf,
} from './readOnly.ts';

describe('a failed payment, read-only and paid (sc-3937)', () => {
  it('reads read-only fourteen days after the first failure', () => {
    expect(readOnlyOn('2026-11-26')).toBe('2026-12-10');
  });

  it('says the next try, or leaves its sentence out', () => {
    expect(bannerOf('pastDue', 'manage')?.words).toBe(
      'Your last payment failed. We will try again on Monday, Nov 30. After Thursday, Dec 10, Ìrè Events becomes read-only.',
    );
    expect(bannerOf('pastDueNoRetry', 'read')?.words).toBe(
      'Your last payment failed. After Thursday, Dec 10, Ìrè Events becomes read-only.',
    );
  });

  it('shows the banner to billing.read, the button to billing.manage, and nothing to anyone else', () => {
    expect(bannerOf('readOnly', 'manage')).toEqual({
      words: 'Read-only until the payment is made. Live events are running normally.',
      update: true,
    });
    expect(bannerOf('readOnly', 'read')?.update).toBe(false);
    expect(bannerOf('readOnly', 'none')).toBeNull();
    expect(bannerOf('active', 'manage')).toBeNull();
    expect(bannerOf('paid', 'manage')).toBeNull();
  });

  it('marks live events only, and only while read-only', () => {
    expect(runsNormally('readOnly', 'live')).toBe(true);
    expect(runsNormally('readOnly', 'happeningNow')).toBe(true);
    expect(runsNormally('readOnly', 'draft')).toBe(false);
    expect(runsNormally('pastDue', 'live')).toBe(false);
    expect(refuses('pastDue')).toBe(false);
    expect(refuses('readOnly')).toBe(true);
  });

  it('pays on the web for billing.manage, says so in the app, and asks otherwise', () => {
    expect(wayPastOf('manage', 'web')).toBe('pay');
    expect(wayPastOf('manage', 'app')).toBe('inApp');
    expect(wayPastOf('read', 'web')).toBe('ask');
    expect(wayPastOf('none', 'app')).toBe('ask');
  });

  it('mails billing.read only, with the button for billing.manage and none once paid', () => {
    expect(mailOf('readOnly', 'manage')?.update).toBe(true);
    expect(mailOf('pastDue', 'read')?.update).toBe(false);
    expect(mailOf('paid', 'manage')).toEqual({
      subject: 'Ìrè Events · Paid. Thank you.',
      lines: ['Paid. Thank you.'],
      update: false,
    });
    expect(mailOf('pastDue', 'none')).toBeNull();
  });

  it('lists only states that exist, and falls back to past due', () => {
    for (const page of READ_ONLY_PAGES)
      for (const state of page.states) {
        const name = new URLSearchParams(state.to.split('?')[1]).get('state');
        expect(readOnlyStateOf(name)).toBe(name);
      }
    expect(readOnlyStateOf('nonsense')).toBe('pastDue');
  });

  it('opens only pages that exist from ?page=', () => {
    expect(pageOf('makeLive')).toBe('makeLive');
    expect(pageOf('eventView')).toBe('eventView');
    expect(pageOf('settings')).toBeNull();
    expect(pageOf(null)).toBeNull();
  });
});
