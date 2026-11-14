import { afterEach, describe, expect, it } from 'vitest';

import { keepFocusIn } from './dialogFocus.ts';

function dialogWith(body: string): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.tabIndex = -1;
  dialog.innerHTML = body;
  document.body.append(dialog);

  return dialog;
}

function press(dialog: HTMLElement, shiftKey = false): boolean {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
  keepFocusIn(dialog, event);

  return event.defaultPrevented;
}

function control(dialog: HTMLElement, selector: string): HTMLElement {
  const found = dialog.querySelector<HTMLElement>(selector);
  if (found == null) throw new Error(`no ${selector}`);

  return found;
}

const choiceList = (picked: string | null): string => `
  <button type="button" id="cancel">Cancel</button>
  <button type="button" id="save">Save</button>
  ${['one', 'two', 'three']
    .map(
      (value) =>
        `<input type="radio" name="limit" id="${value}" ${value === picked ? 'checked' : ''} />`,
    )
    .join('')}
`;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('keepFocusIn, a dialog ending in a choice list', () => {
  it('with a middle choice picked, Tab from it reaches the first control', () => {
    const dialog = dialogWith(choiceList('two'));
    control(dialog, '#two').focus();

    expect(press(dialog)).toBe(true);
    expect(document.activeElement).toBe(control(dialog, '#cancel'));
  });

  it('with a middle choice picked, Shift+Tab from the first control reaches the picked choice', () => {
    const dialog = dialogWith(choiceList('two'));
    control(dialog, '#cancel').focus();

    expect(press(dialog, true)).toBe(true);
    expect(document.activeElement).toBe(control(dialog, '#two'));
    expect((control(dialog, '#two') as HTMLInputElement).checked).toBe(true);
  });

  it('with the first choice picked, Tab from it reaches the first control', () => {
    const dialog = dialogWith(choiceList('one'));
    control(dialog, '#one').focus();

    press(dialog);
    expect(document.activeElement).toBe(control(dialog, '#cancel'));
  });

  it('with none picked, Shift+Tab from the first control reaches the first choice', () => {
    const dialog = dialogWith(choiceList(null));
    control(dialog, '#cancel').focus();

    press(dialog, true);
    expect(document.activeElement).toBe(control(dialog, '#one'));
  });

  it('with none picked, Tab from any choice reaches the first control', () => {
    const dialog = dialogWith(choiceList(null));
    control(dialog, '#three').focus();

    press(dialog);
    expect(document.activeElement).toBe(control(dialog, '#cancel'));
  });

  it('leaves Tab between the first control and the next to the browser', () => {
    const dialog = dialogWith(choiceList('two'));
    control(dialog, '#cancel').focus();

    expect(press(dialog)).toBe(false);
  });
});

describe('keepFocusIn, a dialog ending in a button', () => {
  it('wraps from last to first and first to last', () => {
    const dialog = dialogWith(choiceList('two') + '<button type="button" id="step">Step</button>');
    control(dialog, '#step').focus();
    press(dialog);
    expect(document.activeElement).toBe(control(dialog, '#cancel'));

    press(dialog, true);
    expect(document.activeElement).toBe(control(dialog, '#step'));
  });

  it('lets Tab from the picked choice go on to the button after the list', () => {
    const dialog = dialogWith(choiceList('two') + '<button type="button" id="step">Step</button>');
    control(dialog, '#two').focus();

    expect(press(dialog)).toBe(false);
  });

  it('keeps focus on a dialog with no control', () => {
    const dialog = dialogWith('<p>Nothing to press</p>');

    expect(press(dialog)).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });
});
