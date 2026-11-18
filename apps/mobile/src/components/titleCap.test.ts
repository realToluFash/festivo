import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { capUnderTitle, titleSize } from '../layout/textSize.ts';
import { PAGE_TITLE } from './topTitle.ts';

const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const rows = readFileSync(join('src', 'components', 'SummaryRows.tsx'), 'utf8');
const event = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');

const HEAD = 18;
const AX5 = 3.12;

function heading(cap: number | null, fontScale: number): number {
  return HEAD * capUnderTitle(cap ?? Infinity, HEAD, fontScale);
}

describe('nothing under a page title draws larger than the title (sc-67338)', () => {
  it('stops a section heading at the title’s drawn size at AX5, 43 not 56', () => {
    const title = titleSize(PAGE_TITLE, AX5);

    expect(title).toBe(43);
    expect(heading(title, AX5)).toBe(43);
    expect(heading(null, AX5)).toBeCloseTo(56.16);
  });

  it('never starts a heading under 18, even under a title stepped down below it', () => {
    expect(heading(15, AX5)).toBe(HEAD);
  });

  it('starts the heading from the cap, so it steps down by whole words from there', () => {
    expect(rows).toMatch(
      /start=\{HEAD_SIZE \* capUnderTitle\(cap \?\? Infinity, HEAD_SIZE, fontScale\)\}/u,
    );
  });

  it('caps the frame’s body at the title’s size, and only where a title is drawn', () => {
    expect(frame).toMatch(/<TitleCap\.Provider value=\{cap\}>\s+\{!ownTop && switchedNotice\}/u);
    expect(frame).toMatch(
      /const cap = framed && \(titleCap\.drawn \|\| !untitled\) \? titleCap\.cap : null;/u,
    );
  });

  it('keeps Back, the pill and the bell of a scrolling top outside the cap', () => {
    expect(frame).toMatch(
      /<TitleCap\.Provider value=\{null\}>\s+<ScreenTop \{\.\.\.top\} style=\{style\} rowStyle=\{rowStyle\} \/>/u,
    );
  });

  it('caps an event area under the title its body draws', () => {
    expect(event.match(/<BodyTitle\b/gu)).toHaveLength(2);
  });
});
