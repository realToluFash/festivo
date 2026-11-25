import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewInstance } from 'react-native';

const keys = vi.hoisted(() => ({ top: null as number | null }));
const brought = vi.hoisted(() => vi.fn());
const cleanups = vi.hoisted(() => [] as (() => void)[]);

vi.mock('react', () => ({
  useRef: <T>(current: T) => ({ current }),
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup != null) cleanups.push(cleanup);
  },
}));
vi.mock('react-native', () => ({
  Keyboard: { addListener: () => ({ remove: () => {} }) },
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

  it('stays where the scroll to the top left it as it reshapes during the hold, and follows again after', () => {
    holdField();
    fieldReshaped(field);
    expect(brought).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    fieldReshaped(field);
    expect(brought).toHaveBeenCalledOnce();
  });

  it('is left be when typed in with the keys down', () => {
    keys.top = null;
    fieldTyped();

    expect(brought).not.toHaveBeenCalled();
  });
});
