import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dropChallenge, holdChallenge } from '../challenge.ts';
import { leaveTimedOutSignIn } from './leaveTimedOutSignIn.ts';
import { opensOver } from './signInOver.ts';

const moves = vi.hoisted(() => [] as unknown[]);
const router = vi.hoisted(() => ({
  canDismiss: vi.fn(() => true),
  dismissAll: vi.fn(() => void moves.push('dismissAll')),
  replace: vi.fn((to: unknown) => void moves.push(['replace', to])),
  push: vi.fn((to: unknown) => void moves.push(['push', to])),
}));

vi.mock('expo-router', () => ({ router }));
vi.mock('../accountLanguage.ts', () => ({ followAccount: async () => {} }));
vi.mock('expo-secure-store', () => ({}));

const CHALLENGE = {
  kind: 'twoFactor' as const,
  challenge: 'the-challenge',
  expiresAt: '2026-10-17T12:05:00+00:00',
  email: 'folake@ire.events',
  phone: null,
  factors: { app: true, passkeys: false },
};

const TIMED_OUT = {
  pathname: '/sign-in',
  params: { email: 'folake@ire.events', codeTimedOut: '1' },
};

describe('leaving a two-factor sign-in that ran out (sc-67606)', () => {
  beforeEach(() => {
    moves.length = 0;
    dropChallenge();
  });

  it('clears its steps and opens the timed-out Sign in over welcome', () => {
    holdChallenge(CHALLENGE);

    leaveTimedOutSignIn();

    expect(moves).toEqual(['dismissAll', ['replace', '/welcome'], ['push', TIMED_OUT]]);
    expect(opensOver('timed-out over welcome')).toBe(true);
  });

  it('opens it over welcome when the step has nothing under it, as Google from welcome leaves it', () => {
    router.canDismiss.mockReturnValueOnce(false);
    holdChallenge(CHALLENGE);

    leaveTimedOutSignIn();

    expect(moves).toEqual([
      ['replace', '/welcome'],
      ['push', TIMED_OUT],
    ]);
    expect(opensOver('timed-out over a lone welcome')).toBe(true);
  });

  it('opens it on its own when the sign-in began on a Sign in with nothing under it', () => {
    holdChallenge(CHALLENGE, { alone: true });

    leaveTimedOutSignIn();

    expect(moves).toEqual(['dismissAll', ['replace', TIMED_OUT]]);
    expect(opensOver('timed-out alone')).toBe(false);
  });
});
