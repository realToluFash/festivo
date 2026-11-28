import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'demo', 'search', 'SearchScreen.tsx'), 'utf8');
const kit = readFileSync(join('src', 'components', 'EventsSearch.tsx'), 'utf8');
const searchField = /const searchField = \(([\s\S]*?)\n {2}\);/u.exec(screen)?.[1] ?? '';
const results = /const results = \(([\s\S]*?)\n {2}\);/u.exec(screen)?.[1] ?? '';

describe('the app’s Search field and its hint (sc-53041)', () => {
  it('hands the field the one word Search, and nothing longer', () => {
    expect(searchField).toMatch(/<SearchField\b/u);
    expect(searchField).toMatch(/\blabel=\{W\.search\}/u);
    expect(searchField).not.toMatch(/W\.(idle|placeholder)/u);
  });

  it('shows that word as the field’s placeholder', () => {
    expect(kit).toContain('const named = label ?? ');
    expect(kit).toMatch(/placeholder=\{named\}/u);
  });

  it('puts the scope in the hint under the field, from the person’s reach', () => {
    expect(results).toMatch(/\bhint=\{W\.idle\(start\.reach\)\}/u);
    expect(screen).toMatch(
      /if \(phase === 'idle'\) return hint == null \? null : <Said words=\{hint\} \/>;/u,
    );
  });
});
