import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const page = readFileSync(join(import.meta.dirname, 'EventPage.tsx'), 'utf8');
const outside = readFileSync(join(import.meta.dirname, 'OutsideOverview.tsx'), 'utf8');

describe('the Kitchen station row on each Overview (sc-95382)', () => {
  it('sits under Your night on the event page', () => {
    expect(page).toMatch(/\[night, station, floor\]\.filter\(/u);
  });

  it('sits under Your night and above the guests on an outsider’s Overview', () => {
    expect(outside).toMatch(
      /\.\.\.\(night == null \? \[\] : \[night\]\),\n\s*\.\.\.\(station == null \? \[\] : \[station\]\),\n\s*\.\.\.\(floor == null \? \[\] : \[floor\]\),\n\s*\.\.\.\(reads\n\s*\? \[\n\s*\{\n\s*key: 'guests',/u,
    );
  });
});

describe('the Floor row on each Overview (sc-98893)', () => {
  it('sits under Kitchen station, which a missing row leaves out, so under Your night or first', () => {
    expect(page).toMatch(/\[night, station, floor\]\.filter\(\(item\) => item != null\)/u);
    expect(outside).toMatch(
      /\.\.\.\(station == null \? \[\] : \[station\]\),\n\s*\.\.\.\(floor == null \? \[\] : \[floor\]\),/u,
    );
  });
});
