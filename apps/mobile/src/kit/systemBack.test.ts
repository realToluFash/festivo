import { describe, expect, it } from 'vitest';

import { backFromLinkedList, pageTakesBack } from './systemBack.ts';

describe('pageTakesBack', () => {
  it('takes Back where the page shows in place of its list', () => {
    expect(pageTakesBack('phone', true)).toBe(true);
    expect(pageTakesBack('tabletPortrait', true)).toBe(true);
  });

  it('leaves Back alone on the list, and where list and page show side by side', () => {
    expect(pageTakesBack('phone', false)).toBe(false);
    expect(pageTakesBack('tabletPortrait', false)).toBe(false);
    expect(pageTakesBack('tabletLandscape', true)).toBe(false);
  });
});

describe('backFromLinkedList', () => {
  it('closes the Events list behind a created event too, so Home comes next', () => {
    expect(backFromLinkedList(['index', 'events/index'])).toEqual({ close: 2 });
  });

  it('closes only itself over anything else', () => {
    expect(backFromLinkedList(['index'])).toEqual({ close: 1 });
    expect(backFromLinkedList(['index', 'settings/index'])).toEqual({ close: 1 });
  });

  it('goes Home when nothing but the Events list is behind it', () => {
    expect(backFromLinkedList([])).toBe('home');
    expect(backFromLinkedList(['events/index'])).toBe('home');
  });
});
