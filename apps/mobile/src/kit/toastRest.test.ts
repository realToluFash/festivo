import { describe, expect, it } from 'vitest';

import { type RowOverToast, restAboveToast } from './toastRest.ts';

// A phone's scroll from 100 to 800 in the window, the toast's top at 700, 2000 of content.
const page: RowOverToast = {
  contentY: 0,
  height: 56,
  offset: 0,
  scrollTop: 100,
  scrollHeight: 700,
  toastTop: 700,
  content: 2000,
  margin: 12,
};

describe('restAboveToast (sc-86228)', () => {
  it('scrolls a row in sight under the toast up until it clears the toast by 12', () => {
    expect(restAboveToast({ ...page, contentY: 600 })).toEqual({ to: 68, room: 0 });
  });

  it('brings a row out of sight below to 12 above the toast, not to the scroll’s foot', () => {
    expect(restAboveToast({ ...page, contentY: 1500 })).toEqual({ to: 968, room: 0 });
  });

  it('leaves a row wholly in sight 12 or more above the toast where it is', () => {
    expect(restAboveToast({ ...page, contentY: 532 })).toEqual({ to: null, room: 0 });
  });

  it('moves a row whose foot is less than 12 above the toast', () => {
    expect(restAboveToast({ ...page, contentY: 533 })).toEqual({ to: 1, room: 0 });
  });

  it('gives the page’s foot the room it lacks for the last row to clear the toast', () => {
    expect(restAboveToast({ ...page, contentY: 1944, offset: 1300 })).toEqual({
      to: 1412,
      room: 112,
    });
  });

  it('keeps room it already gave while the page stays scrolled into it', () => {
    expect(restAboveToast({ ...page, contentY: 1700, offset: 1350 })).toEqual({
      to: null,
      room: 50,
    });
  });

  it('measures from the toast’s top however tall its words make it', () => {
    expect(restAboveToast({ ...page, contentY: 600, toastTop: 640 })).toEqual({
      to: 128,
      room: 0,
    });
  });

  it('rests a row taller than the room above the toast 12 under the scroll’s top', () => {
    expect(restAboveToast({ ...page, contentY: 900, height: 700 })).toEqual({
      to: 888,
      room: 0,
    });
  });

  it('brings a row scrolled past above back wholly into sight', () => {
    expect(restAboveToast({ ...page, contentY: 300, offset: 400 })).toEqual({
      to: 288,
      room: 0,
    });
  });

  it('ends the sight at the scroll’s foot when the toast sits below it', () => {
    expect(restAboveToast({ ...page, contentY: 780, toastTop: 900 })).toEqual({
      to: 136,
      room: 0,
    });
  });
});
