import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'SearchScreen.tsx'), 'utf8');
const calls = [...screen.matchAll(/api\.search\(([^)]*)\)/gu)].map((call) => call[1]);

describe('the app’s Search leaves Invited people out (sc-39534, 15 Nov)', () => {
  it('asks the server without invitations on every call', () => {
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\{ invitations: false, signal: stop\.signal \}/u);
  });
});
