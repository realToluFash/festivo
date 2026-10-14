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
    expect(css).toContain('--typeMonoTime: 600 14px/1 var(--fontFamilyMono);');
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

describe('what the source itself asserts', () => {
  it('has one accent, and it is the green', () => {
    expect(tokens.colorAccent).toBe('#1E9A64');
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

  it('keeps Held distinguishable from No reply by more than colour', () => {
    const { held, noReply } = tokens.replyStates;
    expect(held.word).not.toBe(noReply.word);
    expect(held.dot).not.toBe(noReply.dot);
    expect(held.ring).not.toBe(noReply.ring);
  });

  it('still carries the one token that contradicts the 44 rule, unresolved', () => {
    // Not a bug in the generator: the design context flags it itself, and
    // sc-80 owes a decision. Asserted so that deleting or changing it is a
    // deliberate act with a failing test attached, rather than a quiet edit.
    expect(tokens.sizeControlDense).toBe(36);
    expect(tokens.sizeControlDense).toBeLessThan(tokens.sizeHit);
  });
});
