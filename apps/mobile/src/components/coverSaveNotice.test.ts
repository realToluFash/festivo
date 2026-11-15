import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'components', 'EventPartEdits.tsx'), 'utf8');
const cover = parts.slice(parts.indexOf('function CoverEdit('), parts.indexOf('const styles ='));
const use = cover.slice(cover.indexOf('async function use('), cover.indexOf('const shown'));
const choose = cover.slice(
  cover.indexOf('async function choose('),
  cover.indexOf('async function use('),
);

describe('Cover in the app says a refused save in the top notice (sc-52652)', () => {
  it('hands a refused Use this photo to the shell’s notice above the preview', () => {
    expect(use).toContain('setFailed(coverSaveRefusalOf(error, t));');
    expect(use).not.toContain('setRefused(');
    expect(cover).toMatch(/<EditShell[^>]*failed=\{failed\}/su);
  });

  it('keeps only the photo’s own refusals under the preview', () => {
    expect(cover).toContain('<EventNotice tone="broken" words={refused} interrupts />');
    expect(cover).toMatch(/<CoverUpload\s+refused=\{refused\}/u);
    expect(choose).not.toContain('coverSaveRefusalOf');
  });

  it('clears the top notice when another photo uploads, and before each save', () => {
    expect(choose).toMatch(/setPhoto\(\{ kind: 'ready'[^\n]+\n\s+setFailed\(null\);/u);
    expect(use).toMatch(/setBusy\(true\);\s+setFailed\(null\);/u);
  });
});
