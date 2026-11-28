import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const board = readFileSync(join('src', 'components', 'CalendarBoard.tsx'), 'utf8');
const between = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const daySheet = between(board, '<Sheet', '</Sheet>');
const sheetBody = between(board, '  sheetBody: {', '},');

describe('The Calendar’s day sheet once it scrolls (sc-95859)', () => {
  it('scrolls its heading under the grabber’s strip, sized to its rows', () => {
    expect(daySheet).toMatch(/<SheetScrollView\s+holdsHeading\b/u);
    expect(daySheet).toContain('style={styles.sheetScroll}');
    expect(board).toContain('sheetScroll: { flexGrow: 0, flexShrink: 1 },');
  });

  it('gives the body no top padding, the strip standing above it', () => {
    expect(sheetBody).not.toMatch(/paddingTop/u);
  });
});
