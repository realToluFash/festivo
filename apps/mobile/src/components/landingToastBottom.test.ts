import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { FOOT_OVER_KEYS, landingToastBottom } from './landingToastBottom.ts';

describe('the landing toast over a step still owed (sc-29071)', () => {
  it('rests over the tab bar while the keys are down', () => {
    expect(landingToastBottom(34, 64, 800, null)).toBe(34 + 64 + tokens.spaceLg);
  });

  it('keeps its lower edge above Continue, docked on the keys, once they rise', () => {
    const keyboardTop = 500;
    const continueTop = 800 - keyboardTop + FOOT_OVER_KEYS;

    expect(landingToastBottom(34, 64, 800, keyboardTop)).toBe(continueTop + tokens.spaceLg);
  });

  it('clears the docked foot off a phone too', () => {
    expect(landingToastBottom(20, 0, 1000, 600)).toBeGreaterThan(1000 - 600 + FOOT_OVER_KEYS);
  });
});
