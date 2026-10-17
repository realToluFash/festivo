import { describe, expect, it } from 'vitest';

import { meetsPasswordLength } from './password.ts';

describe('the password length rule', () => {
  it('is met at fifteen characters and not at fourteen', () => {
    expect(meetsPasswordLength('lagos-evening-a')).toBe(true);
    expect(meetsPasswordLength('lagos-evening-')).toBe(false);
  });

  it('counts a decomposed accent as the one character the API counts', () => {
    const decomposed = 'café-terrace-ok';

    expect(decomposed).toHaveLength(16);
    expect(meetsPasswordLength(decomposed)).toBe(true);
    expect(meetsPasswordLength('café-terrace-')).toBe(false);
  });

  it('counts an emoji as one character, not two code units', () => {
    expect(meetsPasswordLength('🔑'.repeat(14))).toBe(false);
    expect(meetsPasswordLength('🔑'.repeat(15))).toBe(true);
  });
});
