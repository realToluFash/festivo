import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'demo', 'settings', 'Frame.tsx'), 'utf8');

describe('the demo settings bell speaks its locale (sc-30410, #33361)', () => {
  it('names its unread count through the plural key, not an English literal', () => {
    expect(frame).toMatch(/label=\{t\('notifications\.bellUnread', \{ count: 3 \}\)\}/u);
    expect(frame).not.toMatch(/label="Notifications/u);
  });
});
