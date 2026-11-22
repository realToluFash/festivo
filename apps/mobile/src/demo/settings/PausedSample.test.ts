import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pausedIn } from './PausedSample.ts';

const ENGLISH = /Monday|Wednesday|Nov|Dec| at /u;

describe('sc-83881: the paused page in the reader language, the bell on its side', () => {
  it.each(['es', 'fr', 'pt'])('writes the suspension dates in %s with no English', (language) => {
    const { suspension } = pausedIn(language);

    expect(suspension.since.written).not.toMatch(ENGLISH);
    expect(suspension.removesAt?.written).not.toMatch(ENGLISH);
    expect(suspension.since.written).toContain('10:00 WAT');
  });

  it('keeps English for English and for a language it has no words for', () => {
    expect(pausedIn('en').suspension.since.written).toBe('Monday, Nov 2 at 10:00 WAT');
    expect(pausedIn('de').suspension.since.written).toBe('Monday, Nov 2 at 10:00 WAT');
  });

  it('ends the paused page side top with the bell, and no page title', () => {
    const home = readFileSync(join(import.meta.dirname, 'SettingsHome.tsx'), 'utf8');

    expect(home).toMatch(
      /held === 'paused' && \(\s*<View style=\{styles\.heldSideTop\}>\s*<Bell tell=\{shell\.tell\} \/>/u,
    );
    expect(home).toContain("justifyContent: 'flex-end'");
  });
});
