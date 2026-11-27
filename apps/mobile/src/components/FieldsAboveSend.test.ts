import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { barFits } from '../kit/keyboard.ts';

const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
const redeem = read('src', 'components', 'Redeem.tsx');
const demo = read('src', 'demo', 'doorCode', 'Redeem.tsx');
const fields = read('src', 'components', 'FieldsAboveSend.tsx');

describe('the event step keeps Your name and the number row above Send code with the keys up (sc-97734)', () => {
  it('lifts the refusal, Your name and the number row as one group, in the product and its demo alike', () => {
    for (const source of [redeem, demo]) {
      expect(source).toMatch(/<FieldsAboveSend refs=\{blocks\} style=\{styles\.fields\}>/u);
      expect(source).toMatch(/<View ref=\{refusalBlock\}>\s*<Refused/u);
      expect(source).toMatch(/<View ref=\{nameBlock\}>\s*<InsideField/u);
      expect(source).toMatch(/<View ref=\{numberBlock\}>/u);
    }
    expect(demo).not.toMatch(/KeysUp/u);
  });

  it('keeps the landing toast covering the step, as the focused-field lift it replaces did (sc-37983)', () => {
    expect(fields).toMatch(/watchLandingToastTop\(lift\)/u);
    expect(fields).toMatch(
      /const shown = Math\.min\(\s*shownEnd\(keys, \{ y: frame\.top, height: frame\.height \}\),\s*landingToastTop\(\) \?\? Infinity,\s*\);/u,
    );
  });

  it("gives the step's dock rule the focused field's block, label and line included, never the kept tier (sc-7099)", () => {
    expect(fields).toMatch(/scroll\.focusedGroup\.forEach\(\(needs\) => needs\(dockHeight\)\)/u);
    expect(fields).not.toMatch(/needs\(kept/u);
  });

  it('undocks Send code on the SE at the largest text once the dock hears the 204pt field block (QA: field 77-281pt, foot 152pt, keys at 418pt)', () => {
    const margin = 24;
    const scrollTop = 77;
    const room = 418 - scrollTop;
    expect(barFits({ room, field: 204, bar: 152, margin })).toBe(false);
    expect(barFits({ room, field: 0, bar: 152, margin })).toBe(true);
  });

  it('still lands with Your name focused, and signed in shows no field', () => {
    expect(redeem).toMatch(/autoFocus=\{step\.typed == null\}/u);
    expect(redeem).toMatch(/\{!signedIn && \(\s*<View ref=\{nameBlock\}>/u);
    expect(redeem).toMatch(/\{!signedIn && \(\s*<View ref=\{numberBlock\}>/u);
  });
});
