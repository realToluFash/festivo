import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const page = readFileSync(join('app', 'join', '[token].tsx'), 'utf8');

describe('the join page’s titles keep every word whole (sc-88028)', () => {
  it('draws both titles on the house Title, reporting to the cap', () => {
    expect(page.match(/<Title\b[^>]*?onDrawn=\{(?:titleCap\.)?onDrawn\}/gsu)).toHaveLength(2);
    expect(page).toMatch(/<Top organisation=\{organisation\} onDrawn=\{titleCap\.onDrawn\} \/>/u);
  });

  it('puts both pages under the title cap', () => {
    expect(page.match(/<TitleCap\.Provider value=\{titleCap\.cap\}>/gu)).toHaveLength(2);
  });
});
