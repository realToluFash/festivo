import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'demo', 'guests', 'GuestsParts.tsx'), 'utf8');
const screen = readFileSync(join('src', 'demo', 'guests', 'GuestsScreen.tsx'), 'utf8');

describe('the demo’s Guests title takes one size, as the product’s does (sc-71821)', () => {
  it('measures Export hidden under the title’s start', () => {
    expect(parts).toMatch(
      /<TitleCap\.Provider value=\{titleSize\(size, fontScale\)\}>\s*<View onLayout=\{widthOf\(setWidest\)\}>\{extraWidest\}<\/View>/u,
    );
    expect(screen).toMatch(/extraWidest=\{\s*exportShown \? \(\s*<ExportButton[^>]*\smeasured\s/u);
  });

  it('sizes the title and places the actions from Export at its widest', () => {
    expect(parts).toMatch(/room=\{titleRoom\}/u);
    expect(parts).toMatch(/slot: titleRoom,/u);
    expect(parts).toMatch(
      /const titleRoom = titleRoomBeside\(\{\s*slot,\s*extra: extra == null \|\| under \? 0 : extraWidth,\s*widest,\s*\}\);/u,
    );
    expect(parts).toMatch(/extra: extra == null \? 0 : widest \|\| extraWidth,/u);
  });
});
