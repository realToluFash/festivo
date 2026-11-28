import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const demo = readFileSync(join(import.meta.dirname, 'MyNightScreen.tsx'), 'utf8');

describe('Open Floor under Check-in in the demo (sc-98893)', () => {
  it('stands tall on a phone and 44 on a tablet, as the product does', () => {
    expect(demo).toMatch(
      /<SecondaryButton\s+label=\{openFloor\.label\}[^/]*tall=\{!wide\}\s+testID="myNight\.openFloor"/u,
    );
  });
});
