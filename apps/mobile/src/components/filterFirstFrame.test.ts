import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(join('src', 'components', 'EventsSearch.tsx'), 'utf8');
const between = (start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const fit = between('function usePicksFit(', 'function PicksLine(');
const filterButton = between(
  'const fit = usePicksFit(picks, word,',
  'style={wraps ? styles.filterWraps',
);
const searchRow = between('const [held, setHeld] = useState(false);', '</RowHold.Provider>');

describe("Events' Filter shows first where it settles (sc-78193)", () => {
  it('reads the widths from the cache kept across screens, and re-renders until this instance has seen them', () => {
    expect(source).toContain('const picksWidths = new Map<string, number>();');
    expect(fit).toContain('reads.every((text) => picksWidths.has(keyOf(text)))');
    expect(fit).toContain('if (picksWidths.get(key) === width && measured) return;');
    expect(fit).not.toMatch(/useState<[^>]*Map/u);
  });

  it('lets go of the row from a layout effect, keyed on Filter wrapping before it is measured', () => {
    expect(filterButton).toContain('const unplaced = wraps && fit.whole == null;');
    expect(filterButton).toMatch(
      /useLayoutEffect\(\(\) => \{\s+hold\?\.\(unplaced\);\s+return \(\) => hold\?\.\(false\);\s+\}, \[hold, unplaced\]\);/u,
    );
  });

  it('keeps the held row unseen, untappable and hidden from screen readers', () => {
    expect(searchRow).toContain('held && styles.held');
    expect(searchRow).toContain("pointerEvents={held ? 'none' : 'auto'}");
    expect(searchRow).toContain('accessibilityElementsHidden={held}');
    expect(searchRow).toContain(
      "importantForAccessibility={held ? 'no-hide-descendants' : 'auto'}",
    );
    expect(searchRow).toContain('<RowHold.Provider value={setHeld}>');
  });
});
