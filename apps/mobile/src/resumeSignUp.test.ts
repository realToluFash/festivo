import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { resumeSignUp } from './resumeSignUp.ts';

const PENDING = { registration: 'the-handle', email: 'folake@ire.events' };
const OPEN = { cooldownSeconds: 0, codeState: 'live' as const };

function expired(): ApiError {
  const problem = {
    type: 'https://soirely.com/errors/registration_expired',
    title: 'No.',
    status: 410,
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status: 410 }));
}

describe('opening the app mid-sign-up', () => {
  it('goes back to the code for a sign-up still open', async () => {
    const asked: string[] = [];

    await expect(
      resumeSignUp({
        held: async () => PENDING,
        open: async (registration) => {
          asked.push(registration);
          return OPEN;
        },
        drop: async () => {},
      }),
    ).resolves.toBe('/verify-email');
    expect(asked).toEqual(['the-handle']);
  });

  it('clears a sign-up that has run out, and opens signed out', async () => {
    let dropped = false;

    await expect(
      resumeSignUp({
        held: async () => PENDING,
        open: async () => {
          throw expired();
        },
        drop: async () => {
          dropped = true;
        },
      }),
    ).resolves.toBeNull();
    expect(dropped).toBe(true);
  });

  it('does nothing when no sign-up is waiting', async () => {
    await expect(
      resumeSignUp({ held: async () => null, open: async () => OPEN, drop: async () => {} }),
    ).resolves.toBeNull();
  });
});
