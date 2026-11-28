import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const holdsSession = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock('expo-router', () => ({ router }));
vi.mock('./tokens.ts', () => ({ holdsSession }));

const { closeReset } = await import('./closeReset.ts');

async function closed(): Promise<unknown> {
  closeReset();
  await vi.waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));

  return router.replace.mock.calls[0]?.[0];
}

describe('closeReset', () => {
  beforeEach(() => {
    router.replace.mockReset();
    holdsSession.mockReset();
  });

  it('goes back to the signed-in app on a device that is signed in', async () => {
    holdsSession.mockResolvedValue(true);

    expect(await closed()).toBe('/');
  });

  it('goes to sign-in on a device that is signed out', async () => {
    holdsSession.mockResolvedValue(false);

    expect(await closed()).toBe('/sign-in');
  });

  it('goes to sign-in when the keystore refuses to answer', async () => {
    holdsSession.mockRejectedValue(new Error('keystore locked'));

    expect(await closed()).toBe('/sign-in');
  });
});
