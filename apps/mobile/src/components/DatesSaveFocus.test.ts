import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'components', 'EventPartEdits.tsx'), 'utf8');
const edits = readFileSync(join('src', 'components', 'EventEdits.tsx'), 'utf8');
const dates = parts.slice(
  parts.indexOf('function DatesEdit('),
  parts.indexOf('function useHaventCounts('),
);

describe('Dates refuses Save onto the field that shows a line (sc-52008)', () => {
  it('aims at the start or the end on a live line, and on a refusal from the server', () => {
    expect(dates).toMatch(
      /if \(Object\.keys\(live\)\.length > 0\) \{\s+setAim\(\{ start: \(live\.startsAt \?\? live\.timeZone\) != null \}\);\s+return;/u,
    );
    expect(dates).toContain(
      'setAim({ start: (refusal.errors.startsAt ?? refusal.errors.timeZone) != null });',
    );
    expect(dates).toContain('moveScreenReaderFocus((aim.start ? startBox : endBox).current);');
    expect(dates).toMatch(/startRef=\{startBox\}\s+endRef=\{endBox\}/u);
  });

  it('reads the line with the box it sits under', () => {
    expect(edits).toMatch(/wrong=\{endError != null\}\s+line=\{endError\}/u);
    expect(edits).toMatch(/wrong=\{startError != null\}\s+line=\{startError\}/u);
  });
});
