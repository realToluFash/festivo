import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import BANNER from './TodayBanner.tsx?raw';
import PARTS from './TodayParts.tsx?raw';

it.each([
  ['TodayBanner.tsx', BANNER],
  ['TodayParts.tsx', PARTS],
])("%s carries Today's narrow arrangement into the product", (_, source) => {
  expect(
    source,
    'without it, a desk window from 641 to 1439 px cuts words short (sc-57575)',
  ).toContain("import './todayFit.css';");
});

it("hangs Today's narrow arrangement from the product's frame, not only the demo's", () => {
  const fit = readFileSync(join(import.meta.dirname, 'todayFit.css'), 'utf8');

  expect(fit).toContain('.fits-phone');
  expect(fit).not.toContain('.dp-fit');
});
