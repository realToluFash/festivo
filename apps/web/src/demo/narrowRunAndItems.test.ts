import { describe, expect, it } from 'vitest';

import { cssRule, mediaBlock, stylesheet } from '../test-styles.ts';

const RUN = mediaBlock('(width <= 40rem)', stylesheet(import.meta.dirname, 'runView.css'));
const MENU = mediaBlock('(width <= 40rem)', stylesheet(import.meta.dirname, 'menu.css'));

describe('the run of show and Menu’s Items at 400% zoom, 320 CSS px (sc-32279)', () => {
  it('makes each run of show item a block of its own, Mark beside its start', () => {
    expect(cssRule('.rv-table,\n  .rv-table tbody', RUN)).toContain('display: block;');
    expect(cssRule('.rv-row', RUN)).toMatch(
      /display: grid;\s+grid-template-areas:\s+'starts act'/u,
    );
    expect(cssRule('.rv-row .rv-act-col', RUN)).toContain('grid-area: act;');
  });

  it('keeps the run of show’s column names for a screen reader, out of sight', () => {
    expect(cssRule('.rv-table thead', RUN)).toContain('clip-path: inset(50%);');
  });

  it('gives an item’s field the row, its buttons under it', () => {
    expect(cssRule('.mn-item-row', MENU)).toContain('flex-wrap: wrap;');
    expect(cssRule('.mn-item-main', MENU)).toContain(
      'flex-basis: calc(100% - 20px - var(--spaceSm));',
    );
    expect(cssRule('.mn-choice-item-name', MENU)).toContain('overflow-wrap: normal;');
  });
});
