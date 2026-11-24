import { describe, expect, it } from 'vitest';

import { SAMPLE_GUESTS } from '../events/GuestCounts.ts';
import { overviewCountsOf } from './GuestsModel.ts';

describe("Overview's Guests block counts the event it is on (sc-30303)", () => {
  it('counts the wedding on the wedding', () => {
    expect(overviewCountsOf('evt-wed-4', 'live')).toMatchObject({ invited: 142, coming: 96 });
  });

  it('counts the paused party on its own sample, as Events does', () => {
    const party = SAMPLE_GUESTS['evt-party-2'];
    expect(overviewCountsOf('evt-party-2', 'paused')).toMatchObject({
      invited: party?.invited,
      coming: party?.coming,
    });
  });

  it('has nobody invited on a draft, whichever event it is', () => {
    expect(overviewCountsOf('evt-draft-4', 'draft')).toMatchObject({ invited: 0, notyet: 12 });
    expect(overviewCountsOf('evt-wed-4', 'draft')).toMatchObject({ invited: 0, notyet: 0 });
  });

  it('draws no block for an event the demo has no guest list for', () => {
    expect(overviewCountsOf('evt-ireti-2', 'live')).toBeNull();
    expect(overviewCountsOf('evt-offsite-1', 'finished')).toBeNull();
  });
});
