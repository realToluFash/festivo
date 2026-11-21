import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { frameTitleSize, lineStart, titleSize } from '../layout/textSize.ts';

const controls = readFileSync(join('src', 'components', 'CalendarControls.tsx'), 'utf8');
const menu = controls.slice(
  controls.indexOf('export function ShowMenu<'),
  controls.indexOf('\n}\n', controls.indexOf('export function ShowMenu<')),
);

const AX1 = 1.786;
const AX2 = 2.143;
const AX5 = 3.571;
const PHONE = 402;

describe('the Calendar’s Show menu keeps every word whole (sc-78219)', () => {
  it('draws each row’s words through the menu’s words, never a bare text', () => {
    expect(menu).toMatch(/<MenuWords size=\{16\} weight=\{on \? 'semibold' : 'medium'\}/u);
    expect(menu).not.toMatch(/<Text\b/u);
  });

  it('pads a row from AX1 only, so the standard sizes keep main’s row', () => {
    expect(menu).toMatch(
      /const grown = atAccessibilitySizes\(useWindowDimensions\(\)\.fontScale\)/u,
    );
    expect(menu).toMatch(/grown && styles\.choiceGrown/u);
    expect(controls).toMatch(/choiceGrown: \{ paddingVertical: tokens\.spaceXs \}/u);
  });

  it('starts a row at 16 × the size, no larger than the Calendar title', () => {
    const row = /<MenuWords size=\{(\d+)\}/u.exec(menu);
    const size = Number(row?.[1]);
    const title = frameTitleSize(false, PHONE);

    expect(size).toBe(16);
    expect(lineStart(size, AX1, titleSize(title, AX1), Infinity)).toBeCloseTo(28.58, 1);
    expect(lineStart(size, AX2, titleSize(title, AX2), Infinity)).toBeCloseTo(34.29, 1);
    expect(lineStart(size, AX5, titleSize(title, AX5), Infinity)).toBe(43);
  });
});
