import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import {
  UNMEASURED_OVER_KEYS,
  landingToastBottom,
  stepsAside,
  underToast,
} from './landingToastBottom.ts';

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

  it('rests 12pt above a one-button foot on a phone, the step covering its tab bar', () => {
    expect(landingToastBottom(34, 64, 800, null, { footReaches: 34 + 48 })).toBe(
      34 + 48 + tokens.spaceLg,
    );
  });
});

describe('the landing toast on a step whose foot has moved into the page (sc-37983)', () => {
  it('sits 12pt above the keys', () => {
    expect(landingToastBottom(34, 64, 800, 500, 'footInPage')).toBe(800 - 500 + tokens.spaceLg);
  });

  it('sits 12pt above low keys on a phone, the step covering its tab bar', () => {
    expect(landingToastBottom(34, 64, 800, 740, 'footInPage')).toBe(800 - 740 + tokens.spaceLg);
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

describe('what a landed step puts under the toast, read against its frame (sc-37983)', () => {
  it('is no foot while no step has landed, or its foot is not yet placed', () => {
    expect(underToast(null, { y: 0, height: 800 })).toBe('noFoot');
    expect(underToast({ id: 1, foot: null }, { y: 0, height: 800 })).toBe('noFoot');
  });

  it('is a foot in the page while the foot has moved off the bottom', () => {
    expect(
      underToast({ id: 1, foot: { x: 24, width: 320, top: null } }, { y: 0, height: 800 }),
    ).toBe('footInPage');
  });

  it('reaches from the bottom of a frame starting below a status bar up to the docked foot top', () => {
    expect(
      underToast({ id: 1, foot: { x: 24, width: 320, top: 700 } }, { y: 24, height: 776 }),
    ).toEqual({ footReaches: 100 });
  });
});

describe('the landing toast stepping aside for the focused field (sc-37983)', () => {
  const organisationName = { top: 70, height: 76 };

  it('steps aside on a phone on its side, where the field and the toast do not both fit above the keys', () => {
    const toastTop = 411 - 190 - tokens.spaceLg - 68;

    expect(stepsAside(221, organisationName, toastTop)).toBe(true);
  });

  it('stays where the field fits whole 12pt above it', () => {
    const toastTop = 70 + tokens.spaceLg + 76 + tokens.spaceLg;

    expect(stepsAside(500, organisationName, toastTop)).toBe(false);
    expect(stepsAside(500, organisationName, toastTop - 1)).toBe(true);
  });

  it('shows with the keys down, or with no field to keep in sight', () => {
    expect(stepsAside(null, organisationName, 0)).toBe(false);
    expect(stepsAside(221, null, 0)).toBe(false);
  });

  it('does not step aside before it has been placed', () => {
    expect(stepsAside(221, organisationName, null)).toBe(false);
  });
});
