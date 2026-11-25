import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'components', 'PeopleParts.tsx'), 'utf8');
const addBoxStyle = parts.slice(
  parts.indexOf('  addBox: {'),
  parts.indexOf('\n  },', parts.indexOf('  addBox: {')),
);

describe('People’s add field grows with its label at the accessibility sizes (sc-31774)', () => {
  it('sets a floor on its height rather than fixing it', () => {
    expect(addBoxStyle).toMatch(/minHeight: 52/u);
    expect(addBoxStyle).not.toMatch(/\n\s*height:/u);
    expect(addBoxStyle).toMatch(/paddingVertical:/u);
  });

  it('gives its label the row’s width, so the label wraps', () => {
    expect(parts).toMatch(
      /<Text size=\{16\} weight="medium" accessible=\{false\} style=\{\[styles\.grow, styles\.secondary\]\}>\n\s*\{label\}/u,
    );
  });
});
