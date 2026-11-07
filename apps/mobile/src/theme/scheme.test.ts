import { describe, expect, it, vi } from 'vitest';

import { defaultScheme, schemes, withScheme } from './tokens.ts';

const base = withScheme(undefined);

describe('a build picks its colour scheme', () => {
  it('keeps the base for withScheme with no name, which the native shell is drawn on', () => {
    expect(base.colorAccent).toBe('#1E9A64');
  });

  it('draws violet in a build with no scheme set, or an empty one', async () => {
    expect(defaultScheme).toBe('violet');

    for (const scheme of [undefined, '']) {
      vi.resetModules();
      vi.stubEnv('EXPO_PUBLIC_SCHEME', scheme);
      const { tokens } = await import('./tokens.ts');
      expect(tokens, String(scheme)).toEqual(withScheme('violet'));
    }
    vi.unstubAllEnvs();
  });

  it('still picks any scheme the switch names', async () => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SCHEME', 'cobalt');
    const { tokens } = await import('./tokens.ts');
    expect(tokens).toEqual(withScheme('cobalt'));
    vi.unstubAllEnvs();
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
