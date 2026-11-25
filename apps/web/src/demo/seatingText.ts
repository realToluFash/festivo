import { useEffect, useState } from 'react';

import { SW, say } from './seating.ts';

let measure: CanvasRenderingContext2D | null | undefined;

/** Measured in a browser, estimated in tests at perChar a character. */
export function textWidth(text: string, font: string, perChar: number): number {
  if (measure === undefined)
    measure = navigator.userAgent.includes('jsdom')
      ? null
      : document.createElement('canvas').getContext('2d');
  if (measure == null) return Array.from(text).length * perChar;
  measure.font = font;
  return measure.measureText(text).width;
}

const CAPTION_FONT = '600 12.5px "Instrument Sans", sans-serif';

/** Draws once more when the caption's font arrives, so what was measured in the fallback is measured again. */
export function useFontsArrived(): void {
  const [, setArrived] = useState(0);

  useEffect(() => {
    let live = true;
    const arrived = () => {
      if (live) setArrived((n) => n + 1);
    };
    void document.fonts.ready.then(arrived);
    void document.fonts.load?.(CAPTION_FONT).then(arrived);

    return () => {
      live = false;
    };
  }, []);
}

const CAPTION_INSET = 12;

/** The room's caption (sc-92246): only the name gives way, so the size stays whole. */
export function roomCaption(
  name: string,
  width: string,
  length: string,
  ox: number,
  frame: number,
  widthOf: (text: string) => number = (text) => textWidth(text, CAPTION_FONT, 6.6),
): { x: number; text: string } {
  const x = Math.max(ox, CAPTION_INSET);
  const room = frame - CAPTION_INSET - x;
  const whole = name.trim();
  const line = (shown: string) =>
    shown === ''
      ? say(SW.roomSize, { width, length })
      : say(SW.roomLine, { name: shown, width, length });

  if (whole === '' || widthOf(line(whole)) <= room) return { x, text: line(whole) };
  const chars = Array.from(whole);
  let low = 0;
  let high = chars.length - 1;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const cut = say(SW.roomNameCut, { name: chars.slice(0, mid).join('').trimEnd() });

    if (widthOf(line(cut)) <= room) low = mid;
    else high = mid - 1;
  }
  return { x, text: line(say(SW.roomNameCut, { name: chars.slice(0, low).join('').trimEnd() })) };
}
