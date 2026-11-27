import { STAFF_RULES_MAXIMUM } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { fitRules } from './briefing.ts';

describe('house rules at the limit (sc-3917)', () => {
  const full = 'a'.repeat(STAFF_RULES_MAXIMUM);

  it('does not take a key typed at the limit', () => {
    expect(fitRules(full, `${full.slice(0, 10)}b${full.slice(10)}`)).toEqual({
      text: full,
      cut: false,
    });
  });

  it('cuts a paste over a selection that lands one over, and says so', () => {
    const before = `${'a'.repeat(STAFF_RULES_MAXIMUM - 5)}bbbbb`;
    const pasted = `${'a'.repeat(STAFF_RULES_MAXIMUM - 5)}cccccc`;

    expect(fitRules(before, pasted)).toEqual({
      text: pasted.slice(0, STAFF_RULES_MAXIMUM),
      cut: true,
    });
  });
});
