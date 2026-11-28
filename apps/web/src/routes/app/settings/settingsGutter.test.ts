import { describe, expect, it } from 'vitest';

import { STYLES, cssRule, mediaBlock, stylesheet } from '../../../test-styles.ts';

const NARROW = '(width <= 40rem)';
const VENDORS = mediaBlock(NARROW, stylesheet(import.meta.dirname, 'vendors.css'));

describe('Vendors and Payment reminders at a phone (sc-91831)', () => {
  it('adds no side padding of its own to Settings’ 16 px, from 40rem down only', () => {
    expect(STYLES).toContain(
      `@media ${NARROW} {\n  .settings-desk-page .desk > .desk-page {\n    padding-inline: 0;\n  }\n}\n`,
    );
  });

  it('runs Vendors’ column to the gutter and opens its menus at the column’s width', () => {
    expect(cssRule('.vd-column', VENDORS)).toMatch(/^\s*margin-inline-end: 0;\s*$/u);
    expect(cssRule('.vd-tools', VENDORS)).toContain('position: relative;');
    expect(cssRule('.vd-tools > .desk-menu-at', VENDORS)).toContain('position: static;');
    expect(cssRule('.vd-tools .desk-menu', VENDORS)).toMatch(
      /right: 0;\s+left: 0;\s+width: auto;/u,
    );
  });
});
