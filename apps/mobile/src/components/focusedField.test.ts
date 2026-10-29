import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewInstance } from 'react-native';

async function freshStore() {
  vi.resetModules();
  return import('./focusedField.ts');
}

const field = (name: string) => ({ name }) as unknown as ViewInstance;

describe('the Field a client check hands over (sc-20721)', () => {
  let store: Awaited<ReturnType<typeof freshStore>>;
  const checked = vi.fn();

  beforeEach(async () => {
    store = await freshStore();
    checked.mockClear();
    store.watchCheckedField(checked);
  });

  it('hands nothing until the check focus lands, then that Field once', () => {
    const email = field('email');
    store.fieldChecked(false);
    expect(checked).not.toHaveBeenCalled();

    store.fieldFocused(email);
    expect(checked).toHaveBeenCalledExactlyOnceWith(email);

    store.fieldFocused(field('name'));
    expect(checked).toHaveBeenCalledOnce();
  });

  it('hands the focused Field at once when focus is already there', () => {
    const email = field('email');
    store.fieldFocused(email);
    store.fieldChecked(true);

    expect(checked).toHaveBeenCalledExactlyOnceWith(email);
  });

  it('hands nothing on a later focus once a landed check has handed its Field', () => {
    store.fieldFocused(field('email'));
    store.fieldChecked(true);
    store.fieldFocused(field('name'));

    expect(checked).toHaveBeenCalledOnce();
  });
});
