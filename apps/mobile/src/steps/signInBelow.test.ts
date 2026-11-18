import { describe, expect, it, vi } from 'vitest';

import { pushSignIn, settleSignInBelow, signInBelowOn } from './signInBelow.ts';

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('expo-router', () => ({ router }));

describe('what is under Sign in (sc-67709)', () => {
  it('is welcome when welcome pushed it, though the stack read while drawing it is the one before the push', () => {
    pushSignIn('/sign-in');

    expect(router.push).toHaveBeenCalledWith('/sign-in');
    expect(settleSignInBelow('pushed', () => false)).toBe(true);
    expect(signInBelowOn('pushed')).toBe(true);
  });

  it('is nothing for a Sign in that replaced the only screen, as a cold soirely://sign-in opens it', () => {
    expect(settleSignInBelow('alone', () => false)).toBe(false);
    expect(signInBelowOn('alone')).toBe(false);
  });

  it('is read from the stack for a Sign in that replaced a screen above another', () => {
    expect(settleSignInBelow('replaced', () => true)).toBe(true);
  });

  it('is settled once per route, so the push is spent on the Sign in it opened', () => {
    pushSignIn('/sign-in');
    settleSignInBelow('first', () => false);

    expect(settleSignInBelow('first', () => false)).toBe(true);
    expect(settleSignInBelow('next', () => false)).toBe(false);
  });
});
