import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../test-styles.ts';

const WIDE = stylesheet(import.meta.dirname, 'wideDesk.css');

describe("the demo's desk window from 641 px up (sc-61150)", () => {
  const guests = WIDE.slice(WIDE.indexOf('(width <= 77.5rem)'));

  it("keeps the Guests head's title whole, as the product does", () => {
    expect(cssRule('.today.desk .gs-top > .mn-head', WIDE)).toContain('min-width: auto;');
  });

  it('keeps the Guests list at 520 and the guest at 380 up to 1240 px, 320 included (sc-32279)', () => {
    expect(cssRule('.today.desk .gs-list', guests)).toContain('max-width: var(--gsList);');
    expect(cssRule('.today.desk .gs-column', guests)).toMatch(
      /order: -1;\s+max-width: var\(--gsGuest\);/u,
    );
  });
});

describe("the demo's Roster from 961 to 1279 px (sc-73291)", () => {
  const roster = WIDE.slice(WIDE.indexOf('(60rem < width < 80rem)'));

  it('puts an open person or form before the Roster, at the card’s width, until 1280', () => {
    expect(WIDE).toContain('@media (60rem < width < 80rem)');
    expect(cssRule('.today.desk .rs .mn-split:has(> .mn-panel)', roster)).toContain(
      'flex-direction: column;',
    );
    expect(cssRule('.today.desk .rs .mn-split > .mn-panel', roster)).toMatch(
      /position: static;\s+order: -1;\s+width: auto;/u,
    );
  });
});
