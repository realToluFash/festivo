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

describe('the Field a client check on a picker hands over (sc-21232)', () => {
  it('hands that Field at once, with no focus event to wait for, and leaves a later focus be', async () => {
    const store = await freshStore();
    const checked = vi.fn();
    store.watchCheckedField(checked);
    const type = field('type');

    store.fieldChecked(true, type);
    store.fieldFocused(field('name'));

    expect(checked).toHaveBeenCalledExactlyOnceWith(type);
  });
});

describe('moving on from the field a screen settled on (sc-37519)', () => {
  let store: Awaited<ReturnType<typeof freshStore>>;
  const moved = vi.fn();
  const name = field('name');

  beforeEach(async () => {
    store = await freshStore();
    moved.mockClear();
  });

  it('stays while focus returns to the field it settled on', () => {
    store.fieldFocused(name);
    store.watchMovedOn(moved).settled();
    store.fieldFocused(name);

    expect(moved).not.toHaveBeenCalled();
  });

  it('moves on as another field takes focus', () => {
    store.fieldFocused(name);
    store.watchMovedOn(moved).settled();
    store.fieldFocused(field('email'));

    expect(moved).toHaveBeenCalledOnce();
  });

  it('moves on as a control with no focus of its own is taken', () => {
    store.fieldFocused(name);
    store.watchMovedOn(moved).settled();
    store.controlTaken();

    expect(moved).toHaveBeenCalledOnce();
  });

  it('ignores focus and controls taken before the screen settles', () => {
    const watch = store.watchMovedOn(moved);
    store.fieldFocused(field('email'));
    store.controlTaken();
    store.fieldFocused(name);
    watch.settled();

    expect(moved).not.toHaveBeenCalled();
  });

  it('hears nothing once stopped', () => {
    store.fieldFocused(name);
    const watch = store.watchMovedOn(moved);
    watch.settled();
    watch.stop();
    store.fieldFocused(field('email'));
    store.controlTaken();

    expect(moved).not.toHaveBeenCalled();
  });
});
