import type { EventCover } from '@soirely/api-client';

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
