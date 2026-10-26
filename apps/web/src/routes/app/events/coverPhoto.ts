import { ApiError } from '@soirely/api-client';

import { api } from '../../../api.ts';

/** What a cover photo must be (sc-3590); the API refuses the same with a 422 on `file`. */
export const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const COVER_MAX_BYTES = 15 * 1024 * 1024;
export const COVER_MIN_WIDTH = 1200;
export const COVER_MIN_HEIGHT = 675;
export const COVER_DESCRIPTION_MAXIMUM = 250;
export const COVER_MIDDLE = 50;

export type CoverRefusal = 'type' | 'size' | 'dimensions';

/** A HEIC carries no type in some browsers, so its extension stands in for one. */
export function coverTypeOf(file: { type: string; name: string }): string | null {
  if (COVER_TYPES.includes(file.type)) return file.type;
  if (file.type !== '') return null;

  return /\.hei[cf]$/i.test(file.name) ? 'image/heic' : null;
}

export function coverFileRefusal(file: {
  type: string;
  name: string;
  size: number;
}): CoverRefusal | null {
  if (coverTypeOf(file) == null) return 'type';
  if (file.size > COVER_MAX_BYTES) return 'size';

  return null;
}

/** Null when it is large enough, or when the browser cannot read its size (HEIC outside Safari): the server's preview checks it then. */
export function coverDimensionsRefusal(
  size: { width: number; height: number } | null,
): CoverRefusal | null {
  if (size == null) return null;

  return size.width < COVER_MIN_WIDTH || size.height < COVER_MIN_HEIGHT ? 'dimensions' : null;
}

/** The words the slider is announced with: which part of the photo shows in the frame. */
export function positionPart(position: number): 'top' | 'middle' | 'bottom' {
  if (position < 34) return 'top';
  if (position > 66) return 'bottom';

  return 'middle';
}

/** How far a drag of `dy` pixels moves the frame, when the photo overflows it by `overflow` pixels. */
export function draggedPosition(start: number, dy: number, overflow: number): number {
  if (overflow <= 0) return start;

  return Math.round(Math.min(100, Math.max(0, start - (dy / overflow) * 100)));
}

export function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/** The photo chosen and not used goes, so its original is not kept with its GPS; a closed tab's is expired by the store. */
export function discardCoverUpload(organisationId: string, key: string): void {
  void api.discardEventCoverUpload(organisationId, key).catch(() => undefined);
}

/** A refusal the API explained (a 422 on the photo or the description), otherwise the upload simply failed. */
export function refusalOf(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.status === 422) {
    const fields = error.fieldErrors();

    return fields.file ?? fields.description ?? fields.uploadKey ?? t('eventCover.uploadFailed');
  }

  return t('eventCover.uploadFailed');
}
