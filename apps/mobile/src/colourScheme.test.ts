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

const {
  forgetOnNewInstall,
  hearChoice,
  heardChoice,
  keepBeforeSaving,
  keepLaunchScheme,
  landingAfterRestart,
  readsMe,
  RESTART_GRACE_MS,
  restartIn,
  schemeToFollow,
} = await import('./colourScheme.ts');
const { deviceScheme, holdLanding, takeLanding } = await import('./theme/deviceScheme.ts');

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

  it('answers false, with no landing held, when the reload never came (Expo Go on Android)', async () => {
    vi.useFakeTimers();
    const reload = vi.fn(async () => {});

    let settled = false;
    const restarted = restartIn('berry', '/settings/personalisation?saved=1', reload).finally(
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(RESTART_GRACE_MS - 1);

    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toBe(true);
    expect(await restarted).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    expect(takeLanding()).toBeNull();
    vi.useRealTimers();
  });

  it('answers a restart asked for during another with that one, once the reload never came', async () => {
    vi.useFakeTimers();
    const reload = vi.fn(async () => {});

    const first = restartIn('berry', null, reload);
    const second = restartIn('garden', '/settings/personalisation?saved=1', reload);
    await vi.advanceTimersByTimeAsync(RESTART_GRACE_MS);

    expect(await second).toBe(false);
    expect(await first).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('answers false when the reload is refused', async () => {
    const reload = vi.fn(async () => {
      throw new Error('no activity');
    });

    expect(await restartIn('berry', null, reload)).toBe(false);
  });

  // Last of the restarts: once one is under way, the JS is starting again and nothing restarts twice.
  it('keeps the scheme on the device and comes back to the landing it was given', () => {
    const reload = vi.fn(() => new Promise<void>(() => {}));

    void restartIn('citrus', '/settings/personalisation?saved=1', reload);
    void restartIn('garden', null, reload);

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

  it('keeps a new pick on the device before the account hears it, and refuses one the device cannot keep', () => {
    expect(keepBeforeSaving('garden', 'violet')).toBe(true);
    expect(deviceScheme()).toBe('garden');

    keepLaunchScheme('violet');
    expect(deviceScheme()).toBe('violet');

    keeps = false;
    expect(keepBeforeSaving('sorbet', 'violet')).toBe(false);
    expect(keepBeforeSaving('violet', 'violet')).toBe(true);
  });

  it('lands nowhere but a screen path after a restart', () => {
    holdLanding('/events/42');
    expect(landingAfterRestart()).toEqual(['/events', '/events/42']);
    expect(landingAfterRestart()).toEqual([]);

    holdLanding('/');
    expect(landingAfterRestart()).toEqual([]);
    holdLanding('https://elsewhere.test');
    expect(landingAfterRestart()).toEqual([]);
  });

  it('opens Personalisation over Settings after a restart, so Back goes to Settings', () => {
    holdLanding('/settings/personalisation?saved=1');
    expect(landingAfterRestart()).toEqual(['/settings', '/settings/personalisation?saved=1']);

    holdLanding('/settings?saved=1');
    expect(landingAfterRestart()).toEqual(['/settings?saved=1']);
    holdLanding('/join/abc');
    expect(landingAfterRestart()).toEqual(['/join/abc']);
  });

  it('reads the person from GET /api/auth/me only', () => {
    expect(readsMe('https://api.test/api/auth/me')).toBe(true);
    expect(readsMe('https://api.test/api/auth/me', { method: 'PUT' })).toBe(false);
    expect(readsMe('https://api.test/api/auth/colour-scheme')).toBe(false);
  });
});
