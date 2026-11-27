import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { tagChrome } from '../layout/tagLine.ts';

const rows = readFileSync(join('src', 'components', 'SummaryRows.tsx'), 'utf8');
const tag = rows.slice(
  rows.indexOf('export function Tag('),
  rows.indexOf('\n}\n', rows.indexOf('export function Tag(')),
);

describe('a row’s tag keeps every word whole at the accessibility sizes (sc-90472)', () => {
  it('draws its words through the kit’s capped whole words, on its line, from AX1 only', () => {
    expect(tag).toMatch(/grown && line != null \? \(\n\s*<CappedWholeWords\n\s*size=\{TAG_SIZE\}/u);
    expect(tag).toMatch(/room=\{room\}\n\s*breakAfterHyphens/u);
    expect(tag).toMatch(/const grown = atAccessibilitySizes\(fontScale\)/u);
  });

  it('takes its line from the title row it sits in', () => {
    expect(rows).toMatch(/<TagLine\.Provider value=\{line\}>\{tag\}<\/TagLine\.Provider>/u);
  });

  it('leaves its words the line less what the tag draws around them', () => {
    expect(tagChrome({ marks: 0, turning: false, ringed: false })).toBe(18);
    expect(tagChrome({ marks: 1, turning: false, ringed: false })).toBe(7 + 9 + 12 + 5);
    expect(tagChrome({ marks: 1, turning: false, ringed: true })).toBe(7 + 9 + 2 + 12 + 5);
    expect(tagChrome({ marks: 1, turning: true, ringed: false })).toBe(7 + 9 + 12 + 6);
  });
});
