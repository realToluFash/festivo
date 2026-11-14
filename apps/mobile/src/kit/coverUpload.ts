import { ApiError } from '@soirely/api-client';
import {
  type CoverRefusal,
  coverDimensionsRefusal,
  coverFileRefusal,
  coverRefusalWords,
} from '@soirely/domain';

/** What the photo library hands back, as much of it as the cover's rules read. */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
  mimeType?: string | undefined;
  fileName?: string | null | undefined;
  fileSize?: number | undefined;
}

/** The file the rules check: a picker that gives no type or name leaves the extension of its path to say. */
export function pickedFile(photo: PickedPhoto): { type: string; name: string; size: number } {
  return {
    type: photo.mimeType ?? '',
    name: photo.fileName ?? photo.uri.split('/').at(-1) ?? '',
    size: photo.fileSize ?? 0,
  };
}

/** The web's refusals before anything uploads (sc-3590); a size the picker did not say is left to the API. */
export function pickedRefusal(photo: PickedPhoto): CoverRefusal | null {
  return (
    coverFileRefusal(pickedFile(photo)) ??
    coverDimensionsRefusal(photo.width > 0 && photo.height > 0 ? photo : null)
  );
}

/** How far the photo, scaled to the frame's width, runs past the frame's height. */
export function photoOverflow(
  frame: { width: number; height: number },
  photo: { width: number; height: number },
): number {
  return photo.width === 0 ? 0 : (frame.width * photo.height) / photo.width - frame.height;
}

export function coverRefusalOf(error: unknown, t: (key: string) => string): string {
  return coverRefusalWords(
    error instanceof ApiError && error.status === 422 ? error.fieldErrors() : null,
    t,
  );
}
