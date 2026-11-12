import { describe, expect, it } from 'vitest';

import { titleAtWidth, titleWithInkRoom, UNMEASURED_TITLE } from './titleWidth.ts';

describe('titleAtWidth', () => {
  it('keeps the key on the first layout', () => {
    expect(titleAtWidth(UNMEASURED_TITLE, 600)).toEqual({ width: 600, key: 0 });
  });

  it('keeps the key when the row lays out at the same width again', () => {
    const first = titleAtWidth(UNMEASURED_TITLE, 600);

    expect(titleAtWidth(first, 600).key).toBe(first.key);
  });

  it('keeps the key when the width differs by less than a rounding', () => {
    const first = titleAtWidth(UNMEASURED_TITLE, 600);

    expect(titleAtWidth(first, 600.3).key).toBe(first.key);
  });

  it('changes the key when the row turns to a new width, and again when it turns back', () => {
    const landscape = titleAtWidth(UNMEASURED_TITLE, 900);
    const portrait = titleAtWidth(landscape, 600);
    const back = titleAtWidth(portrait, 900);

    expect(portrait).toEqual({ width: 600, key: 1 });
    expect(back).toEqual({ width: 900, key: 2 });
  });
});

describe('titleWithInkRoom', () => {
  it('ends an Android title in a hair space', () => {
    expect(titleWithInkRoom('Ada at Thirty', 'android')).toBe('Ada at Thirty ');
  });

  it('leaves the title as it is elsewhere', () => {
    expect(titleWithInkRoom('Ada at Thirty', 'ios')).toBe('Ada at Thirty');
  });
});
