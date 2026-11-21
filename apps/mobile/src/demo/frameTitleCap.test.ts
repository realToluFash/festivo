import { describe, expect, it } from 'vitest';

import { frameTitleCap } from './frameTitleCap.ts';

const PHONE = 402;
const IPAD = 820;

describe('frameTitleCap', () => {
  it('is 38 at AX1 and 43 from AX2, on the phone and the iPad', () => {
    expect(frameTitleCap(false, PHONE, 1.786)).toBe(38);
    expect(frameTitleCap(true, IPAD, 1.786)).toBe(38);
    expect(frameTitleCap(false, PHONE, 2.143)).toBe(43);
    expect(frameTitleCap(true, IPAD, 3.571)).toBe(43);
  });

  it('caps nothing a row draws at the default size', () => {
    expect(frameTitleCap(false, PHONE, 1)).toBe(34);
  });
});
