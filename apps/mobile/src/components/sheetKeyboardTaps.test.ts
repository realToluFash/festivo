import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sheet = readFileSync(join('src', 'components', 'Sheet.tsx'), 'utf8');
const start = sheet.indexOf('export function SheetScrollView(');
const scrollView = sheet.slice(start, sheet.indexOf('export function useSheetRevealed(', start));

describe('A sheet with the keyboard up (sc-104480)', () => {
  it('passes a press on a control through, and lets a sheet say otherwise', () => {
    expect(scrollView).toMatch(/keyboardShouldPersistTaps="handled"\s+\{\.\.\.props\}/u);
  });
});
