import { beforeEach, describe, expect, it, vi } from 'vitest';

const linking = vi.hoisted(() => ({
  canOpenURL: vi.fn<(url: string) => Promise<boolean>>(),
  openURL: vi.fn<(url: string) => Promise<void>>(),
}));

vi.mock('react-native', () => ({ Linking: linking }));

const { authenticatorTakes, openInAuthenticator } = await import('./authenticatorApp.ts');

const LINK = 'otpauth://totp/Soirely:ana%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Soirely';

describe('authenticatorTakes', () => {
  beforeEach(() => {
    linking.canOpenURL.mockReset();
  });

  it('asks about the enrolment’s own link', async () => {
    linking.canOpenURL.mockResolvedValue(true);

    expect(await authenticatorTakes(LINK)).toBe(true);
    expect(linking.canOpenURL).toHaveBeenCalledWith(LINK);
  });

  it('answers false where no app takes it', async () => {
    linking.canOpenURL.mockResolvedValue(false);

    expect(await authenticatorTakes(LINK)).toBe(false);
  });

  it('answers false when the question throws', async () => {
    linking.canOpenURL.mockRejectedValue(new Error('not declared'));

    expect(await authenticatorTakes(LINK)).toBe(false);
  });
});

describe('openInAuthenticator', () => {
  beforeEach(() => {
    linking.openURL.mockReset();
  });

  it('opens the link itself', () => {
    linking.openURL.mockResolvedValue();

    openInAuthenticator(LINK);

    expect(linking.openURL).toHaveBeenCalledWith(LINK);
  });

  it('swallows an app uninstalled since the screen asked', async () => {
    linking.openURL.mockRejectedValue(new Error('no activity'));

    expect(() => openInAuthenticator(LINK)).not.toThrow();
    await Promise.resolve();
  });
});
