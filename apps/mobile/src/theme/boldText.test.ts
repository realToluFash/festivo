import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (on: boolean) => void;

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }));
const ios = vi.hoisted(() => ({ on: false, listeners: [] as Listener[] }));
const android = vi.hoisted(() => ({
  on: false,
  listeners: [] as ((event: { on: boolean }) => void)[],
}));

vi.mock('react', () => ({ useSyncExternalStore: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: platform,
  AccessibilityInfo: {
    isBoldTextEnabled: async () => ios.on,
    addEventListener: (_event: string, listener: Listener) => ios.listeners.push(listener),
  },
}));
vi.mock('../../modules/bold-text/index.ts', () => ({
  boldTextModule: {
    isOn: () => android.on,
    addListener: (_event: string, listener: (event: { on: boolean }) => void) =>
      android.listeners.push(listener),
  },
}));

async function freshStore() {
  vi.resetModules();

  return import('./boldText.ts');
}

describe("the phone's Bold text", () => {
  beforeEach(() => {
    ios.on = false;
    ios.listeners = [];
    android.on = false;
    android.listeners = [];
  });

  it('is read on the iPhone before the first screen, and followed as it changes', async () => {
    platform.OS = 'ios';
    ios.on = true;
    const store = await freshStore();

    await store.loadBoldText();
    expect(store.boldTextOn()).toBe(true);

    for (const listener of ios.listeners) listener(false);
    expect(store.boldTextOn()).toBe(false);
  });

  it('is read on Android from the app, and followed as it changes', async () => {
    platform.OS = 'android';
    android.on = true;
    const store = await freshStore();

    await store.loadBoldText();
    expect(store.boldTextOn()).toBe(true);

    for (const listener of android.listeners) listener({ on: false });
    expect(store.boldTextOn()).toBe(false);
  });

  it("gives way to the design demo's switch while it is held, then comes back", async () => {
    platform.OS = 'ios';
    const store = await freshStore();
    await store.loadBoldText();

    store.holdBoldText(true);
    expect(store.boldTextOn()).toBe(true);

    store.holdBoldText(null);
    expect(store.boldTextOn()).toBe(false);
  });

  it('listens once, however often it is read', async () => {
    platform.OS = 'ios';
    const store = await freshStore();

    await store.loadBoldText();
    await store.loadBoldText();
    expect(ios.listeners).toHaveLength(1);
  });
});
