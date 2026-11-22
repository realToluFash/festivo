import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const edits = readFileSync(join('src', 'components', 'EventEdits.tsx'), 'utf8');
const rows = edits.slice(
  edits.indexOf('export function HostRows('),
  edits.indexOf('function MoveButton('),
);

describe('Hosted by is typed in as the AC has it (sc-15497)', () => {
  it('puts the cursor in the row Add a host adds', () => {
    expect(rows).toMatch(
      /added\.current = key;\s+onHosts\(\[\.\.\.hosts, \{ key, name: '' \}\]\);/u,
    );
    expect(rows).toMatch(
      /if \(key != null\) focusChecked\(\{ current: inputs\.current\.get\(key\) \?\? null \}\);\s+\}, \[hosts\]\);/u,
    );
  });

  it('wraps a long name onto more lines, never scrolling it sideways', () => {
    expect(rows).toMatch(/multiline\s+scrollEnabled=\{false\}\s+submitBehavior="blurAndSubmit"/u);
  });
});
