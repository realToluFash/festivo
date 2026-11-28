import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { frameTitleSize, lineStart, titleSize } from '../layout/textSize.ts';

const search = readFileSync(join('src', 'components', 'EventsSearch.tsx'), 'utf8');
const moment = readFileSync(join('src', 'components', 'MomentPick.tsx'), 'utf8');
const title = readFileSync(join('src', 'components', 'Title.tsx'), 'utf8');

const AX1 = 1.786;
const AX5 = 3.571;

function body(name: string, source = search): string {
  const start = source.indexOf(`function ${name}(`);

  return source.slice(start, source.indexOf('\n}\n', start));
}

describe('the Filter menu’s drilled levels keep every word whole (sc-75213)', () => {
  it('starts the Back title at 16 × AX1 under the Events title’s 38, and at its 43 from AX5', () => {
    const back = /<MenuWords size=\{(\d+)\} weight="bold" accessibilityRole="header">/u.exec(
      body('Drilled'),
    );
    const size = Number(back?.[1]);
    const title = frameTitleSize(false, 402);

    expect(size).toBe(16);
    expect(lineStart(size, AX1, titleSize(title, AX1), Infinity)).toBeCloseTo(28.58, 1);
    expect(lineStart(size, AX5, titleSize(title, AX5), Infinity)).toBe(43);
  });

  it('draws each type, choice, host and Back title through the menu’s words', () => {
    for (const name of ['Check', 'Radio', 'Drilled']) {
      expect(body(name)).toMatch(/<MenuWords\b/u);
      expect(body(name)).not.toMatch(/<Text\b/u);
    }
  });

  it('fits them only from AX1, keeping main’s text at the standard sizes', () => {
    const words = body('MenuWords', title);

    expect(words).toMatch(/if \(!atAccessibilitySizes\(fontScale\)\)[\s\S]*?<Text\b/u);
    expect(words).toMatch(/<CappedWholeWords \{\.\.\.look\} room=\{room\} breakAfterHyphens>/u);
  });

  it('stacks From and To from AX1, each label and date fitted whole', () => {
    const menu = body('EventsFilterMenu');

    expect(menu).toMatch(/grown && styles\.betweenStacked/u);
    expect(menu).toMatch(/<MenuWords size=\{13\} weight="semibold" accessible>/u);
    expect(menu).toMatch(/grown=\{grown\}/u);
    expect(moment).toMatch(/grown \?[\s\S]*?<CappedWholeWords[\s\S]*?room=\{room\}/u);
  });
});
