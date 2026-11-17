import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../../test-styles.ts';

const NARROW = stylesheet(import.meta.dirname, 'narrowDesk.css');
const LIBRARY = stylesheet(`${import.meta.dirname}/menu`, 'menuLibrary.css');
const SCHEDULE = stylesheet(`${import.meta.dirname}/events`, 'schedule.css');

describe('a desk window from 641 to 960 px (sc-60699)', () => {
  it('fits the pages beside the sidebar there and nowhere else', () => {
    expect(NARROW.match(/@media [^{]*\{/gu)).toEqual(['@media (40rem < width <= 60rem) {']);
    expect(cssRule('.shell-content.is-card', NARROW)).toContain('padding-inline: var(--spaceXxl);');
    expect(cssRule('.shell .gs-column:has(> .gs-pick)', NARROW)).toContain('display: none;');
  });

  it('stacks the Menu library only at a phone', () => {
    expect(LIBRARY).not.toContain('720px');
    expect(
      cssRule(
        '.lib-split.is-docked .lib-panel',
        LIBRARY.slice(LIBRARY.indexOf('(width <= 40rem)')),
      ),
    ).toContain('order: -1;');
  });

  it("folds the Schedule's table to Starts and Item from 720 px", () => {
    expect(
      cssRule('.ro-table .ro-wide', SCHEDULE.slice(SCHEDULE.indexOf('(width <= 720px)'))),
    ).toContain('display: none;');
  });
});
