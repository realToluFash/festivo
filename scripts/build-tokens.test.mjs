/**
 * The guard that makes "one source" true rather than aspirational.
 *
 * Generating the clients' tokens buys nothing if a generated file can sit on
 * disk disagreeing with its source. So: regenerate, compare, fail. A colour
 * changed in `docs/design/tokens.mjs` and not rebuilt stops CI instead of
 * reaching a screen as a stale hex.
 */
import { describe, expect, it } from 'vitest';

import { tokens } from '../docs/design/tokens.mjs';
import { NATIVE_OUT, WEB_OUT, onDisk, outputs } from './build-tokens.mjs';

describe('generated tokens', () => {
  const generated = outputs();
  const disk = onDisk();

  for (const path of [WEB_OUT, NATIVE_OUT]) {
    it(`${path} is up to date`, () => {
      expect(disk[path], `${path} is missing — run: node scripts/build-tokens.mjs`).not.toBeNull();
      expect(disk[path], `${path} has drifted — run: node scripts/build-tokens.mjs`).toBe(
        generated[path],
      );
    });
  }

  it('says it is generated, in both outputs', () => {
    for (const path of [WEB_OUT, NATIVE_OUT]) {
      expect(generated[path]).toContain('Do not edit');
    }
  });
});

describe('the CSS output', () => {
  const css = outputs()[WEB_OUT];

  it('gives a px length to spacing, sizing and radius', () => {
    expect(css).toContain('--sizeHit: 44px;');
    expect(css).toContain('--spaceSm: 8px;');
    expect(css).toContain('--radiusCardDesktop: 16px;');
  });

  it('gives milliseconds to motion, not pixels', () => {
    expect(css).toContain('--motionBase: 200ms;');
    expect(css).toContain('--toastLifetime: 10000ms;');
  });

  it('emits a type style as a font shorthand plus its own tracking', () => {
    expect(css).toContain('--typeBody: 400 14px/1.5 var(--fontFamily);');
    expect(css).toContain('--typeBodyTracking: 0;');
  });

  it('uses the mono family for the one mono style', () => {
    expect(css).toContain('--typeCode: 600 14px/1 var(--fontFamilyMono);');
  });

  it('leaves native elevation out, because a CSS variable for it would be a lie', () => {
    expect(css).not.toContain('elevationNative');
    expect(css).not.toContain('android');
  });

  it('flattens the meaning tables to one property per field', () => {
    expect(css).toContain('--markDoneFill: #1E9A64;');
    expect(css).toContain('--seatProposedRing: 1.5px dashed #B7791F;');
  });

  it('leaves a mark glyph and word out — those are content, and come from the catalogue', () => {
    expect(css).not.toContain('--markDoneGlyph');
    expect(css).not.toContain('--markDoneWord');
    expect(css).not.toContain('Not started');
  });

  it('emits no object as a value', () => {
    expect(css).not.toMatch(/--\w+: \[object Object\]/);
    expect(css).not.toContain('undefined');
  });
});

/**
 * Contrast, computed rather than claimed.
 *
 * Two of the decisions below are contrast decisions, and an assertion that
 * says "this one passes" without doing the arithmetic is just a comment. WCAG
 * relative luminance, so the reason is checkable and a future hex cannot
 * quietly undo it.
 */
function luminance(hex) {
  const channel = (c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('what the source itself asserts', () => {
  it('has one accent, and it is the green', () => {
    expect(tokens.colorAccent).toBe('#1E9A64');
  });

  it('gives milliseconds to the motion limit and pixels to the rise', () => {
    const css = outputs()[WEB_OUT];
    expect(css).toContain('--motionMax: 500ms;');
    expect(css).toContain('--motionRise: 8px;');
    expect(css).toContain('--opacityPressed: 0.85;');
  });

  it('puts every hit target at 44, desktop included', () => {
    expect(tokens.sizeHit).toBe(44);
  });

  it('carries a word beside every mark, so colour is never alone', () => {
    for (const [name, mark] of Object.entries(tokens.marks)) {
      if (name === 'info') continue; // the only one that is an affordance rather than a state
      expect(mark.word, `${name} has no word`).not.toBe('');
    }
  });

  it('computes less than 4.5:1 for the tertiary ink', () => {
    // It is why the decisions below moved information off the tertiary.
    expect(contrast(tokens.colorInkTertiary, tokens.colorCard)).toBeLessThan(4.5);
  });

  for (const surface of [
    'colorCard',
    'colorPage',
    'colorInset',
    'colorRowHover',
    'colorRowSelected',
    'colorNeutralFill',
    'colorInsetBorder',
    'colorHeader',
    'colorHeaderTrack',
    'colorAccentTint',
    'colorAttentionTint',
    'colorAttentionWash',
    'colorBrokenTint',
  ]) {
    it(`computes 4.5:1 for the secondary ink on ${surface}`, () => {
      expect(contrast(tokens.colorInkSecondary, tokens[surface])).toBeGreaterThanOrEqual(4.5);
    });
  }
});

/**
 * The four contradictions, settled under sc-80.
 *
 * Each of these held a disagreement the design flagged, or one found while
 * generating. They are tests rather than comments so that reopening one is a
 * deliberate act with a failing suite attached — which is the only thing that
 * stops the first screen built deciding them again by accident.
 */
describe('settled: the dense control is 36 tall and 44 to a finger', () => {
  it('reaches the hit minimum with its slop on both sides', () => {
    expect(tokens.sizeControlDense + 2 * tokens.hitSlopDense).toBe(tokens.sizeHit);
  });

  it('is still smaller than the hit target, which is the whole point', () => {
    // If these ever match, somebody has "fixed" the contradiction by deleting
    // the dense control rather than by giving it a target.
    expect(tokens.sizeControlDense).toBeLessThan(tokens.sizeHit);
    expect(tokens.hitSlopDense).toBeGreaterThan(0);
  });
});

describe('settled: nothing a person reads is below 12px', () => {
  const styles = Object.entries(tokens).filter(
    ([k, v]) => k.startsWith('type') && typeof v === 'object',
  );

  it('covers every type style, and there are some', () => {
    expect(styles.length).toBeGreaterThan(10);
  });

  for (const [name, style] of styles) {
    it(`${name} is at least 12`, () => {
      expect(style.size).toBeGreaterThanOrEqual(12);
    });
  }

  it('keeps the pill at 12 rather than the 11 the screens drifted to', () => {
    expect(tokens.typePill.size).toBe(12);
  });
});

describe('settled: an option colour never borrows a colour that means something', () => {
  const options = Object.entries(tokens).filter(
    ([k]) => k.startsWith('option') && k !== 'optionNone',
  );
  // optionNone is excepted deliberately: it shares colorTrack, both mean
  // absence, and absence is not a meaning that can be confused with a state.
  const meaning = ['colorAccent', 'colorAccentHover', 'colorAttention', 'colorBroken'];

  it('has options to check', () => {
    expect(options.length).toBeGreaterThanOrEqual(5);
  });

  for (const [name, value] of options) {
    it(`${name} is not a meaning colour`, () => {
      for (const key of meaning) {
        expect(value, `${name} is ${key}`).not.toBe(tokens[key]);
      }
    });
  }

  it('keeps every option distinguishable from every other', () => {
    const values = options.map(([, v]) => v);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('settled: the reply states are told apart by shape, not by shades of grey', () => {
  const { coming, maybe, notComing, held, noReply } = tokens.replyStates;

  it('uses one grey, and it is one that passes contrast', () => {
    expect(contrast(notComing.dot, tokens.colorCard)).toBeGreaterThanOrEqual(4.5);
    expect(noReply.ring).toContain(notComing.dot);
    expect(held.ring).toContain(notComing.dot);
  });

  it('puts no information on the tertiary ink', () => {
    for (const state of Object.values(tokens.replyStates)) {
      expect(state.dot).not.toBe(tokens.colorInkTertiary);
      expect(state.ring).not.toContain(tokens.colorInkTertiary);
    }
  });

  it('gives each of the three not-yes states a different shape', () => {
    // Solid, half, and an empty ring. This is what survives the greyscale
    // print the kitchen makes, where all three greys would be one grey.
    const shapes = [notComing.dot, held.dot, noReply.dot];
    expect(new Set(shapes).size).toBe(3);
  });

  it('still separates yes and maybe by colour, because those two are the question', () => {
    expect(coming.dot).toBe(tokens.colorAccent);
    expect(maybe.ring).toContain(tokens.colorAttention);
  });

  it('names all five', () => {
    const words = Object.values(tokens.replyStates).map((s) => s.word);
    expect(words).toEqual(['Coming', 'Maybe', 'Not coming', 'Held', 'No reply']);
  });
});

describe('settled: a white label sits on a green it can be read on', () => {
  it('fills the primary button with the hover green, 4.5:1 under white', () => {
    expect(tokens.colorAccentHover).toBe('#178556');
    expect(contrast(tokens.colorInkOnDark, tokens.colorAccentHover)).toBeGreaterThanOrEqual(4.5);
  });

  it('hovers one step darker on the web', () => {
    expect(tokens.colorPrimaryHover).toBe('#176B47');
    expect(contrast(tokens.colorInkOnDark, tokens.colorPrimaryHover)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the accent where no label sits, because under one it fails', () => {
    expect(contrast(tokens.colorInkOnDark, tokens.colorAccent)).toBeLessThan(4.5);
    expect(contrast(tokens.colorAccent, tokens.colorCard)).toBeGreaterThanOrEqual(3);
  });
});

describe('settled: a text field shows where to type', () => {
  for (const surface of ['colorCard', 'colorPage', 'colorHeader']) {
    it(`draws its edge at 3:1 on ${surface}, at rest and on an error`, () => {
      expect(contrast(tokens.colorFieldBorder, tokens[surface])).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens.colorBroken, tokens[surface])).toBeGreaterThanOrEqual(3);
    });
  }

  it('names its colour in its border', () => {
    expect(tokens.borderField).toBe(`1px solid ${tokens.colorFieldBorder}`);
  });

  it('leaves the edge a word identifies as it was', () => {
    expect(tokens.colorControlBorder).toBe('#D9DCE2');
    expect(contrast(tokens.colorControlBorder, tokens.colorCard)).toBeLessThan(3);
  });
});

describe('settled: Paused has a pair of its own', () => {
  it('reads at 4.5:1 on its chip', () => {
    expect(tokens.colorPausedText).toBe('#1F4E8C');
    expect(tokens.colorPausedTint).toBe('#E9F0F9');
    expect(contrast(tokens.colorPausedText, tokens.colorPausedTint)).toBeGreaterThanOrEqual(4.5);
  });

  it('is not amber, which Happening now keeps', () => {
    expect(tokens.colorPausedText).not.toBe(tokens.colorAttentionText);
    expect(tokens.colorPausedTint).not.toBe(tokens.colorAttentionTint);
  });
});

describe('settled: motion is short, and both clients use it', () => {
  it("keeps the extraction's durations and easing", () => {
    expect([tokens.motionFast, tokens.motionBase, tokens.motionSlow]).toEqual([120, 200, 320]);
    expect(tokens.motionEase).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });

  it('lasts no longer than 500 ms, so it never makes somebody wait', () => {
    expect(tokens.motionMax).toBe(500);
    for (const key of ['motionFast', 'motionBase', 'motionSlow']) {
      expect(tokens[key]).toBeLessThanOrEqual(tokens.motionMax);
    }
  });

  it('rises 8px and presses to 85%', () => {
    expect(tokens.motionRise).toBe(8);
    expect(tokens.opacityPressed).toBe(0.85);
  });
});
