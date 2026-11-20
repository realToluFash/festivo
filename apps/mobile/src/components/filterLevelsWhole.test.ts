import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fitWidest, lineStart, piecesIn } from '../layout/textSize.ts';

const search = readFileSync(join('src', 'components', 'EventsSearch.tsx'), 'utf8');
const moment = readFileSync(join('src', 'components', 'MomentPick.tsx'), 'utf8');

const AX1 = 1.786;
const AX5 = 3.571;

function body(name: string): string {
  const start = search.indexOf(`function ${name}(`);

  return search.slice(start, search.indexOf('\n}\n', start));
}

describe('the Filter menu’s drilled levels keep every word whole (sc-75213)', () => {
  it('starts a row’s words at 16 × the size, no larger than the Events title', () => {
    expect(lineStart(16, AX1, 38, Infinity)).toBeCloseTo(28.58, 1);
    expect(lineStart(16, AX5, 43, Infinity)).toBe(43);
    expect(lineStart(15, AX5, 43, Infinity)).toBe(43);
  });

  it('steps a word too wide for its line down to where it fits, never under its default size', () => {
    expect(fitWidest(16, 43, 260, 200)).toBe(33);
    expect(fitWidest(16, 43, 900, 200)).toBe(16);
    expect(fitWidest(16, 43, 180, 200)).toBe(43);
  });

  it('measures a host by the pieces after its own hyphen, not the whole name', () => {
    expect(piecesIn(['Funmilayo Adéṣínà-Ọláolúwa'])).toEqual(['Funmilayo', 'Adéṣínà-', 'Ọláolúwa']);
  });

  it('draws each type, choice, host and Back title through the level’s words', () => {
    for (const name of ['Check', 'Radio', 'Drilled']) {
      expect(body(name)).toMatch(/<LevelWords\b/u);
      expect(body(name)).not.toMatch(/<Text\b/u);
    }
  });

  it('fits them only from AX1, keeping main’s text at the standard sizes', () => {
    const words = body('LevelWords');

    expect(words).toMatch(/if \(!atAccessibilitySizes\(fontScale\)\)[\s\S]*?<Text\b/u);
    expect(words).toMatch(/<CappedWholeWords \{\.\.\.look\} room=\{room\} breakAfterHyphens>/u);
  });

  it('stacks From and To from AX1, each label and date fitted whole', () => {
    const menu = body('EventsFilterMenu');

    expect(menu).toMatch(/grown && styles\.betweenStacked/u);
    expect(menu).toMatch(/<LevelWords size=\{13\} weight="semibold" accessible>/u);
    expect(menu).toMatch(/grown=\{grown\}/u);
    expect(moment).toMatch(/grown \?[\s\S]*?<CappedWholeWords[\s\S]*?room=\{room\}/u);
  });
});
