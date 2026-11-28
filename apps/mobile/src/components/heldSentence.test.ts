import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

describe('sc-85645: the held cards name other organisations only when one is not overdue', () => {
  it('the paused card says its other organisations are untouched only when one is not overdue', () => {
    expect(source('AccessPaused.tsx')).toContain(
      'const othersUnaffected = useAnyNotOverdue(others);',
    );
  });

  it('the overdue card says its other organisations are unaffected only when one is', () => {
    expect(source('TwoFactorOverdue.tsx')).toContain(
      "t(othersUnaffected ? 'signInRules.overdueElsewhere' : 'signInRules.overdueSingleEvents')",
    );
    expect(source('TwoFactorOverdue.tsx')).toContain(
      'const othersUnaffected = useAnyNotOverdue(others);',
    );
  });
});

describe('sc-85645: the frame tells the overdue card whether another organisation is not overdue', () => {
  it('counts the listed organisations besides the one in use whose deadline has not passed', () => {
    expect(source('AppFrame.tsx')).toMatch(/others=\{signedIn\.organisations\.filter\(/);
  });
});
