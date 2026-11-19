import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'demo', 'settings', 'Frame.tsx'), 'utf8');

describe('the demo settings bell speaks its locale (sc-30410, #33361)', () => {
  it("is the product's bell, naming its unread count through the plural key", () => {
    expect(frame).toMatch(
      /import \{ Bell as ProductBell \} from '\.\.\/\.\.\/components\/BellButton\.tsx';/u,
    );
    expect(frame).toMatch(/<ProductBell\s+ref=\{ref\}\s+unread=\{3\}/u);
    expect(frame).not.toMatch(/label="Notifications/u);
  });
});
