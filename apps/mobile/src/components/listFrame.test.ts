import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const settings = join('app', 'settings');
const pages = readdirSync(settings).filter(
  (file) =>
    file.endsWith('.tsx') &&
    readFileSync(join(settings, file), 'utf8').includes('alone && <FrameTop'),
);

describe("a Settings page's title", () => {
  it('stands 16 above the first block on every page that scrolls its own top (sc-49170)', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages)
      expect(readFileSync(join(settings, page), 'utf8')).toMatch(
        /alone && <FrameTop style=\{titleFoot\(/,
      );
  });

  it("stands 16 above Members' card too, whose top ListAndPage draws (sc-49170)", () => {
    expect(readFileSync(join(settings, 'members.tsx'), 'utf8')).toMatch(/settingsTitle: true/);
    expect(readFileSync(join('src', 'components', 'ListAndPage.tsx'), 'utf8')).toMatch(
      /<FrameTop style=\{topStyle\} \/>/,
    );
  });
});
