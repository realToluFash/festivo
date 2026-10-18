import { describe, expect, it } from 'vitest';

import { recoveryFirstStep, recoveryIntroKey } from './recovery.ts';

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

describe('the sentence under an answered request’s heading', () => {
  it('names the organisations while somebody is left to answer', () => {
    expect(recoveryIntroKey('waiting', false)).toBe('lostTwoFactor.waitingIntro');
    expect(recoveryIntroKey('approved', false)).toBe('lostTwoFactor.approvedIntro');
    expect(recoveryIntroKey('turned_down', false)).toBe('lostTwoFactor.turnedDownIntro');
  });

  it('names none once nobody is left, so no slot is ever empty', () => {
    expect(recoveryIntroKey('waiting', true)).toBe('lostTwoFactor.nobodyIntro');
    expect(recoveryIntroKey('approved', true)).toBe('lostTwoFactor.approvedIntroNobody');
    expect(recoveryIntroKey('turned_down', true)).toBe('lostTwoFactor.nobodyIntro');
  });
});
