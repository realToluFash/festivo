import { describe, expect, it, vi } from 'vitest';

const listeners = vi.hoisted(() => new Set<() => boolean>());
vi.mock('react-native', () => ({
  BackHandler: {
    addEventListener: (_: string, listener: () => boolean) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  },
}));

const { SECOND_DELIVERY_MS, holdBack, pickerTookBack } = await import('./earlyBack.ts');
vi.useFakeTimers();

describe('an early Back goes to the opening picker, not what is beneath (sc-44486)', () => {
  it('takes Back from a window under it and from the screen, from the hold until its release', () => {
    expect(pickerTookBack()).toBe(false);

    const close = vi.fn();
    const release = holdBack(close);

    expect(pickerTookBack()).toBe(true);
    expect([...listeners].map((back) => back())).toEqual([true]);
    expect(close).toHaveBeenCalledTimes(2);

    release();

    // The same Back's second delivery: taken, with nothing left to close.
    expect(pickerTookBack()).toBe(true);
    expect([...listeners].map((back) => back())).toEqual([true]);
    expect(close).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(SECOND_DELIVERY_MS);

    expect(pickerTookBack()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('keeps a newer hold when an older one is released', () => {
    const old = holdBack(vi.fn());
    const newer = holdBack(vi.fn());
    old();
    vi.advanceTimersByTime(SECOND_DELIVERY_MS);

    expect(pickerTookBack()).toBe(true);
    newer();
    vi.advanceTimersByTime(SECOND_DELIVERY_MS);
    expect(pickerTookBack()).toBe(false);
  });
});
