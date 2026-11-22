import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const edits = readFileSync(join('src', 'components', 'EventEdits.tsx'), 'utf8');
const rows = edits.slice(
  edits.indexOf('export function HostRows('),
  edits.indexOf('function MoveButton('),
);
const parts = readFileSync(join('src', 'components', 'EventPartEdits.tsx'), 'utf8');
const hostsEdit = parts.slice(parts.indexOf('function HostsEdit('));

describe('Hosted by is typed in as the AC has it (sc-15497)', () => {
  it('puts the cursor in the row Add a host adds', () => {
    expect(rows).toMatch(
      /focusNext\.current = \{ to: \{ key, control: 'name' \}, keys: true \};\s+onHosts\(\[\.\.\.hosts, \{ key, name: '' \}\]\);/u,
    );
    expect(rows).toMatch(
      /if \(keys && to !== 'add'\) \{\s+focusChecked\(\{ current: inputs\.current\.get\(to\.key\) \?\? null \}\);/u,
    );
  });

  it('wraps a long name onto more lines, never scrolling it sideways', () => {
    expect(rows).toMatch(/multiline\s+scrollEnabled=\{false\}\s+submitBehavior="blurAndSubmit"/u);
  });

  it('says a draft has no hosts yet above Add a host, only while there are none', () => {
    expect(rows).toMatch(
      /\{t\('eventHosts\.explainer'\)\}\s+<\/Text>\s+\{saysNone && hosts\.length === 0 && \(/u,
    );
    expect(rows).toMatch(
      /<GlyphMark mark=\{tokens\.marks\.notStarted\} \/>[\s\S]*?t\('eventHosts\.none'\)/u,
    );
    expect(hostsEdit.slice(0, hostsEdit.indexOf('</EditShell>'))).toMatch(
      /<HostRows[\s\S]*?\bsaysNone\b/u,
    );
  });
});
