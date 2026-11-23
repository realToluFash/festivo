import { describe, expect, it } from 'vitest';

import { bellHref, bellOpens } from './opener.ts';

describe('the bell over an event’s page on an iPad (sc-84453)', () => {
  it('opens a notification about changed guests at Guests, and the rest at Overview', () => {
    expect(bellOpens('replies')).toBe('guests');
    for (const key of ['day', 'missed', 'change', 'money']) expect(bellOpens(key)).toBe('overview');
  });

  it('pushes the other event over this page, so ‹ Event goes back to it', () => {
    expect(bellHref('change')).toBe('/demo/events/evt-wed-4?from=eventBell&pushed=1');
    expect(bellHref('replies')).toBe(
      '/demo/events/evt-wed-4?area=guests&filter=changed&from=eventBell&pushed=1',
    );
  });
});
