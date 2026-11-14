import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { coverRefusalOf, photoOverflow, pickedFile, pickedRefusal } from './coverUpload.ts';

const large = { uri: 'file:///photos/IMG_0001.HEIC', width: 4032, height: 3024 };

describe('a photo picked for the cover (sc-3590)', () => {
  it('takes a large JPEG, PNG, WebP or HEIC', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
      expect(pickedRefusal({ ...large, mimeType, fileSize: 4_000_000 })).toBeNull();
  });

  it('knows a HEIC the picker gave no type by its path', () => {
    expect(pickedFile(large)).toEqual({ type: '', name: 'IMG_0001.HEIC', size: 0 });
    expect(pickedRefusal(large)).toBeNull();
  });

  it('refuses another type, over 15 MB, and under 1200 × 675', () => {
    expect(pickedRefusal({ ...large, mimeType: 'image/gif' })).toBe('type');
    expect(pickedRefusal({ ...large, mimeType: 'image/jpeg', fileSize: 16 * 1024 * 1024 })).toBe(
      'size',
    );
    expect(pickedRefusal({ ...large, mimeType: 'image/jpeg', width: 1199, height: 900 })).toBe(
      'dimensions',
    );
  });

  it('leaves a size the picker did not say to the API', () => {
    expect(pickedRefusal({ ...large, mimeType: 'image/jpeg', width: 0, height: 0 })).toBeNull();
  });

  it('runs past a 16:9 frame by what is left of the photo at its width', () => {
    expect(photoOverflow({ width: 320, height: 180 }, { width: 4000, height: 3000 })).toBe(60);
    expect(photoOverflow({ width: 320, height: 180 }, { width: 0, height: 0 })).toBe(0);
  });

  it("says the API's reason for a refused photo, otherwise that it did not upload", () => {
    const problem = {
      type: 'https://soirely.com/errors/validation_failed',
      title: 'Refused.',
      status: 422,
      violations: [{ propertyPath: 'file', message: 'Too small.', code: 'too_small' }],
    };
    const refused = new ApiError(problem, new Response(JSON.stringify(problem), { status: 422 }));
    const t = (key: string) => key;

    expect(coverRefusalOf(refused, t)).toBe('Too small.');
    expect(coverRefusalOf(new Error('offline'), t)).toBe('eventCover.uploadFailed');
  });
});
