import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewInstance } from 'react-native';

const keys = vi.hoisted(() => ({ top: null as number | null }));
const brought = vi.hoisted(() => vi.fn());
const cleanups = vi.hoisted(() => [] as (() => void)[]);
const keyboard = vi.hoisted(() => new Map<string, () => void>());

vi.mock('react', () => ({
  useRef: <T>(current: T) => ({ current }),
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup != null) cleanups.push(cleanup);
  },
}));
vi.mock('react-native', () => ({
  Keyboard: {
    addListener: (event: string, listener: () => void) => {
      keyboard.set(event, listener);
      return { remove: () => keyboard.delete(event) };
    },
  },
}));
vi.mock('./keyboardWatch.ts', () => ({ keyboardTopNow: () => keys.top }));
vi.mock('./intoView.ts', () => ({ SETTLED_MS: 500, bringIntoView: brought }));

const { fieldFocused, fieldReshaped, fieldTyped } = await import('./focusedField.ts');
const { useFocusedFieldInSight } = await import('./focusedFieldInSight.ts');

const field = { name: 'title' } as unknown as ViewInstance;

describe('the focused field after Save is answered with a notice (sc-74540)', () => {
  let holdField: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    keys.top = 600;
    holdField = useFocusedFieldInSight({ current: null }, { current: 0 });
    fieldFocused(field);
    brought.mockClear();
  });

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    fieldFocused(null);
    vi.useRealTimers();
  });

  it('comes back above the keys at the first character typed, while the scroll to the top is held', () => {
    holdField();
    fieldTyped();

    expect(brought).toHaveBeenCalledOnce();
    expect(brought.mock.calls[0]?.[1]).toBe(field);
    expect(brought.mock.calls[0]?.[3]).toMatchObject({ aboveKeys: true });
  });

  it('stays where the scroll to the top left it however late it reshapes, and follows again once focus moves (sc-75689)', () => {
    holdField();
    fieldReshaped(field);
    vi.advanceTimersByTime(2000);
    fieldReshaped(field);
    expect(brought).not.toHaveBeenCalled();

    fieldFocused(field);
    expect(brought).toHaveBeenCalledOnce();
    fieldReshaped(field);
    expect(brought).toHaveBeenCalledTimes(2);
  });

  it('comes back above the keys as they rise again after being dropped during the hold', () => {
    holdField();
    keys.top = null;
    keyboard.get('keyboardDidHide')?.();
    keys.top = 600;
    keyboard.get('keyboardDidShow')?.();

    expect(brought).toHaveBeenCalledOnce();
    expect(brought.mock.calls[0]?.[1]).toBe(field);
  });

  it('follows the field again as it reshapes once typed in after the hold', () => {
    holdField();
    fieldTyped();
    fieldReshaped(field);

    expect(brought).toHaveBeenCalledTimes(2);
  });

  it('is left be when typed in with the keys down', () => {
    keys.top = null;
    fieldTyped();

    expect(brought).not.toHaveBeenCalled();
  });
});
