import { describe, expect, it } from 'vitest';

import { schemes, withScheme } from './tokens.ts';

const base = withScheme(undefined);

describe('a build picks its colour scheme', () => {
  it('keeps the base when no scheme is set, which is every build until one is', () => {
    expect(base.colorAccent).toBe('#1E9A64');
  });

  it("lays B Confetti's Violet over the base, and leaves the rest as it was", () => {
    const violet = withScheme('violet');

    expect(violet.colorAccentHover).toBe('#5A3DF0');
    expect(violet.colorInk).toBe('#0D0D12');
    expect(violet.colorAttention).toBe(base.colorAttention);
    expect(violet.spaceLg).toBe(base.spaceLg);
    expect(violet.typeBody).toEqual(base.typeBody);
    expect(violet.elevationNative).toEqual(base.elevationNative);
  });

  it('takes the accent into a selected border, the done mark, a taken seat and a yes', () => {
    const violet = withScheme('violet');

    expect(violet.borderSelected).toBe('2px solid #5A3DF0');
    expect(violet.marks.done.fill).toBe('#5A3DF0');
    expect(violet.marks.done.glyph).toBe(base.marks.done.glyph);
    expect(violet.seatStates.taken.ring).toBe('1px solid #5A3DF0');
    expect(violet.replyStates.coming.dot).toBe('#5A3DF0');
  });

  it('draws a broken mark and an allergy in the same red as the broken chip beside them', () => {
    const violet = withScheme('violet');

    expect(violet.marks.broken.ring).toBe(violet.colorBroken);
    expect(violet.marks.broken.glyph).toBe(base.marks.broken.glyph);
    expect(violet.borderAllergy).toBe(`1.5px solid ${violet.colorBroken}`);
  });

  it("keeps citrus's done mark orange though its accent is the base broken red", () => {
    const citrus = withScheme('citrus');

    expect(citrus.marks.done.fill).toBe(citrus.colorAccent);
    expect(citrus.marks.broken.ring).toBe(citrus.colorBroken);
  });

  it('keeps the base for a name that is no scheme', () => {
    expect(withScheme('green')).toEqual(withScheme(undefined));
    expect(withScheme('toString')).toEqual(withScheme(undefined));
  });

  it('knows all eight', () => {
    expect(Object.keys(schemes)).toHaveLength(8);
  });
});
