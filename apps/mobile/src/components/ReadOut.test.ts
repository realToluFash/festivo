import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TALKBACK_SETTLE_MS } from '../kit/readOut.ts';

const native = vi.hoisted(() => ({
  hidden: new Set<() => void>(),
  keyboard: {
    isVisible: vi.fn(() => false),
    addListener: vi.fn((_event: string, listener: () => void) => {
      native.hidden.add(listener);
      return { remove: () => native.hidden.delete(listener) };
    }),
  },
  announce: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Keyboard: native.keyboard,
  AccessibilityInfo: { announceForAccessibility: native.announce },
  View: () => null,
  codegenNativeCommands: () => ({}),
}));

const { readOut } = await import('./ReadOut.tsx');

describe('words handed over as the keys go down wait for them on Android (sc-43907)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    native.announce.mockClear();
    native.hidden.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says them a settle after keys that close late have gone', () => {
    native.keyboard.isVisible.mockReturnValue(true);
    readOut('3 fields need fixing, so nothing was sent.', { afterKeysDown: true });

    vi.advanceTimersByTime(1500);
    expect(native.announce).not.toHaveBeenCalled();
    native.keyboard.isVisible.mockReturnValue(false);
    native.hidden.forEach((hidden) => hidden());
    vi.advanceTimersByTime(TALKBACK_SETTLE_MS - 1);
    expect(native.announce).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(native.announce).toHaveBeenCalledOnce();
  });

  it('says them after the settle with the keys already down', () => {
    native.keyboard.isVisible.mockReturnValue(false);
    readOut('3 fields need fixing, so nothing was sent.', { afterKeysDown: true });

    vi.advanceTimersByTime(TALKBACK_SETTLE_MS);
    expect(native.announce).toHaveBeenCalledOnce();
  });

  it('says them after the settle with the keys staying up on a typed field', () => {
    native.keyboard.isVisible.mockReturnValue(true);
    readOut('1 field needs fixing, so nothing was sent.', { afterKeysDown: false });

    vi.advanceTimersByTime(TALKBACK_SETTLE_MS - 1);
    expect(native.announce).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(native.announce).toHaveBeenCalledOnce();
  });
});
