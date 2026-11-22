import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');

describe('This event is not available (sc-80863)', () => {
  it('goes back by backToEvents and stands in the bare Events frame eventTop gives it', () => {
    expect(screen).toMatch(/onBack=\{\(\) => backToEvents\(router\)\}/u);
    expect(screen).toMatch(/bareList=\{!top\.inEvent\}/u);
  });
});
