import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const home = readFileSync(join('src', 'demo', 'settings', 'SettingsHome.tsx'), 'utf8');
const rows = readFileSync(join('src', 'demo', 'settings', 'SummaryRows.tsx'), 'utf8');

function style(name: string): string {
  const at = home.indexOf(`  ${name}: `);
  if (at < 0) throw new Error(`SettingsHome.tsx has no ${name} style.`);

  return home.slice(at, home.indexOf('\n  ', at + 1));
}

describe('the Settings column on the iPad on its side, lit with Tint and no ring (sc-31724)', () => {
  it('lights an open section’s row as a selected row is lit: Tint at radius 12, no border', () => {
    expect(style('rowOpen')).toBe('  rowOpen: SELECTED_ROW,');
    expect(rows).toMatch(
      /SELECTED_ROW = \{\s+borderRadius: tokens\.radiusRow,\s+backgroundColor: tokens\.colorAccentTint,\s+\} as const;/u,
    );
  });

  it('lights Your account’s card with a Tint plate 10 past it, following its corners, and no ring', () => {
    expect(home).toMatch(/const LIT_PAST = tokens\.spaceMd;/u);
    expect(style('personPlate')).toBe('  personPlate: { margin: -LIT_PAST, padding: LIT_PAST },');
    expect(home).toMatch(
      /open && \{ backgroundColor: tokens\.colorAccentTint, borderRadius: look\.radius \+ LIT_PAST \}/u,
    );
  });

  it('draws no ring around anything open in the list', () => {
    expect(home).not.toMatch(/borderColor: tokens\.colorAccent\b/u);
    expect(home).not.toMatch(/personOpen/u);
  });
});
