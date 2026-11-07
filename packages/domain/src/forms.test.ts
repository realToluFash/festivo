import { describe, expect, it } from 'vitest';

import { cleanCode, codeProblem, emailProblem, keyInGroups } from './forms.ts';

describe('an email checked before it is sent', () => {
  it('is there', () => {
    expect(emailProblem('')).toBe('blank');
    expect(emailProblem('   ')).toBe('blank');
  });

  it('has an @ and a domain', () => {
    expect(emailProblem('folake')).toBe('shape');
    expect(emailProblem('folake@')).toBe('shape');
    expect(emailProblem('@ire.events')).toBe('shape');
    expect(emailProblem('folake@ire')).toBe('shape');
    expect(emailProblem('fo lake@ire.events')).toBe('shape');
    expect(emailProblem(' folake@ire.events ')).toBeNull();
  });
});

describe('a code checked before it is sent', () => {
  it('is there, and six digits', () => {
    expect(codeProblem('')).toBe('blank');
    expect(codeProblem('1234')).toBe('short');
    expect(codeProblem('12345a')).toBe('short');
    expect(codeProblem('1234567')).toBe('short');
    expect(codeProblem('184231')).toBeNull();
  });

  it('loses the spaces a paste brings', () => {
    expect(cleanCode(' 184 231 ')).toBe('184231');
    expect(codeProblem('184 231')).toBeNull();
    expect(codeProblem('   ')).toBe('blank');
  });
});

describe('an authenticator key', () => {
  it('is shown in groups of four', () => {
    expect(keyInGroups('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(keyInGroups('ABCDEF')).toBe('ABCD EF');
  });
});
