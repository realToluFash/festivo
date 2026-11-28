import { describe, expect, it } from 'vitest';

import { cssRule, mediaBlock, stylesheet } from '../../../test-styles.ts';

const SHEET = stylesheet(import.meta.dirname, 'kitchenSheet.css');
const AT_320 = mediaBlock('(width <= 640px)', SHEET);

describe('the kitchen sheet’s widths (sc-30812)', () => {
  it('leaves scrolling to the shell’s card, so the row that opens adds no sideways scroll at 1280', () => {
    expect(cssRule('.shell-content .desk-page')).toContain('overflow: visible;');
  });

  it('stands Final numbers under the sheet at 400% zoom, 320 CSS px', () => {
    expect(cssRule('.ks .ev-columns', AT_320)).toContain('grid-template-columns: minmax(0, 1fr);');
  });
});
