import { describe, expect, it } from 'vitest';

import {
  dayAtTime,
  dayOf,
  DEVICES,
  keptByRule,
  onlyWayIn,
  qrPath,
  RECOVERY_CODES,
} from './SecuritySample.ts';

const spaced = (text: string): string => text.replace(/\s/gu, ' ');

describe('dates on Signed in on', () => {
  it('follow the region: month first in the US, day first in Britain', () => {
    const iphone = DEVICES[0]!;

    expect(spaced(dayAtTime(iphone.signedIn, 'en-US'))).toBe('Oct 12 at 9:14 AM');
    expect(spaced(dayAtTime(iphone.signedIn, 'en-GB'))).toBe('12 Oct at 9:14');
    expect(dayOf(iphone.expires, 'en-US')).toBe('Dec 4');
  });
});

describe('ways to sign in', () => {
  it('keep the only way in, and a rule keeps the last provider', () => {
    const googleOnly = { password: false, Google: true, Apple: false };
    const withPassword = { password: true, Google: true, Apple: false };

    expect(onlyWayIn(googleOnly, 'Google')).toBe(true);
    expect(onlyWayIn(withPassword, 'Google')).toBe(false);
    expect(keptByRule(withPassword, 'Google', true)).toBe(true);
    expect(keptByRule({ ...withPassword, Apple: true }, 'Google', true)).toBe(false);
    expect(keptByRule(withPassword, 'Google', false)).toBe(false);
  });
});

describe('two-factor samples', () => {
  it('show ten recovery codes from the unambiguous alphabet', () => {
    expect(RECOVERY_CODES).toHaveLength(10);
    for (const code of RECOVERY_CODES)
      expect(code).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/u);
  });

  it('draw the same QR every time', () => {
    expect(qrPath()).toBe(qrPath());
    expect(qrPath()).toContain('M0 0h7v7h-7z');
  });
});
