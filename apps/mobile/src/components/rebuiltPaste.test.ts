import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  deps: [] as (readonly unknown[] | undefined)[],
  cleanups: [] as ((() => void) | undefined)[],
  cursor: 0,
  stateCursor: 0,
}));
const resumed = vi.hoisted(() => ({
  listener: null as ((state: string) => void) | null,
  remove: vi.fn(),
}));
const copied = vi.hoisted(() => ({ listener: null as (() => void) | null, remove: vi.fn() }));

vi.mock('react', () => ({
  useState: <T>(initial: T) => {
    const at = hooks.stateCursor++;
    if (!(at in hooks.states)) hooks.states[at] = initial;
    const set = (next: T | ((was: T) => T)) => {
      hooks.states[at] =
        typeof next === 'function' ? (next as (was: T) => T)(hooks.states[at] as T) : next;
    };
    return [hooks.states[at] as T, set];
  },
  useEffect: (effect: () => (() => void) | undefined, deps?: readonly unknown[]) => {
    const at = hooks.cursor++;
    const was = hooks.deps[at];
    const same =
      at in hooks.deps &&
      deps !== undefined &&
      was !== undefined &&
      deps.length === was.length &&
      deps.every((dep, i) => Object.is(dep, was[i]));
    if (same) return;
    hooks.cleanups[at]?.();
    hooks.deps[at] = deps;
    hooks.cleanups[at] = effect() ?? undefined;
  },
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      resumed.listener = listener;
      return { remove: resumed.remove };
    },
  },
}));
vi.mock('expo-clipboard', () => ({
  addClipboardListener: (listener: () => void) => {
    copied.listener = listener;
    return { remove: copied.remove };
  },
}));

const { useRebuiltPaste: rebuilt } = await import('./rebuiltPaste.ts');

function render() {
  hooks.cursor = 0;
  hooks.stateCursor = 0;
  return rebuilt();
}

describe('useRebuiltPaste', () => {
  beforeEach(() => {
    hooks.states = [];
    hooks.deps = [];
    hooks.cleanups = [];
    resumed.listener = null;
    copied.listener = null;
  });

  it('rebuilds once after mounting', () => {
    const first = render();
    expect(render()).not.toBe(first);
  });

  it('keeps the same options on a plain render', () => {
    render();
    const mounted = render();
    expect(render()).toBe(mounted);
    expect(render()).toBe(mounted);
  });

  it('rebuilds each time the app becomes active, and not on other states', () => {
    render();
    const before = render();
    resumed.listener?.('background');
    expect(render()).toBe(before);
    resumed.listener?.('active');
    const after = render();
    expect(after).not.toBe(before);
    resumed.listener?.('active');
    expect(render()).not.toBe(after);
  });

  it('rebuilds each time the clipboard changes', () => {
    render();
    const before = render();
    copied.listener?.();
    const after = render();
    expect(after).not.toBe(before);
    copied.listener?.();
    expect(render()).not.toBe(after);
  });
});
