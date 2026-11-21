import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const guests = readFileSync(join('src', 'components', 'GuestsHeading.tsx'), 'utf8');

describe('Guests’ title takes one size, whatever Export draws at (sc-71821)', () => {
  it('measures Export hidden under the title’s start', () => {
    expect(guests).toMatch(
      /<TitleCap\.Provider value=\{titleSize\(size, fontScale\)\}>\s*<View onLayout=\{widthOf\(setExportWidest\)\}>\{exportsWidest\}<\/View>/u,
    );
  });

  it('sizes the title and places the actions from Export at its widest', () => {
    expect(guests).toMatch(/room=\{titleRoom\}/u);
    expect(guests).toMatch(
      /const titleRoom = titleRoomBeside\(\{\s*slot,\s*extra: exports == null \|\| under \? 0 : exportWidth,\s*widest: exportWidest,\s*\}\);/u,
    );
    expect(guests).toMatch(/extra: exports == null \? 0 : exportWidest \|\| exportWidth,/u);
  });
});
