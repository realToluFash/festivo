import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KEYBOARD_HIDDEN_SAID_MS, saidInFullMs } from '../kit/readOut.ts';

const native = vi.hoisted(() => ({
  platform: { OS: 'android' },
  hidden: new Set<() => void>(),
  keyboard: {
    isVisible: vi.fn(() => false),
    dismiss: vi.fn(),
    addListener: vi.fn((_event: string, listener: () => void) => {
      native.hidden.add(listener);
      return { remove: () => native.hidden.delete(listener) };
    }),
  },
  fieldChecked: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: native.platform,
  Keyboard: native.keyboard,
  codegenNativeCommands: () => ({}),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../i18n/index.ts', () => ({ currentLocale: () => 'en' }));
vi.mock('./ListPicker.tsx', () => ({ ListPicker: () => null }));
vi.mock('./Screen.tsx', () => ({ SETTLED_MS: 500 }));
vi.mock('./screenReaderFocus.ts', () => ({ moveScreenReaderFocus: vi.fn() }));
vi.mock('./focusedField.ts', () => ({
  fieldChecked: native.fieldChecked,
  watchMovedOn: () => ({ settled: () => {}, stop: () => {} }),
}));

const { focusPicker } = await import('./CountryPicker.tsx');

describe('a refused picker on Android waits for the summary to be said (sc-43907)', () => {
  const summary = 'Type is required.';
  const picker = { current: null };
  const field = { current: null };

  beforeEach(() => {
    vi.useFakeTimers();
    native.fieldChecked.mockClear();
    native.hidden.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the Field in view at once, with the summary to wait for', () => {
    native.keyboard.isVisible.mockReturnValue(false);
    const cancel = focusPicker(picker, field, summary);

    vi.advanceTimersByTime(saidInFullMs('android', summary));
    expect(native.fieldChecked).toHaveBeenCalledWith(true, null, expect.any(Function), true);
    cancel();
  });

  it('lets the Field glide into view with no summary, as with TalkBack off', () => {
    native.keyboard.isVisible.mockReturnValue(false);
    const cancel = focusPicker(picker, field);

    expect(native.fieldChecked).toHaveBeenCalledWith(true, null, expect.any(Function), false);
    cancel();
  });

  it('scrolls once the summary is said, with the keyboard down', () => {
    native.keyboard.isVisible.mockReturnValue(false);
    const cancel = focusPicker(picker, field, summary);

    vi.advanceTimersByTime(saidInFullMs('android', summary) - 1);
    expect(native.fieldChecked).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(native.fieldChecked).toHaveBeenCalledOnce();
    cancel();
  });

  it('scrolls only after TalkBack says the keyboard is hidden too, with the keyboard up', () => {
    native.keyboard.isVisible.mockReturnValue(true);
    const cancel = focusPicker(picker, field, summary);
    native.keyboard.isVisible.mockReturnValue(false);
    native.hidden.forEach((hidden) => hidden());

    vi.advanceTimersByTime(saidInFullMs('android', summary) + KEYBOARD_HIDDEN_SAID_MS - 1);
    expect(native.fieldChecked).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(native.fieldChecked).toHaveBeenCalledOnce();
    cancel();
  });

  it('times the wait from the keys going down when they close late, with the keyboard up', () => {
    const keysLateMs = 1500;
    native.keyboard.isVisible.mockReturnValue(true);
    const cancel = focusPicker(picker, field, summary);

    vi.advanceTimersByTime(keysLateMs);
    native.keyboard.isVisible.mockReturnValue(false);
    native.hidden.forEach((hidden) => hidden());
    vi.advanceTimersByTime(saidInFullMs('android', summary, true) - 1);
    expect(native.fieldChecked).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(native.fieldChecked).toHaveBeenCalledOnce();
    cancel();
  });
});
