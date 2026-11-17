import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../../test-styles.ts';

const NARROW = stylesheet(import.meta.dirname, 'narrowDesk.css');
const WIDE = stylesheet(import.meta.dirname, 'wideDesk.css');
const LIBRARY = stylesheet(`${import.meta.dirname}/menu`, 'menuLibrary.css');
const SCHEDULE = stylesheet(`${import.meta.dirname}/events`, 'schedule.css');
const SEATING = stylesheet(`${import.meta.dirname}/events`, 'seating.css');
const MENU = stylesheet(`${import.meta.dirname}/events`, 'menu.css');

describe('a desk window from 641 to 960 px (sc-60699)', () => {
  it('fits the pages beside the sidebar there and nowhere else', () => {
    expect(NARROW.match(/@media [^{]*\{/gu)).toEqual(['@media (40rem < width <= 60rem) {']);
    expect(cssRule('.shell-content.is-card', NARROW)).toContain('padding-inline: var(--spaceXxl);');
  });

  it('puts an open form or detail before its list there', () => {
    expect(cssRule('.shell .mn-split:not(.ro .mn-split) > .mn-panel', NARROW)).toMatch(
      /position: static;\s+order: -1;/u,
    );
  });

  it("scrolls Seating's room and its Selection panel together below 960 px", () => {
    expect(
      cssRule('.st-main:not(.is-none)', SEATING.slice(SEATING.indexOf('(width < 960px)'))),
    ).toContain('overflow-y: auto;');
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

  it("puts a Menu course's and dish's actions under a name short of 12rem", () => {
    expect(cssRule('.mc-course-top', MENU)).toContain('flex-wrap: wrap;');
    expect(cssRule('.mc-course-top > .mn-course-names,\n.mc-dish .mn-dish-words', MENU)).toContain(
      'flex-basis: 12rem;',
    );
    expect(cssRule('.mc-acts,\n.mc-dish .lib-acts', MENU)).toContain('margin-left: auto;');
  });

  it("folds the Schedule's table to Starts and Item from 720 px", () => {
    expect(
      cssRule('.ro-table .ro-wide', SCHEDULE.slice(SCHEDULE.indexOf('(width <= 720px)'))),
    ).toContain('display: none;');
  });
});

describe('a desk window from 641 px up (sc-61150)', () => {
  const band = (media: string) => WIDE.slice(WIDE.indexOf(media));

  it('keeps each arrangement in one rule, from 641 px', () => {
    expect(WIDE.match(/@media [^{]*\{/gu)).toEqual([
      '@media (width > 40rem) {',
      '@media (40rem < width <= 75rem) {',
      '@media (40rem < width <= 70rem) {',
      '@media (40rem < width <= 77.5rem) {',
    ]);
  });

  it('keeps a title whole, its actions going under it when both do not fit', () => {
    expect(cssRule('.shell :is(.desk-top, .gs-top)', WIDE)).toContain('flex-wrap: wrap;');
    expect(cssRule('.shell :is(.desk-title, .gs-title)', WIDE)).toContain('min-width: auto;');
    expect(cssRule('.shell .gs-top > .mn-head', WIDE)).toContain('min-width: auto;');
  });

  it("puts the Schedule's open item before the table up to 1200 px", () => {
    expect(cssRule('.shell .ro .mn-split > .mn-panel', band('(40rem < width <= 75rem)'))).toMatch(
      /position: static;\s+order: -1;\s+width: auto;/u,
    );
  });

  it("puts Menu library's open form before the list up to 1120 px", () => {
    expect(
      cssRule('.shell .lib-split.is-docked .lib-panel', band('(40rem < width <= 70rem)')),
    ).toMatch(/position: static;\s+order: -1;/u);
  });

  it("puts an open guest before the list, both at the card's width, up to 1240 px", () => {
    const guests = band('(40rem < width <= 77.5rem)');

    expect(cssRule('.shell .gs-cols', guests)).toContain('flex-flow: column nowrap;');
    expect(cssRule('.shell :is(.gs-list, .gs-column)', guests)).toContain('max-width: none;');
    expect(cssRule('.shell .gs-column', guests)).toContain('order: -1;');
    expect(cssRule('.shell .gs-column:has(> .gs-pick)', guests)).toContain('display: none;');
  });
});
