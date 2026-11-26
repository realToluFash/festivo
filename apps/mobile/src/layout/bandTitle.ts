import { LIVE_LINE } from './bandLive.ts';
import { LABEL_LINE, atAccessibilitySizes, fitWidest } from './textSize.ts';

export const BAND_TITLE = 17;
export const BAND_LINE = 1.2;
export const BAND_CLEAR = 8;
// Twice the room from the row's middle up to the status bar: a taller line runs into the Dynamic Island.
export const BAND_TALLEST = 48;

export function bandLine(size: number): number {
  return Math.ceil(size * BAND_LINE);
}

export function bandStart(scale: number): number {
  return BAND_TITLE * scale;
}

export interface BandRow {
  width: number;
  tileEnd: number;
  searchStart: number;
}

export interface BandTitle {
  size: number;
  /** `screen`: centred on the screen, as main. `room`: centred between the tile and Search. */
  centred: 'screen' | 'room';
}

export function bandRoom(row: BandRow): number {
  return Math.max(0, row.searchStart - row.tileEnd - 2 * BAND_CLEAR);
}

function fitsOnScreen(row: BandRow, wide: number): boolean {
  const left = (row.width - wide) / 2;

  return left >= row.tileEnd + BAND_CLEAR && left + wide <= row.searchStart - BAND_CLEAR;
}

/** Main's band at the standard sizes; from AX1 whole on one line, 8 clear of the tile and Search, never under 17 (sc-92248). */
export function bandTitle(scale: number, wideAtStart: number, row: BandRow): BandTitle {
  const start = bandStart(scale);

  if (!atAccessibilitySizes(scale)) return { size: start, centred: 'screen' };

  const tallest = Math.floor(BAND_TALLEST / BAND_LINE);
  const room = bandRoom(row);
  const size = Math.min(tallest, fitWidest(BAND_TITLE, start, wideAtStart, room));
  const wide = (wideAtStart * size) / start;

  return { size, centred: fitsOnScreen(row, wide) ? 'screen' : 'room' };
}

/** The room a phone's live line has under the title's row, down to the band's foot, given the row's middle and the band's height. */
export function bandLiveRoom(rowMiddle: number, bandHeight: number, foot: number): number {
  return Math.max(0, bandHeight - foot - (rowMiddle + BAND_TALLEST / 2));
}

/** The phone's live line: main's at the standard sizes; from AX1 no larger than its line fits under the title's row, never under 13.5 (sc-92248). */
export function bandLiveSize(scale: number, room: number): number {
  const start = LIVE_LINE * scale;

  if (!atAccessibilitySizes(scale)) return start;

  return Math.max(LIVE_LINE, Math.min(start, Math.floor(room / LABEL_LINE)));
}
