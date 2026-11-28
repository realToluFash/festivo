import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const make = readFileSync(join('src', 'components', 'MakeDoorCode.tsx'), 'utf8');

describe('a refused or failed door code goes to the form’s top, where it is said (sc-4002)', () => {
  it('counts each answer that refuses or fails Make', () => {
    expect(make).toMatch(
      /else setFailed\(refusalSaid\(error, t\('doorCodes\.failMake'\)\)\);\s+setAnswered\(\(count\) => count \+ 1\);/u,
    );
  });

  it('hands the count to the screen, which scrolls its body to the top', () => {
    expect(make).toContain('toTop={answered}');
  });
});
