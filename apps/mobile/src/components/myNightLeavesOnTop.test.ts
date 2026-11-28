import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'MyNightScreen.tsx'), 'utf8');

describe('Your night once the API no longer answers (sc-3918)', () => {
  it('leaves only while it is the screen on top, so Who is here above it is not the one popped', () => {
    expect(screen).toMatch(
      /useFocusEffect\(\s*useCallback\(\(\) => \{\s*if \(seen\.kind === 'gone'\) onBack\(\);/u,
    );
    expect(screen).not.toMatch(/useEffect\(\(\) => \{\s*if \(seen\.kind === 'gone'\)/u);
  });
});
