import { describe, expect, it } from 'vitest';

import { schemes, tokens, withScheme } from './tokens.ts';

describe('a build picks its colour scheme', () => {
  it('keeps the base when no scheme is set, which is every build until one is', () => {
    expect(tokens).toEqual(withScheme(undefined));
    expect(tokens.colorAccent).toBe('#1E9A64');
  });

  it("lays B Confetti's Violet over the base, and leaves the rest as it was", () => {
    const violet = withScheme('violet');

    expect(violet.colorAccentHover).toBe('#5A3DF0');
    expect(violet.colorInk).toBe('#0D0D12');
    expect(violet.colorAttention).toBe(tokens.colorAttention);
    expect(violet.spaceLg).toBe(tokens.spaceLg);
  });

  it('takes the accent into a selected border, the done mark, a taken seat and a yes', () => {
    const violet = withScheme('violet');

    expect(violet.borderSelected).toBe('2px solid #5A3DF0');
    expect(violet.marks.done.fill).toBe('#5A3DF0');
    expect(violet.marks.done.glyph).toBe(tokens.marks.done.glyph);
    expect(violet.marks.broken).toEqual(tokens.marks.broken);
    expect(violet.seatStates.taken.ring).toBe('1px solid #5A3DF0');
    expect(violet.replyStates.coming.dot).toBe('#5A3DF0');
  });

  it('keeps the base for a name that is no scheme', () => {
    expect(withScheme('green')).toEqual(withScheme(undefined));
    expect(withScheme('toString')).toEqual(withScheme(undefined));
  });

  it('knows all eight', () => {
    expect(Object.keys(schemes)).toHaveLength(8);
  });
});
