import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'demo', 'search', 'SearchScreen.tsx'), 'utf8');
const retry = /function retry\(\): void \{([^}]*)\}/u.exec(screen)?.[1] ?? '';
const failed = /if \(phase === 'failed'\)([\s\S]*?)\);\n/u.exec(screen)?.[1] ?? '';

describe('the app’s failed search and its Try again (sc-39534)', () => {
  it('draws the sentence with a Try again that reaches retry', () => {
    expect(failed).toContain('{W.failed}');
    expect(failed).toMatch(/<TextAction label=\{W\.tryAgain\} onPress=\{onRetry\}/u);
    expect(screen).toMatch(/onRetry=\{retry\}/u);
  });

  it('searches the same term again through loading, with focus back in the field', () => {
    expect(retry).toContain("setPhase('loading');");
    expect(retry).toContain('setRetrying(true);');
    expect(retry).toContain('field.current?.focus();');
    expect(retry).not.toMatch(/setTyped|setTerm/u);
    expect(screen).toMatch(/if \(!retrying\) return undefined;/u);
    expect(screen).toMatch(/setPhase\(phaseOf\(term\)\);\n\s*setRetrying\(false\);/u);
  });

  it('reads the failure out, as it reads the count', () => {
    expect(screen).toMatch(/phase === 'failed'\n\s*\? W\.failed/u);
  });
});
