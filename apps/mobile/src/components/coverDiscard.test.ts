import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'components', 'EventPartEdits.tsx'), 'utf8');
const cover = parts.slice(parts.indexOf('function CoverEdit('), parts.indexOf('const styles ='));
const between = (from: string, to: string): string =>
  cover.slice(cover.indexOf(from), cover.indexOf(to, cover.indexOf(from)));
const letGo = between('const letGo = useCallback(', '\n  }, [');
const close = between('function close(', '\n  }\n');
const choose = between('async function choose(', 'async function use(');
const use = between('async function use(', 'const shown');
const remove = between('onRemove={', 'off={');
const shell = between('<EditShell', '>\n');

describe('Cover in the app deletes a photo turned down at once (sc-55049)', () => {
  it('lets the staged upload go, deleting it from the store', () => {
    expect(letGo).toContain('attempt.current += 1;');
    expect(letGo).toMatch(
      /if \(staged\.current != null\) discardCoverUpload\(event\.organisationId, staged\.current\);\s+staged\.current = null;/u,
    );
  });

  it('closes through letGo, overriding the shell’s own close', () => {
    expect(close).toMatch(/letGo\(\);\s+props\.onClose\(\);/u);
    expect(shell).toMatch(/\{\.\.\.useShellProps\('cover', props\)\}\s+onClose=\{close\}/u);
  });

  it('lets the upload go when Remove photo is tapped', () => {
    expect(remove).toContain('letGo();');
  });

  it('deletes an upload that lands after its attempt was overtaken', () => {
    expect(choose).toContain(
      'if (mine !== attempt.current) return discardCoverUpload(event.organisationId, signed.key);',
    );
  });

  it('keeps a photo once it is used', () => {
    expect(use).toMatch(/staged\.current = null;[\s\S]*onSaved\(updated\);/u);
  });

  it('lets the upload go when the screen unmounts', () => {
    expect(cover).toContain('useEffect(() => letGo, [letGo]);');
  });
});
