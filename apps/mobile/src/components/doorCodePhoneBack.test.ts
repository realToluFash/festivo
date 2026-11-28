import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const redeem = readFileSync(join('src', 'components', 'Redeem.tsx'), 'utf8');

describe('a door code’s way back from the phone code (sc-4235)', () => {
  it('keeps the name, country and number that were typed', () => {
    expect(redeem).toContain(
      "const back = { kind: 'event' as const, code: at.code, opened: at.opened, typed: at.typed };",
    );
  });

  it('says the refusal of a full code over the door code', () => {
    expect(redeem).toMatch(
      /if \(leave\.kind === 'refused'\) \{[\s\S]*?else go\(\{ \.\.\.back, back: refusal\.trouble \}\);/u,
    );
  });
});
