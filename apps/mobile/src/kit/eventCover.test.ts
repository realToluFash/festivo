import { describe, expect, it } from 'vitest';

import { coverPlacement, coverShown, coverSource, defaultFor } from './eventCover.ts';

const SIZES = [
  { width: 1920, url: 'large' },
  { width: 640, url: 'small' },
  { width: 1280, url: 'medium' },
];

describe('the cover photo (sc-3590)', () => {
  it('takes the smallest size that fills the frame, else the largest', () => {
    expect(coverSource(SIZES, 300)).toBe('small');
    expect(coverSource(SIZES, 1100)).toBe('medium');
    expect(coverSource(SIZES, 4000)).toBe('large');
    expect(coverSource([], 300)).toBeNull();
  });

  it('places a tall photo by its position, as object-position does on the web', () => {
    const frame = { width: 320, height: 180 };
    const photo = { width: 1600, height: 1600 };

    expect(coverPlacement(frame, photo, 0).height).toBe(320);
    expect(coverPlacement(frame, photo, 0).top).toBeCloseTo(0);
    expect(coverPlacement(frame, photo, 50).top).toBe(-70);
    expect(coverPlacement(frame, photo, 100).top).toBe(-140);
  });

  it('centres a wide photo across the frame', () => {
    expect(coverPlacement({ width: 320, height: 180 }, { width: 3200, height: 900 }, 30)).toEqual({
      width: 640,
      height: 180,
      left: -160,
      top: 0,
    });
  });
});

describe('a cover photo that will not load (sc-13861)', () => {
  const COVER = { position: 50, description: 'The arch', sizes: SIZES };

  it('shows the photo with its description while it loads and once it has', () => {
    expect(coverShown(COVER, null, null)).toEqual({ photo: true, description: 'The arch' });
    expect(coverShown(COVER, 'medium', null)).toEqual({ photo: true, description: 'The arch' });
  });

  it('shows the default in its place, without the description a screen reader would read', () => {
    expect(coverShown(COVER, 'medium', 'medium')).toEqual({ photo: false, description: null });
  });

  it('tries the photo again at another size, as when the frame is laid out afresh', () => {
    expect(coverShown(COVER, 'large', 'medium').photo).toBe(true);
  });

  it('gives a type the app does not know the general default', () => {
    expect(defaultFor('wedding')).toBe('wedding');
    expect(defaultFor('street_party')).toBe('other');
  });
});
