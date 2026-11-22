import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');

describe('This event is not available (sc-80863)', () => {
  it('stands in the bare Events frame: no title upright, nothing above it on a phone', () => {
    expect(frame).toMatch(/\{!bareList && titleRow\(\)\}/u);
    expect(frame).toMatch(/if \(bareList\) return <View style=\{\{ height: insets\.top \}\} \/>;/u);
  });
});
