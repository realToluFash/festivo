import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PHONE_TITLE } from './bellTop.ts';

const parts = readFileSync(join('src', 'components', 'BellParts.tsx'), 'utf8');
const title = parts.slice(
  parts.indexOf('function PageTitle('),
  parts.indexOf('function PanelTop('),
);

describe('the phone bell screen’s title (sc-92959)', () => {
  it('is the screen’s header on the house WholeWords, from main’s 30 grown by the text size', () => {
    expect(parts).toMatch(/<PageTitle heading=\{heading\} refreshing=\{refreshing\} \/>/u);
    expect(title).toMatch(/<WholeWords\s+ref=\{heading\}\s+size=\{PHONE_TITLE\}/u);
    expect(title).toMatch(/start=\{PHONE_TITLE \* fontScale\}/u);
    expect(title).toMatch(/accessibilityRole="header"/u);
  });

  it('fits its word to its own line only from AX1, so below it the title draws as on main', () => {
    expect(title).toMatch(/room=\{atAccessibilitySizes\(fontScale\) \? room : undefined\}/u);
    expect(title).toMatch(/style=\{styles\.titleLine\}\s+onLayout=/u);
  });

  it('keeps the refreshing mark on the title’s line, where it wraps rather than shrinks the title', () => {
    expect(title.indexOf('{refreshing}')).toBeGreaterThan(title.indexOf('</WholeWords>'));
  });
});
