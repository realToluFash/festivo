import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { holdMovedClicks } from './movedClicks.ts';

function placed(element: Element, left: number, top: number, width: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, top, width, height));
}

function press(on: Element, x: number, y: number) {
  on.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
}

function release(on: Element, x: number, y: number) {
  on.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
}

describe('a click the layout moved away from (sc-25852)', () => {
  let button: HTMLButtonElement;
  let below: HTMLDivElement;
  let clicks: number;
  let letGo: () => void;

  beforeEach(() => {
    document.body.innerHTML = '<button type="button"><span>Sign in</span></button><div></div>';
    button = document.querySelector('button')!;
    below = document.querySelector('div')!;
    clicks = 0;
    button.addEventListener('click', () => clicks++);
    placed(button, 100, 300, 200, 44);
    letGo = holdMovedClicks();
  });

  afterEach(() => {
    letGo();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('counts a release where the button was when the mouse went down', () => {
    press(button.querySelector('span')!, 150, 320);
    release(below, 150, 320);

    expect(clicks).toBe(1);
  });

  it('counts a small slip inside that place', () => {
    press(button, 150, 320);
    release(below, 298, 343);

    expect(clicks).toBe(1);
  });

  it('leaves a release on the button itself to the browser, so it is never clicked twice', () => {
    press(button, 150, 320);
    release(button, 150, 320);

    expect(clicks).toBe(0);
  });

  it('cancels a press that slides off the place before it is released', () => {
    press(button, 150, 320);
    release(below, 150, 360);

    expect(clicks).toBe(0);
  });

  it('leaves a touch to the browser', () => {
    button.dispatchEvent(
      Object.assign(new MouseEvent('pointerdown', { bubbles: true }), { pointerType: 'touch' }),
    );
    press(button, 150, 320);
    release(below, 150, 320);

    expect(clicks).toBe(0);
  });

  it('ignores a press with any button but the main one', () => {
    button.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 2, clientX: 150, clientY: 320 }),
    );
    release(below, 150, 320);

    expect(clicks).toBe(0);
  });

  it('leaves a press with a modifier key held to the browser', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      button.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 150,
          clientY: 320,
          [modifier]: true,
        }),
      );
      release(below, 150, 320);
    }

    expect(clicks).toBe(0);
  });

  it('stops holding once the last form lets go', () => {
    const other = holdMovedClicks();
    letGo();

    press(button, 150, 320);
    release(below, 150, 320);
    expect(clicks).toBe(1);

    other();
    letGo = () => {};
    press(button, 150, 320);
    release(below, 150, 320);
    expect(clicks).toBe(1);
  });
});
