import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

describe('sc-85006: the held cards name other organisations only when there are some', () => {
  it('the paused card says its other organisations are untouched only when it has others', () => {
    expect(source('AccessPaused.tsx')).toContain(
      "t(others.length > 0 ? 'accessPaused.untouched' : 'accessPaused.untouchedSingleEvents')",
    );
  });

  it('the overdue card says its other organisations are unaffected only when any are listed', () => {
    expect(source('TwoFactorOverdue.tsx')).toContain(
      "t(othersListed ? 'signInRules.overdueElsewhere' : 'signInRules.overdueSingleEvents')",
    );
  });
});
