import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join('src', 'components', file), 'utf8');
const parts = read('EventPartEdits.tsx');
const edits = read('EventEdits.tsx');
const overlays = read('SummaryOverlays.tsx');
const field = read('Field.tsx');
const shell = edits.slice(edits.indexOf('export function EditShell('));
const save = parts.slice(
  parts.indexOf('function usePartSave('),
  parts.indexOf('function useShellProps('),
);
const cover = parts.slice(parts.indexOf('function CoverEdit('), parts.indexOf('const styles ='));
const screen = overlays.slice(overlays.indexOf('export function FocusedScreen('));

describe('a part’s screen goes to its top when Save is answered with a notice (sc-74540)', () => {
  it('counts each save the notices answer, the second with the same change included', () => {
    expect(save).toContain('if (answeredWithNotice(sent)) setNoticed((count) => count + 1);');
    expect(cover).toMatch(
      /setFailed\(coverSaveRefusalOf\(error, t\)\);\s+setNoticed\(\(count\) => count \+ 1\);/u,
    );
  });

  it('hands the count to the shell from every part', () => {
    expect(parts.match(/<EditShell\b/gu)).toHaveLength(8);
    expect(parts.match(/noticed=\{noticed\}/gu)).toHaveLength(8);
  });

  it('scrolls the screen’s own body to its top on each new count, and only then', () => {
    expect(shell).toContain('toTop={noticed}');
    expect(screen).toContain('if (toTop === wentToTop.current) return;');
    expect(screen).toContain('scroll.current?.scrollTo({ y: 0, animated: !reduced });');
  });

  it('lets that scroll land before the focused field is followed again', () => {
    expect(screen).toMatch(/holdField\(\);\s+scroll\.current\?\.scrollTo/u);
  });

  it('tells the screen each character typed in a field', () => {
    expect(field).toMatch(/onChangeText\?\.\(text\);\s+fieldTyped\(\);/u);
  });
});
