import { describe, expect, it } from 'vitest';

import { recoveryFirstStep } from './recovery.ts';

describe('where the lost-two-factor screen starts', () => {
  it('asks for the signed-in person’s own request, never showing one held for somebody else', () => {
    expect(recoveryFirstStep('challenge-for-req1', 'handle-for-req3')).toBe('opening');
    expect(recoveryFirstStep('challenge', null)).toBe('opening');
  });

  it('resumes a held request only on a relaunch with no sign-in in hand', () => {
    expect(recoveryFirstStep(null, 'handle')).toBe('held');
    expect(recoveryFirstStep(null, null)).toBe('signIn');
  });
});
