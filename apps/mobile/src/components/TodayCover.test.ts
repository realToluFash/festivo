import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const cover = readFileSync(join('src', 'components', 'TodayCover.tsx'), 'utf8');

describe('the tab bar’s labels at twice the text size (sc-37298)', () => {
  it('measures each label whole in SemiBold, capped at 20', () => {
    expect(cover).toMatch(/const TAB_LABEL = 12;/u);
    expect(cover).toMatch(/const TAB_LABEL_MOST = 20;/u);
    expect(cover).toMatch(
      /useWholeWords\(\s+TAB_LABEL,\s+Math\.min\(TAB_LABEL \* fontScale, TAB_LABEL_MOST\),\s+tabs\.map\(\(\[label, glyph\]\) => say\(label, glyph\)\),\s+\{ weight: 'semibold' \},\s+\);/u,
    );
  });
});
