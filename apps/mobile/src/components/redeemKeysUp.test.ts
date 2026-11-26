import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
const redeem = read('src', 'components', 'Redeem.tsx');
const demo = read('src', 'demo', 'doorCode', 'Redeem.tsx');

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

  it('still lands with Your name focused, and signed in shows no field', () => {
    expect(redeem).toMatch(/autoFocus=\{step\.typed == null\}/u);
    expect(redeem).toMatch(/\{!signedIn && \(\s*<View ref=\{nameBlock\}>/u);
    expect(redeem).toMatch(/\{!signedIn && \(\s*<View ref=\{numberBlock\}>/u);
  });
});
