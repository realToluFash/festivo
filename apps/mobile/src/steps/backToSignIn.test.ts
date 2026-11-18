import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dropChallenge, holdChallenge } from '../challenge.ts';
import { backToSignIn } from './backToSignIn.ts';

const moves = vi.hoisted(() => [] as unknown[]);
const router = vi.hoisted(() => ({
  canGoBack: vi.fn(() => false),
  back: vi.fn(() => void moves.push('back')),
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
};

describe('back from the code step to Sign in (sc-67709)', () => {
  beforeEach(() => {
    moves.length = 0;
    dropChallenge();
  });

  it('goes back to the Sign in under it', () => {
    router.canGoBack.mockReturnValueOnce(true);
    holdChallenge(CHALLENGE);

    backToSignIn();

    expect(moves).toEqual(['back']);
  });

  it('opens Sign in over welcome when nothing is under the step, as Google from welcome leaves it', () => {
    holdChallenge(CHALLENGE);

    backToSignIn();

    expect(moves).toEqual([
      ['replace', '/welcome'],
      ['push', '/sign-in'],
    ]);
  });

  it('opens Sign in on its own when the sign-in began on a Sign in with nothing under it', () => {
    holdChallenge(CHALLENGE, true);

    backToSignIn();

    expect(moves).toEqual([['replace', '/sign-in']]);
  });
});
