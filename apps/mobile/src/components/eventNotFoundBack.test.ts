import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');
const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');

describe('This event is not available (sc-80863)', () => {
  it("opens Events whatever the link was opened over, never the stack's back", () => {
    expect(screen).toMatch(
      /<EventNotFound onBack=\{\(\) => router\.dismissTo\(DESTINATION_HREF\.events\)\} \/>/u,
    );
  });

  it('stands in the bare Events frame: no title upright, nothing above it on a phone', () => {
    expect(frame).toMatch(/\{!bareList && titleRow\(\)\}/u);
    expect(frame).toMatch(/if \(bareList\) return <View style=\{\{ height: insets\.top \}\} \/>;/u);
  });
});
