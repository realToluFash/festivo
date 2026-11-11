import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { UNMEASURED_OVER_KEYS, landingToastBottom } from './landingToastBottom.ts';

describe('the landing toast on a step with a docked foot, as measured (sc-37983)', () => {
  it('rests 12pt above a two-button foot, wherever its upper button starts', () => {
    const joinOverStartMyOwn = 24 + 44 + tokens.spaceLg + 48;

    expect(landingToastBottom(24, 0, 1200, null, { footReaches: joinOverStartMyOwn })).toBe(
      joinOverStartMyOwn + tokens.spaceLg,
    );
  });

  it('rests 12pt above a Continue grown by a large text size', () => {
    expect(landingToastBottom(24, 0, 1200, null, { footReaches: 24 + 96 })).toBe(
      24 + 96 + tokens.spaceLg,
    );
  });

  it('follows the foot as the keys lift it, whatever they say of their own top', () => {
    expect(landingToastBottom(24, 0, 1200, 700, { footReaches: 580 })).toBe(580 + tokens.spaceLg);
  });

  it('keeps over the tab bar a phone leaves room for, where the foot sits under it', () => {
    expect(landingToastBottom(34, 64, 800, null, { footReaches: 34 + 52 })).toBe(
      34 + 64 + tokens.spaceLg,
    );
  });
});

describe('the landing toast on a step whose foot has moved into the page (sc-37983)', () => {
  it('sits 12pt above the keys', () => {
    expect(landingToastBottom(34, 64, 800, 500, 'footInPage')).toBe(800 - 500 + tokens.spaceLg);
  });
});

describe('the landing toast with no step foot under it (sc-29071, sc-37519)', () => {
  it('rests over the tab bar while the keys are down', () => {
    expect(landingToastBottom(34, 64, 800, null, 'noFoot')).toBe(34 + 64 + tokens.spaceLg);
  });

  it('rides over the keys as it did before feet were measured', () => {
    expect(landingToastBottom(34, 64, 800, 500, 'noFoot')).toBe(800 - 500 + UNMEASURED_OVER_KEYS);
  });

  it('rests over the inset alone on a tablet', () => {
    expect(landingToastBottom(24, 0, 1200, null, 'noFoot')).toBe(24);
  });
});
