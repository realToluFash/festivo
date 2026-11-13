import { beforeEach, describe, expect, it, vi } from 'vitest';

const live = vi.hoisted(() => ({ verified: true as boolean | null }));
const api = vi.hoisted(() => ({
  me: vi.fn(async () => ({
    name: 'Ada',
    phoneNumbers:
      live.verified == null
        ? []
        : [
            {
              id: 'p',
              number: '+447700900123',
              countryCode: 'GB',
              primary: true,
              verified: live.verified,
              pending: false,
            },
          ],
  })),
  completeProfile: vi.fn(async () => {}),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('../api.ts', () => ({ api }));
vi.mock('expo-router', () => ({ router }));

const { skipPhone } = await import('./skipPhone.ts');

describe('skipping the mobile number', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drops a number texted after the screen loaded with none', async () => {
    live.verified = false;

    await skipPhone();

    expect(api.completeProfile).toHaveBeenCalledWith({ name: 'Ada' });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('keeps a proved number', async () => {
    live.verified = true;

    await skipPhone();

    expect(api.completeProfile).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
