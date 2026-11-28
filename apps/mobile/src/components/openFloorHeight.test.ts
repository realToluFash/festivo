import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';

const night = readFileSync(join(import.meta.dirname, 'MyNightScreen.tsx'), 'utf8');
const buttons = readFileSync(join(import.meta.dirname, 'Buttons.tsx'), 'utf8');

describe('Open Floor under Check-in on a phone (sc-98893)', () => {
  it('is asked to stand tall on the phone alone', () => {
    expect(night).toMatch(/<SecondaryButton[^/]*tall=\{opens === 'floor' && !wide\}/u);
  });

  it('then stands at least 48, without stretching to the page’s width', () => {
    expect(tokens.sizeHitPhonePrimary).toBe(48);
    expect(buttons).toMatch(/tall && styles\.secondaryTall,/u);
    expect(buttons).toMatch(
      /secondaryTall: \{\n\s*minHeight: tokens\.sizeHitPhonePrimary,\n\s*borderRadius: tokens\.sizeHitPhonePrimary \/ 2,\n\s*\},/u,
    );
  });
});
