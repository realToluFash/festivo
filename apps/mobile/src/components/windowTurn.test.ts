import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// A window that goes as another comes must take its turn, or an iPad shows the second over nothing (sc-23267).
const HANDED_OVER = ['AppFrame.tsx', 'Sheet.tsx'];

function modals(file: string): string[] {
  const text = readFileSync(join(import.meta.dirname, file), 'utf8');

  return [...text.matchAll(/<Modal\b[\s\S]*?\n\s*>/g)].map(([tag]) => tag);
}

describe('the switcher and every sheet take turns for the window', () => {
  it.each(HANDED_OVER)(
    'in %s, a Modal is up only on its turn and says when it has gone',
    (file) => {
      const tags = modals(file);

      expect(tags).not.toHaveLength(0);
      for (const tag of tags) {
        expect(tag).toContain('visible={shown}');
        expect(tag).toContain('onDismiss={gone}');
      }
    },
  );

  it.each(HANDED_OVER)('in %s, the turn comes from the app’s one registry', (file) => {
    const text = readFileSync(join(import.meta.dirname, file), 'utf8');

    expect(text).toMatch(/const \{ shown, gone \} = useWindowTurn\(/);
  });
});
