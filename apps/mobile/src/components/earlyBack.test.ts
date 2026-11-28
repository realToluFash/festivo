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
  NEXT_BACK_MS,
  SECOND_DELIVERY_MS,
  holdBack,
  pickerTookBack,
  useEarlyBack: hooked,
} = await import('./earlyBack.ts');
vi.useFakeTimers();

describe('an early Back goes to the opening picker, not what is beneath (sc-44486)', () => {
  const press = () => [...listeners].map((back) => back());

  it('takes Back from a window under it and from the screen, and drops a second delivery', () => {
    expect(pickerTookBack()).toBe(false);

    const close = vi.fn();
    const { release } = holdBack(close);

    expect(pickerTookBack()).toBe(true);
    expect(press()).toEqual([true]);
    expect(close).toHaveBeenCalledTimes(2);

    release();

    // The same Back's second delivery: taken, with nothing left to close.
    expect(pickerTookBack()).toBe(true);
    expect(press()).toEqual([true]);
    expect(close).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(NEXT_BACK_MS);

    expect(pickerTookBack()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('counts the drop from the tap, however late the close renders', () => {
    const { release } = holdBack(vi.fn());
    press();
    vi.advanceTimersByTime(SECOND_DELIVERY_MS);
    release();
    vi.advanceTimersByTime(NEXT_BACK_MS - SECOND_DELIVERY_MS - 1);
    expect(pickerTookBack()).toBe(true);
    vi.advanceTimersByTime(1);

    expect(pickerTookBack()).toBe(false);
    expect(listeners.size).toBe(0);

    const slow = holdBack(vi.fn());
    press();
    vi.advanceTimersByTime(NEXT_BACK_MS);
    slow.release();

    expect(listeners.size).toBe(0);
  });

  it('still drops a second delivery when the early Back is handed over late', () => {
    const { release } = holdBack(vi.fn());
    vi.advanceTimersByTime(NEXT_BACK_MS - 100);
    press();
    release();
    vi.advanceTimersByTime(SECOND_DELIVERY_MS - 1);
    expect(pickerTookBack()).toBe(true);
    vi.advanceTimersByTime(1);

    expect(listeners.size).toBe(0);
  });

  it('passes on a Back that is due though the timer has not run', () => {
    const { release } = holdBack(vi.fn());
    press();
    release();
    vi.setSystemTime(Date.now() + NEXT_BACK_MS);

    expect(press()).toEqual([false]);
    expect(listeners.size).toBe(0);
    vi.runAllTimers();
  });

  it('drops nothing after a close with no Back, however soon', () => {
    holdBack(vi.fn()).release();

    expect(pickerTookBack()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('drops nothing after a Back on a picker that had finished opening', () => {
    const hold = holdBack(vi.fn());
    hold.opened();
    press();
    hold.release();

    expect(pickerTookBack()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('still drops when the picker finishes opening after an early Back', () => {
    const hold = holdBack(vi.fn());
    press();
    hold.opened();
    hold.release();

    expect(pickerTookBack()).toBe(true);
    vi.advanceTimersByTime(NEXT_BACK_MS);
    expect(listeners.size).toBe(0);
  });

  it('keeps a newer hold when an older one is released', () => {
    const old = holdBack(vi.fn());
    pickerTookBack();
    const newer = holdBack(vi.fn());
    old.release();
    vi.advanceTimersByTime(NEXT_BACK_MS);

    expect(pickerTookBack()).toBe(true);
    newer.release();
    vi.advanceTimersByTime(NEXT_BACK_MS);
    expect(pickerTookBack()).toBe(false);
  });
});

describe('the hold a picker takes at its tap (sc-44486)', () => {
  let open = false;
  let opened = false;
  const render = () => {
    hook.at = 0;
    const takeBack = hooked(open, opened, () => (open = false));
    hook.due.splice(0).forEach((effect) => effect());
    return takeBack;
  };
  const press = () => [...listeners].map((back) => back());

  it('is released after a Back that shuts the picker before its opening renders', () => {
    render()();
    open = true;
    expect(press()).toEqual([true]);
    render();
    vi.advanceTimersByTime(NEXT_BACK_MS);

    expect(listeners.size).toBe(0);
    expect(pickerTookBack()).toBe(false);
  });

  it('ends at once on a Back after the picker says it has opened', () => {
    render()();
    open = true;
    render();
    opened = true;
    render();
    press();
    opened = false;
    render();

    expect(listeners.size).toBe(0);
  });

  const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

  it('is taken by every sheet picker on New event', () => {
    const screen = source('NewEvent.tsx');

    expect(screen).toMatch(
      /const openList = \(which: ListOpen, opener: [^)]*\) => \{\s*listFocusBack\.opening\(opener\);\s*takeBack\(\);\s*setList\(which\);/,
    );
    expect(screen.match(/openList\('(type|zone|currency)', /g)).toHaveLength(3);
    expect(screen).not.toMatch(/setList\('/);
  });

  it('is told when a sheet on New event is drawn', () => {
    expect(source('NewEvent.tsx')).toContain('useEarlyBack(list != null, listDrawn, closeList)');
    expect(source('NewEvent.tsx')).toContain('onDrawn={() => setListDrawn(true)}');
    expect(source('FormLayers.tsx')).toContain('onLayout={onDrawn}');
  });

  it('is told when the list menu has risen into place', () => {
    expect(source('ListPicker.tsx')).toMatch(
      /motion\.start\(\(\{ finished \}\) => \{\s*if \(finished && shown\) setInPlace\(true\);/,
    );
  });

  it('gets the Back a window under the picker is given', () => {
    expect(source('SummaryOverlays.tsx')).toMatch(
      /onRequestClose=\{\(\) => \{\s*if \(!pickerTookBack\(\)\) onClose\(\);/,
    );
  });
});
