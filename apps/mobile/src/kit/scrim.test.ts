import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { scrimContrast } from './scrim.ts';

describe('the card’s scrim', () => {
  it('keeps white words at 4.5:1 on every colour and on any photo', () => {
    for (const base of [
      tokens.optionRose,
      tokens.optionTeal,
      tokens.colorAccent,
      tokens.optionAmber,
    ])
      expect(scrimContrast(base, false, tokens.colorInk)).toBeGreaterThanOrEqual(4.5);
    expect(scrimContrast(tokens.colorInk, true, tokens.colorInk)).toBeGreaterThanOrEqual(4.5);
  });
});
