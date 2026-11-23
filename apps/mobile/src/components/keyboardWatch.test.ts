import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: { endCoordinates: { screenY: number } }) => void;

const native = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();

  return {
    listeners,
    keyboard: {
      isVisible: vi.fn(() => false),
      metrics: vi.fn(() => undefined),
      addListener: vi.fn((name: string, listener: Listener) => {
        const named = listeners.get(name) ?? new Set<Listener>();
        named.add(listener);
        listeners.set(name, named);

        return { remove: () => named.delete(listener) };
      }),
    },
  };
});

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Keyboard: native.keyboard,
  codegenNativeCommands: () => ({}),
}));

const { watchKeyboardTop } = await import('./keyboardWatch.ts');

const SHEET_FOOT = 812;
const KEYS_TOP = 648;
const BAR_TOP = 950.5;

function send(name: string, screenY = 0): void {
  native.listeners.get(name)?.forEach((listener) => listener({ endCoordinates: { screenY } }));
}

function cover(top: number | null): number {
  return top == null ? 0 : Math.max(0, SHEET_FOOT - top);
}

describe('watchKeyboardTop on an iPad (sc-67886)', () => {
  beforeEach(() => {
    native.listeners.clear();
    native.keyboard.isVisible.mockReturnValue(false);
  });

  it('follows the hide key down to the bar, so the keys cover nothing', () => {
    const changed = vi.fn<(top: number | null) => void>();
    watchKeyboardTop(() => 0, changed);

    send('keyboardDidShow', KEYS_TOP);
    expect(cover(changed.mock.lastCall![0])).toBe(164);

    send('keyboardDidChangeFrame', BAR_TOP);
    expect(changed).toHaveBeenLastCalledWith(BAR_TOP);
    expect(cover(changed.mock.lastCall![0])).toBe(0);
  });

  it('calls nothing for a frame change while the keys are down', () => {
    const changed = vi.fn<(top: number | null) => void>();
    watchKeyboardTop(() => 0, changed);

    send('keyboardDidChangeFrame', KEYS_TOP);
    expect(changed).not.toHaveBeenCalled();

    send('keyboardDidShow', KEYS_TOP);
    send('keyboardDidHide');
    changed.mockClear();
    send('keyboardDidChangeFrame', BAR_TOP);
    expect(changed).not.toHaveBeenCalled();
  });

  it('stops hearing frame changes once unsubscribed', () => {
    const changed = vi.fn<(top: number | null) => void>();
    const unwatch = watchKeyboardTop(() => 0, changed);

    send('keyboardDidShow', KEYS_TOP);
    unwatch();
    changed.mockClear();
    send('keyboardDidChangeFrame', BAR_TOP);
    expect(changed).not.toHaveBeenCalled();
  });
});
