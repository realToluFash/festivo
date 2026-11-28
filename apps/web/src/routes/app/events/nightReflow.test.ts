import { describe, expect, it } from 'vitest';

import { cssRule, mediaBlock, stylesheet } from '../../../test-styles.ts';

const SHEET = stylesheet(import.meta.dirname, 'night.css');
const AT_320 = mediaBlock('(width <= 40rem)', SHEET);

describe('the live night at 400% zoom, 320 CSS px (sc-100788)', () => {
  it('changes nothing from 641 px up: every narrow rule sits in the one block', () => {
    expect(AT_320).not.toBe('');
    expect(SHEET.match(/@media/gu)).toHaveLength(1);
  });

  it('puts the trail on its own line, the switch and the bell under it', () => {
    expect(cssRule('.nt .ev-crumb-row', AT_320)).toContain('flex-wrap: wrap;');
    expect(cssRule('.nt .ev-crumb', AT_320)).toContain('flex: 1 0 100%;');
    expect(cssRule('.nt .nt-switch', AT_320)).toContain('margin-inline-start: 0;');
  });

  it('stands the title whole above the track, and the clock and the chip under them', () => {
    expect(cssRule('.nt .nt-top', AT_320)).toMatch(
      /flex-direction: column;\s+align-items: stretch;/u,
    );
    expect(cssRule('.nt .nt-top .gs-title', AT_320)).toContain('flex: none;');
    expect(cssRule('.nt .nt-head-end', AT_320)).toContain('flex-wrap: wrap;');
  });

  it('stacks Now and Next above Later in one column, a chosen item’s panel under them at the page’s width', () => {
    expect(cssRule('.nt .nt-grid', AT_320)).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(cssRule('.nt .nt-split', AT_320)).toContain('flex-direction: column;');
    expect(cssRule('.nt .nt-panel', AT_320)).toContain('width: auto;');
    expect(cssRule('.nt .nt-pair', AT_320)).toContain('flex-wrap: wrap;');
  });

  it('drops Try now and Dismiss under their words, the words a real basis so they wrap first', () => {
    expect(cssRule('.nt .nt-alert', AT_320)).toContain('flex-wrap: wrap;');
    expect(cssRule('.nt .nt-alert-words,\n  .nt .nt-strip-words', AT_320)).toContain(
      'flex: 1 1 12rem;',
    );
  });

  it('runs the Tracks menu the page’s width, each row a 44 px target', () => {
    expect(cssRule('.nt .nt-menu', AT_320)).toMatch(/align-self: stretch;\s+min-width: 0;/u);
    expect(cssRule('.nt .nt-menu-row', AT_320)).toContain('min-height: var(--sizeHit);');
    expect(cssRule('.nt .nt-picker', AT_320)).toContain('min-height: var(--sizeHit);');
  });
});
