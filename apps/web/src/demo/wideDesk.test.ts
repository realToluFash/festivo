import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../test-styles.ts';

const WIDE = stylesheet(import.meta.dirname, 'wideDesk.css');

describe("the demo's desk window from 641 px up (sc-61150)", () => {
  const guests = WIDE.slice(WIDE.indexOf('(40rem < width <= 77.5rem)'));

  it("keeps the Guests head's title whole, as the product does", () => {
    expect(cssRule('.today.desk .gs-top > .mn-head', WIDE)).toContain('min-width: auto;');
  });

  it('keeps the Guests list at 520 and the guest at 380 up to 1240 px', () => {
    expect(cssRule('.today.desk .gs-list', guests)).toContain('max-width: var(--gsList);');
    expect(cssRule('.today.desk .gs-column', guests)).toMatch(
      /order: -1;\s+max-width: var\(--gsGuest\);/u,
    );
  });
});
