import type { EventCover } from '@soirely/api-client';
import { type EventType, isEventType } from '@soirely/domain';

/** The smallest stored width that fills the frame on this screen, else the largest there is. */
export function coverSource(sizes: EventCover['sizes'], framePixels: number): string | null {
  const widest = [...sizes].sort((a, b) => a.width - b.width);

  return (widest.find(({ width }) => width >= framePixels) ?? widest.at(-1))?.url ?? null;
}

/** Scaled to cover the frame and placed as the web's `object-position: 50% <position>%` places it. */
export function coverPlacement(
  frame: { width: number; height: number },
  photo: { width: number; height: number },
  position: number,
): { width: number; height: number; left: number; top: number } {
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;

  return {
    width,
    height,
    left: (frame.width - width) / 2,
    top: ((frame.height - height) * position) / 100,
  };
}

/** A photo that failed to load shows the default in its place, and the default is decorative, so its description goes too (sc-13861). */
export function coverShown(
  cover: EventCover | null,
  source: string | null,
  failed: string | null,
): { photo: boolean; description: string | null } {
  const photo = cover != null && (source == null || source !== failed);

  return { photo, description: photo ? cover.description : null };
}

/** A type a newer server knows and this app does not gets the general default. */
export function defaultFor(type: string): EventType {
  return isEventType(type) ? type : 'other';
}
