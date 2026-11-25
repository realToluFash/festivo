import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'demo', 'bandLive', 'BandLiveScreen.tsx'), 'utf8');

describe('the band’s capsule at the largest sizes (sc-92571)', () => {
  it('grows the row with the capsule, so the live line starts below its foot', () => {
    expect(screen).toMatch(
      /onLayout=\{\(layout\) => setCapsule\(layout\.nativeEvent\.layout\.height\)\}/u,
    );
    expect(screen).toMatch(/capsule > CAPSULE_HEIGHT && \{ minHeight: CAPSULE_TOP \+ capsule \}/u);
  });
});
