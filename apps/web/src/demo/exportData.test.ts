import { describe, expect, it } from 'vitest';

import { DATA_CONTROL_PAGES } from './dataControlPages.ts';
import { EXPORT_STATES, afterStep, exportCard, exportFor, limitedLine } from './exportData.ts';

const LOCALE = 'en-US';
const LAGOS = 'Africa/Lagos';

describe('Export all data (sc-612)', () => {
  it('says each state of the one export on its card, with its one step', () => {
    expect(exportCard('ex_idle', LOCALE, LAGOS)).toEqual({
      says: 'Take everything Ire Events holds',
      lines: ['One archive, on every plan. Only an owner exports it.'],
      step: 'export',
    });
    expect(exportCard('ex_preparing', LOCALE, LAGOS)).toEqual({
      says: 'Preparing your export',
      lines: [
        'Asked by you, Monday, Oct 19 at 09:30 WAT. We’ll email folake@ire.events when it’s ready, and it shows here.',
      ],
      step: null,
    });
    expect(exportCard('ex_ready', LOCALE, LAGOS)).toEqual({
      says: 'Your export is ready',
      lines: [
        'We emailed a link to folake@ire.events. It downloads once, until Tuesday, Oct 20 at 09:52 WAT, and only for you, signed in.',
        'The next export can start on Tuesday, Oct 20 at 09:30 WAT.',
      ],
      step: 'download',
    });
    expect(exportCard('ex_ready_other', LOCALE, 'Europe/London').lines).toEqual([
      'Asked by Folake Adeyemi, Monday, Oct 19 at 09:30 BST. Only they can download it, until Tuesday, Oct 20 at 09:52 BST.',
    ]);
    expect(exportCard('ex_ready_other', LOCALE, LAGOS).lines).toEqual([
      'Asked by Folake Adeyemi, Monday, Oct 19 at 09:30 WAT. Only they can download it, until Tuesday, Oct 20 at 09:52 WAT.',
    ]);
    expect(exportCard('ex_used', LOCALE, LAGOS)).toEqual({
      says: 'Your export was downloaded',
      lines: [
        'Downloaded Monday, Oct 19 at 10:05 WAT. Its link is used up.',
        'The next export can start on Tuesday, Oct 20 at 09:30 WAT.',
      ],
      step: null,
    });
    expect(exportCard('ex_expired', LOCALE, LAGOS)).toEqual({
      says: 'Your export’s link has ended',
      lines: ['It ended on Tuesday, Oct 20 at 09:52 WAT without a download. You can export again.'],
      step: 'export',
    });
    expect(exportCard('ex_failed', LOCALE, LAGOS)).toMatchObject({
      says: 'Your export did not finish',
      step: 'retry',
    });
    expect(exportCard('not_owner', LOCALE, LAGOS)).toEqual({
      says: 'Only an owner exports Ire Events’ data',
      lines: ['An owner can take everything Ire Events holds in one archive.'],
      step: null,
    });
  });

  it('refuses a second export on a stale page with the next one’s instant', () => {
    expect(limitedLine(LOCALE, LAGOS)).toBe(
      'The next export can start on Tuesday, Oct 20 at 09:30 WAT. Nothing was started.',
    );
  });

  it('prepares, then is used up by its one download', () => {
    expect(afterStep('export')).toBe('ex_preparing');
    expect(afterStep('retry')).toBe('ex_preparing');
    expect(afterStep('download')).toBe('ex_used');
  });

  it('shows somebody who is not the owner the asker’s export, and never the owner’s step', () => {
    expect(exportFor('ex_ready', false)).toBe('ex_ready_other');
    expect(exportFor('ex_idle', false)).toBe('not_owner');
    expect(exportFor('ex_used', false)).toBe('not_owner');
    expect(exportFor('not_owner', true)).toBe('ex_idle');
    expect(exportFor('ex_limited', true)).toBe('ex_limited');
  });

  it('links every state from the demo’s home', () => {
    const linked = DATA_CONTROL_PAGES.flatMap((one) => one.states.map((state) => state.to)).filter(
      (to) => to.includes('/export?') || to.endsWith('/export'),
    );

    for (const state of EXPORT_STATES)
      expect(linked.some((to) => to.endsWith(`state=${state}`))).toBe(true);
  });
});
