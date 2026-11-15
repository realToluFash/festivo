import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  keyboard: {
    isVisible: vi.fn(() => false),
    metrics: vi.fn(() => undefined),
    addListener: vi.fn(() => ({ remove: () => {} })),
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Keyboard: native.keyboard,
  codegenNativeCommands: () => ({}),
}));

const { followIntoView } = await import('./intoView.ts');

const FIELD_Y = 900;

function scrollView() {
  const scrollTo = vi.fn();
  const scrolled = new Set<(y: number) => void>();
  const content = {};
  const scroll = {
    ref: {
      current: {
        getInnerViewRef: () => content,
        getNativeScrollRef: () => ({
          measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) =>
            done(0, 0, 400, 600),
        }),
        scrollTo,
      },
    },
    resized: new Set<() => void>(),
    offset: { current: 0 },
    origin: { current: 0 },
    scrolled,
  };
  const field = {
    measureLayout: (
      _in: unknown,
      done: (x: number, y: number, w: number, h: number) => void,
    ): void => done(0, FIELD_Y, 400, 80),
  };

  return { scroll, field, scrollTo, scrolled };
}

describe('a refused field brought into view under a screen reader jumps (sc-43907)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scrolls at once and moves on as the scroll is asked, not as it lands', () => {
    const { scroll, field, scrollTo } = scrollView();
    const inView = vi.fn(() => {
      expect(scrollTo).toHaveBeenCalledOnce();
    });

    const stop = followIntoView(scroll as never, () => field as never, { inView, jump: true });

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ animated: false }));
    expect(inView).toHaveBeenCalledOnce();
    stop();
  });

  it('glides, and moves on only once the scroll has landed, with no screen reader', () => {
    const { scroll, field, scrollTo, scrolled } = scrollView();
    const inView = vi.fn();

    const stop = followIntoView(scroll as never, () => field as never, { inView });

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ animated: true }));
    expect(inView).not.toHaveBeenCalled();
    const { y } = scrollTo.mock.calls[0]![0] as { y: number };
    scrolled.forEach((landed) => landed(y));
    expect(inView).toHaveBeenCalledOnce();
    stop();
  });
});
