import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join('src', 'components', file), 'utf8');
const sheet = read('Sheet.tsx');
const people = read('PeopleParts.tsx');
const rows = read('SummaryRows.tsx');
const between = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const scrollView = between(
  sheet,
  'export function SheetScrollView(',
  'export function useSheetRevealed(',
);
const row = between(rows, 'export function Row({', 'export interface ListItem');

describe('The role sheet once it scrolls (sc-95217, on qa3 #95718)', () => {
  it('starts a scrolling heading under a strip of its own on a sheet that drags, its hairline only while scrolled', () => {
    expect(sheet).toContain(
      'export const SHEET_GRABBER_STRIP = tokens.spaceSm * 2 + GRABBER_HEIGHT;',
    );
    expect(scrollView).toContain('if (!holdsHeading || !drags) return scroll;');
    expect(scrollView).toMatch(/style=\{\[styles\.strip, away && styles\.stripScrolled\]\}/u);
    expect(sheet).toContain('stripScrolled: { borderBottomColor: tokens.colorBorder },');
    expect(sheet).toMatch(/<Drags\.Provider value=\{drags\}>/u);
  });

  it('takes the content back to its top on a drag down from the strip while scrolled, as the sheet holds still then', () => {
    expect(scrollView).toContain('if (from == null || !away) return;');
    expect(scrollView).toContain('scrollRef.current?.scrollTo({ y: 0, animated: true });');
    expect(scrollView).toContain('ref={scrollRef}');
  });

  it('keeps the heading where it sat, the strip taken from the body’s top padding', () => {
    expect(people).toContain('paddingTop: 27 - SHEET_GRABBER_STRIP,');
  });

  it('picks a role on a tap only, so a swipe that starts on a tall row picks nothing', () => {
    expect(row).toContain('<TapPressable');
    expect(row).not.toMatch(/<Pressable\b/u);
  });
});

describe('The role sheet header’s reading order (sc-95215, on lead’s review of #4319)', () => {
  const head = between(people, 'function PersonHead(', 'export function RoleSheet<');

  it('orders the words, then Done, only while there is a Done', () => {
    expect(head).toContain('done == null ? undefined : [WORDS_ID, DONE_ID]');
    expect(head).toContain('nativeID={WORDS_ID}');
    expect(head).toContain('nativeID={DONE_ID}');
  });

  it('keeps one Done mounted under one parent, so moving it under the line never remounts it out of the native order', () => {
    expect(people).toContain("const DONE_ID = 'people.role.done.slot';");
    expect(head.match(/\{action\}/gu)).toHaveLength(1);
    expect(head).not.toContain('under && action');
    expect(head).not.toContain('!under && action');
  });

  it('measures Done itself, not the slot that stretches to the row once Done goes under the line', () => {
    expect(head).toMatch(/<View onLayout=\{\(event\) => setDoneWidth\(event\.nativeEvent\.layout\.width\)\}>\s*<DoneAction/u);
    expect(head.match(/setDoneWidth/gu)).toHaveLength(2);
  });
});
