import { describe, expect, test } from 'vitest';

import {
  COVER_MAX_BYTES,
  coverDimensionsRefusal,
  coverFileRefusal,
  coverTypeOf,
  draggedPosition,
  coverRefusalWords,
  positionPart,
} from './coverPhoto.ts';

describe('a cover photo (sc-3590)', () => {
  test('a JPEG, PNG, WebP or HEIC up to 15 MB is taken', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
      expect(coverFileRefusal({ type, name: 'photo', size: COVER_MAX_BYTES })).toBeNull();
  });

  test('any other type is refused for its type', () => {
    expect(coverFileRefusal({ type: 'image/gif', name: 'a.gif', size: 10 })).toBe('type');
    expect(coverFileRefusal({ type: 'application/pdf', name: 'a.pdf', size: 10 })).toBe('type');
    expect(coverFileRefusal({ type: '', name: 'a.txt', size: 10 })).toBe('type');
  });

  test('a HEIC the browser gives no type is known by its extension', () => {
    expect(coverTypeOf({ type: '', name: 'IMG_0001.HEIC' })).toBe('image/heic');
  });

  test('over 15 MB is refused for its size', () => {
    expect(coverFileRefusal({ type: 'image/jpeg', name: 'a.jpg', size: COVER_MAX_BYTES + 1 })).toBe(
      'size',
    );
  });

  test('smaller than 1200 × 675 is refused, and an unreadable size is left to the API', () => {
    expect(coverDimensionsRefusal({ width: 1199, height: 900 })).toBe('dimensions');
    expect(coverDimensionsRefusal({ width: 1600, height: 674 })).toBe('dimensions');
    expect(coverDimensionsRefusal({ width: 1200, height: 675 })).toBeNull();
    expect(coverDimensionsRefusal(null)).toBeNull();
  });

  test('the slider names the part of the photo in the frame', () => {
    expect([0, 33, 50, 66, 67, 100].map(positionPart)).toEqual([
      'top',
      'top',
      'middle',
      'middle',
      'bottom',
      'bottom',
    ]);
  });

  test('dragging the photo up shows more of its bottom, within 0 to 100', () => {
    expect(draggedPosition(50, -100, 200)).toBe(100);
    expect(draggedPosition(50, 50, 200)).toBe(25);
    expect(draggedPosition(10, 500, 200)).toBe(0);
    expect(draggedPosition(40, 50, 0)).toBe(40);
  });
});

describe('coverRefusalWords', () => {
  const t = (key: string) => key;

  test("says the API's reason for the photo first, then the description's", () => {
    expect(coverRefusalWords({ file: 'Too small.', description: 'Too long.' }, t)).toBe(
      'Too small.',
    );
    expect(coverRefusalWords({ description: 'Too long.' }, t)).toBe('Too long.');
  });

  test('says the photo did not upload when the API gave no reason', () => {
    expect(coverRefusalWords(null, t)).toBe('eventCover.uploadFailed');
    expect(coverRefusalWords({}, t)).toBe('eventCover.uploadFailed');
  });
});
