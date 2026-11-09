import { beforeEach, describe, expect, it, vi } from 'vitest';

const kept = new Map<string, string>();
let keeps = true;

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItem: (key: string) => kept.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (keeps) kept.set(key, value);
  },
}));
vi.mock('expo', () => ({ reloadAppAsync: async () => {} }));

const { forgetOnNewInstall, hearChoice, heardChoice, readsMe, restartIn, schemeToFollow } =
  await import('./colourScheme.ts');
const { deviceScheme, takeLanding } = await import('./theme/deviceScheme.ts');

beforeEach(() => {
  kept.clear();
  keeps = true;
});

describe("the app follows the account's colours (sc-30441)", () => {
  it('restarts only when the screens are in other colours than the choice', () => {
    expect(schemeToFollow('garden', 'violet')).toBe('garden');
    expect(schemeToFollow('garden', 'garden')).toBeNull();
    expect(schemeToFollow(null, 'violet')).toBeNull();
    expect(schemeToFollow(null, 'berry')).toBe('violet');
  });

  it('restarts nothing on a device that cannot keep the scheme', async () => {
    keeps = false;
    const reload = vi.fn(async () => {});

    expect(await restartIn('sorbet', null, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  // Last of the restarts: once one is under way, the JS is starting again and nothing restarts twice.
  it('keeps the scheme on the device and comes back to the landing it was given', async () => {
    const reload = vi.fn(async () => {});

    expect(await restartIn('citrus', '/settings/personalisation?saved=1', reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(deviceScheme()).toBe('citrus');
    expect(takeLanding()).toBe('/settings/personalisation?saved=1');
    expect(takeLanding()).toBeNull();
  });

  it('holds what the account answered, and keeps a scheme already on screen without a restart', () => {
    const reload = vi.fn(async () => {});

    hearChoice('cobalt', 'cobalt', reload);

    expect(heardChoice()).toBe('cobalt');
    expect(deviceScheme()).toBe('cobalt');
    expect(reload).not.toHaveBeenCalled();
  });

  it('ignores a value that is not a scheme', () => {
    hearChoice('cobalt', 'cobalt', async () => {});
    hearChoice('teal', 'cobalt', async () => {});

    expect(heardChoice()).toBe('cobalt');
  });

  it('forgets the colours kept from before an uninstall, and starts again in the default', async () => {
    kept.set('soirely.colourScheme', 'berry');
    kept.set('soirely.landingAfterRestart', '/settings/personalisation?saved=1');
    const reload = vi.fn(async () => {});

    await forgetOnNewInstall(true, 'berry', reload);

    expect(deviceScheme()).toBeNull();
    expect(takeLanding()).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps the colours on a launch that is not the install's first", async () => {
    kept.set('soirely.colourScheme', 'berry');
    const reload = vi.fn(async () => {});

    await forgetOnNewInstall(false, 'berry', reload);

    expect(deviceScheme()).toBe('berry');
    expect(reload).not.toHaveBeenCalled();
  });

  it('restarts nothing on a new install that opened in the default, or that cannot forget', async () => {
    const reload = vi.fn(async () => {});
    await forgetOnNewInstall(true, null, reload);

    kept.set('soirely.colourScheme', 'berry');
    keeps = false;
    await forgetOnNewInstall(true, 'berry', reload);

    expect(reload).not.toHaveBeenCalled();
  });

  it('reads the person from GET /api/auth/me only', () => {
    expect(readsMe('https://api.test/api/auth/me')).toBe(true);
    expect(readsMe('https://api.test/api/auth/me', { method: 'PUT' })).toBe(false);
    expect(readsMe('https://api.test/api/auth/colour-scheme')).toBe(false);
  });
});
