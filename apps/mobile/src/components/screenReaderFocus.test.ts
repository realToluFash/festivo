import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: { OS: 'android' },
  sendAccessibilityEvent: vi.fn(),
  setAccessibilityFocus: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: native.platform,
  AccessibilityInfo: {
    sendAccessibilityEvent: native.sendAccessibilityEvent,
    setAccessibilityFocus: native.setAccessibilityFocus,
  },
  findNodeHandle: () => 7,
}));

const { moveScreenReaderFocus } = await import('./screenReaderFocus.ts');

type Target = Parameters<typeof moveScreenReaderFocus>[0];
const view = (isConnected: boolean) => ({ isConnected }) as unknown as Target;

describe('a focus move on a view that has gone does nothing (sc-87242)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('on android, a mounted view takes a hover, not a focus', () => {
    native.platform.OS = 'android';
    const target = view(true);
    moveScreenReaderFocus(target);
    expect(native.sendAccessibilityEvent).toHaveBeenCalledExactlyOnceWith(target, 'viewHoverEnter');
    expect(native.setAccessibilityFocus).not.toHaveBeenCalled();
  });

  it('on ios, a mounted view takes a focus, not a hover', () => {
    native.platform.OS = 'ios';
    moveScreenReaderFocus(view(true));
    expect(native.setAccessibilityFocus).toHaveBeenCalledExactlyOnceWith(7);
    expect(native.sendAccessibilityEvent).not.toHaveBeenCalled();
  });

  it.each(['android', 'ios'])('on %s, an unmounted view is left alone', (os) => {
    native.platform.OS = os;
    moveScreenReaderFocus(view(false));
    expect(native.sendAccessibilityEvent).not.toHaveBeenCalled();
    expect(native.setAccessibilityFocus).not.toHaveBeenCalled();
  });
});
