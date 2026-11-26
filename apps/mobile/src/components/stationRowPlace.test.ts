import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const page = readFileSync(join('src', 'components', 'EventPage.tsx'), 'utf8');
const outside = readFileSync(join('src', 'components', 'OutsideOverview.tsx'), 'utf8');

describe('the Kitchen station row on each Overview (sc-95382)', () => {
  it('sits under Your night on the event page', () => {
    expect(page).toMatch(/\[night, station\]\.filter\(/u);
  });

  it('sits under Your night and above the guests on an outsider’s Overview', () => {
    expect(outside).toMatch(
      /\.\.\.\(night == null \? \[\] : \[night\]\),\n\s*\.\.\.\(station == null \? \[\] : \[station\]\),\n\s*\{\n\s*key: 'guests',/u,
    );
  });
});
