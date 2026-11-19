import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'demo', 'people', 'PeopleFrame.tsx'), 'utf8');

describe('nothing under People’s title draws larger than the title (sc-67665)', () => {
  it('caps People in the event’s frame under its title, as the frame caps Guests', () => {
    expect(frame).toMatch(/const frameDrawn = usePageTitleDrawn\(\);[^]*?frameDrawn\?\.\(size\);/u);
    expect(frame).toMatch(/<PeopleTitle onDrawn=\{onDrawn\} \/>/u);
  });
});
