import { useEffect, useState } from 'react';

const CAPTION_INSET = 12;

export const CAPTION_FONT = '600 12.5px "Instrument Sans", sans-serif';

let pen: CanvasRenderingContext2D | null | undefined;

/** Measured in the caption's own font in a browser, estimated where there is no canvas. */
function captionWidth(text: string): number {
  if (pen === undefined)
    pen = navigator.userAgent.includes('jsdom')
      ? null
      : document.createElement('canvas').getContext('2d');
  if (pen == null) return Array.from(text).length * 6.6;
  pen.font = CAPTION_FONT;
  return pen.measureText(text).width;
}

/** Draws once more when the caption's font arrives, so a caption measured in the fallback is measured again. */
export function useCaptionFont(): void {
  const [, setArrived] = useState(0);

  useEffect(() => {
    let live = true;
    const arrived = () => {
      if (live) setArrived((n) => n + 1);
    };
    void document.fonts?.ready.then(arrived);
    void document.fonts?.load?.(CAPTION_FONT).then(arrived);

    return () => {
      live = false;
    };
  }, []);
}

export interface CaptionWords {
  line: (name: string | null) => string;
  cut: (name: string) => string;
}

/** The room's caption (sc-92246): it starts at the left wall or 12 px in, and only the name gives way, to end 12 px in from the right. */
export function roomCaption(
  name: string | null,
  words: CaptionWords,
  ox: number,
  frame: number,
  widthOf: (text: string) => number = captionWidth,
): { x: number; text: string } {
  const x = Math.max(ox, CAPTION_INSET);
  const room = frame - CAPTION_INSET - x;
  const whole = (name ?? '').trim();

  if (whole === '') return { x, text: words.line(null) };
  if (widthOf(words.line(whole)) <= room) return { x, text: words.line(whole) };
  const chars = Array.from(whole);
  const cutAt = (n: number) => words.line(words.cut(chars.slice(0, n).join('').trimEnd()));
  let low = 0;
  let high = chars.length - 1;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);

    if (widthOf(cutAt(mid)) <= room) low = mid;
    else high = mid - 1;
  }
  return { x, text: cutAt(low) };
}
