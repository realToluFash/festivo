import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }));
const linking = vi.hoisted(() => ({
  canOpenURL: vi.fn<(url: string) => Promise<boolean>>(),
  openURL: vi.fn(async () => {}),
}));
const native = vi.hoisted(() => ({
  mailApp: undefined as { canOpen: () => boolean; open: () => void } | undefined,
}));

vi.mock('react-native', () => ({ Platform: platform, Linking: linking }));
vi.mock('../modules/mail-app/index.ts', () => ({
  get mailApp() {
    return native.mailApp;
  },
}));

const { mailAppOpens } = await import('./mailApp.ts');

describe('mailAppOpens', () => {
  beforeEach(() => {
    linking.canOpenURL.mockReset();
    native.mailApp = undefined;
  });

  describe('on iOS', () => {
    beforeEach(() => {
      platform.OS = 'ios';
    });

    it('asks whether Mail’s own scheme opens', async () => {
      linking.canOpenURL.mockResolvedValue(true);

      expect(await mailAppOpens()).toBe(true);
      expect(linking.canOpenURL).toHaveBeenCalledWith('message://');
    });

    it('answers false where Mail cannot open', async () => {
      linking.canOpenURL.mockResolvedValue(false);

      expect(await mailAppOpens()).toBe(false);
    });

    it('answers false when the question throws', async () => {
      linking.canOpenURL.mockRejectedValue(new Error('not allowed'));

      expect(await mailAppOpens()).toBe(false);
    });
  });

  describe('on Android', () => {
    beforeEach(() => {
      platform.OS = 'android';
    });

    it('answers what the native module says', async () => {
      native.mailApp = { canOpen: () => true, open: vi.fn() };

      expect(await mailAppOpens()).toBe(true);
    });

    it('answers false when no email app is installed', async () => {
      native.mailApp = { canOpen: () => false, open: vi.fn() };

      expect(await mailAppOpens()).toBe(false);
    });

    it('answers false on a build without the module', async () => {
      expect(await mailAppOpens()).toBe(false);
    });

    it('answers false when the module throws', async () => {
      native.mailApp = {
        canOpen: () => {
          throw new Error('package manager gone');
        },
        open: vi.fn(),
      };

      expect(await mailAppOpens()).toBe(false);
    });
  });
});
