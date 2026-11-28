import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// Just enough of React for one hook: state and refs keep their slot, and an effect runs after a render that changed its deps.
const hook = vi.hoisted(() => ({
  slots: [] as unknown[],
  at: 0,
  due: [] as (() => void)[],
}));
vi.mock('react', () => {
  const slot = <T>(first: () => T): T => (hook.slots[hook.at++] ??= first()) as T;
  return {
    useRef: (value: unknown) => slot(() => ({ current: value })),
    useState: (value: number) => {
      const state = slot(() => ({ value }));
      return [state.value, (next: (was: number) => number) => (state.value = next(state.value))];
    },
    useEffect: (effect: () => unknown, deps?: unknown[]) => {
      const last = slot(() => ({ deps: undefined as unknown[] | undefined, ran: false }));
      if (last.ran && deps != null && deps.every((dep, i) => Object.is(dep, last.deps?.[i])))
        return;
      Object.assign(last, { deps, ran: true });
      hook.due.push(effect);
    },
  };
});

const {
  SECOND_DELIVERY_MS,
  holdBack,
  pickerTookBack,
  useEarlyBack: hooked,
} = await import('./earlyBack.ts');
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

describe('the hold a picker takes at its tap (sc-44486)', () => {
  it('is released after a Back that shuts the picker before its opening renders', () => {
    let open = false;
    const render = () => {
      hook.at = 0;
      const takeBack = hooked(open, () => (open = false));
      hook.due.splice(0).forEach((effect) => effect());
      return takeBack;
    };

    render()();
    open = true;
    expect([...listeners].map((back) => back())).toEqual([true]);
    render();
    vi.advanceTimersByTime(SECOND_DELIVERY_MS);

    expect(listeners.size).toBe(0);
    expect(pickerTookBack()).toBe(false);
  });

  const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

  it('is taken by every sheet picker on New event', () => {
    const screen = source('NewEvent.tsx');

    expect(screen).toMatch(
      /const openList = \(which: ListOpen\) => \{\s*takeBack\(\);\s*setList\(which\);/,
    );
    expect(screen.match(/openList\('(type|zone|currency)'\)/g)).toHaveLength(3);
    expect(screen).not.toMatch(/setList\('/);
  });

  it('gets the Back a window under the picker is given', () => {
    expect(source('SummaryOverlays.tsx')).toMatch(
      /onRequestClose=\{\(\) => \{\s*if \(!pickerTookBack\(\)\) onClose\(\);/,
    );
  });
});
