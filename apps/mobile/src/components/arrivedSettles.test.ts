import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const skeleton = readFileSync(join('src', 'components', 'Skeleton.tsx'), 'utf8');
const arrived = skeleton.slice(
  skeleton.indexOf('export function Arrived('),
  skeleton.indexOf('function usePulse('),
);

describe('Arrived lets go of its fade once it has ended (sc-48600)', () => {
  it('settles from the fade’s end', () => {
    expect(arrived).toContain('const still = reduced || settled;');
    expect(arrived).toContain('run.start(() => setSettled(true));');
  });

  it('passes the fade’s opacity only while it runs', () => {
    expect(arrived).toContain('!still && { opacity: shown }');
    expect(arrived).not.toMatch(/style=\{\[style, \{ opacity: shown \}\]\}/u);
  });

  it('holds the content seen when less motion is asked for', () => {
    expect(arrived).toMatch(/if \(still\) \{\s+shown\.setValue\(1\);\s+return;/u);
  });
});
