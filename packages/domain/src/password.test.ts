import { describe, expect, it } from 'vitest';

import { meetsPasswordLength } from './password.ts';

describe('the password length rule', () => {
  it('is met at twelve characters and not at eleven', () => {
    expect(meetsPasswordLength('lagos-evenin')).toBe(true);
    expect(meetsPasswordLength('lagos-eveni')).toBe(false);
  });

  it('counts a decomposed accent as the one character the API counts', () => {
    const decomposed = 'café-terrace';

    expect(decomposed).toHaveLength(13);
    expect(meetsPasswordLength(decomposed)).toBe(true);
    expect(meetsPasswordLength('café-terra')).toBe(false);
  });

  it('counts an emoji as one character, not two code units', () => {
    expect(meetsPasswordLength('🔑'.repeat(11))).toBe(false);
    expect(meetsPasswordLength('🔑'.repeat(12))).toBe(true);
  });
});
