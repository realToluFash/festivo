import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { FOOT_OVER_KEYS, footAtRest, landingToastBottom } from './landingToastBottom.ts';

describe('the landing toast over a step still owed (sc-29071)', () => {
  it('rests over the tab bar while the keys are down', () => {
    expect(landingToastBottom(34, 64, 800, null, true)).toBe(34 + 64 + tokens.spaceLg);
  });

  it('keeps its lower edge above Continue, docked on the keys, once they rise', () => {
    const keyboardTop = 500;
    const continueTop = 800 - keyboardTop + FOOT_OVER_KEYS;

    expect(landingToastBottom(34, 64, 800, keyboardTop, true)).toBe(continueTop + tokens.spaceLg);
  });

  it('clears the docked foot off a phone too', () => {
    expect(landingToastBottom(20, 0, 1000, 600, true)).toBeGreaterThan(1000 - 600 + FOOT_OVER_KEYS);
  });
});

describe('the landing toast on a tablet, with no tab bar (sc-37519)', () => {
  it('sits above Continue, docked at the foot, while the keys are down', () => {
    expect(landingToastBottom(24, 0, 1200, null, true)).toBe(footAtRest(24) + tokens.spaceLg);
    expect(landingToastBottom(24, 0, 1200, null, true)).toBeGreaterThan(
      24 + tokens.sizeHitPhoneHero,
    );
  });

  it('keeps above Continue with no inset at all', () => {
    expect(landingToastBottom(0, 0, 1200, null, true)).toBe(
      tokens.spaceLg + tokens.sizeHitPhoneHero + tokens.spaceLg,
    );
  });

  it('rests over the inset alone on Home, where nothing is docked', () => {
    expect(landingToastBottom(24, 0, 1200, null, false)).toBe(24);
  });
});
