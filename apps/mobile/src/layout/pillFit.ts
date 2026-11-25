import { PILL_BESIDE_TABS } from '../kit/frameBand.ts';
import { tokens } from '../theme/tokens.ts';

/** What the pill draws around its words: its start, the 28 tile, a gap each side of the words, the caret and its end (`OrgPill`). */
export const PILL_CHROME =
  tokens.spaceSm + 28 + tokens.spaceSm + tokens.spaceSm + 14 + tokens.spacePillEnd;

/** The invitation line's ring and the gap after it, before its words. */
export const WAITING_RING = 11 + tokens.spaceXs;

/** The narrowest the name can be drawn without cutting a word: its first word, and the "…" that ends it on one line when more words follow. */
export function nameStart(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/u);

  return rest.length > 0 ? `${first}…` : first;
}

/** Beside the tabs the pill draws its words only where the name's first word, with its "…" when more words follow, and the invitation line each fit whole on one line; otherwise it is its tile, as under sc-30410's 120. At the accessibility sizes the pill is bare and wraps, as on main, and only the 120 turns it to its tile (sc-38149). */
export function pillShowsWords(
  room: number,
  widths: { nameStart: number; waitingLine: number | null },
  largest = false,
): boolean {
  if (room < PILL_BESIDE_TABS.fewest) return false;
  if (largest) return true;

  const words = room - PILL_CHROME;
  const waiting = widths.waitingLine == null ? 0 : WAITING_RING + widths.waitingLine;

  return words >= Math.max(widths.nameStart, waiting);
}

/** The name's line in the phone cover's pill, from the top row inside its sides and what Search and the bell take: 186 on an iPhone 17 Pro (sc-92247). */
export function phoneNameRoom(row: number, ends: number): number {
  return Math.max(row - ends - 2 * tokens.spaceSm - PILL_CHROME, 0);
}

/** A phone's top row counts as measured once both it and what sits at its end have a width; until then its pill's name line is 0, on the cover and above the titles alike. */
export function rowMeasured(row: number, ends: number): boolean {
  return row > 0 && ends > 0;
}

/** The tile and the gap after it, which the white pill over Events, the Calendar and Settings gives its name from AX1, where it is bare. */
export const PILL_TILE = 28 + tokens.spaceSm;

/** The name's line in the white pill above a phone's Events, Calendar and Settings titles from AX1, bare, by the cover's rule (`phoneNameRoom`) with the tile's room given back: 206 on an iPhone 17 Pro with Search and the bell, 258 with the bell alone (sc-92464). */
export function barePhoneNameRoom(row: number, ends: number): number {
  return phoneNameRoom(row + PILL_TILE, ends);
}

/** The name's line in the pill beside the upright iPad's tabs, from the most the pill may take there, 0 until the row is measured (sc-92314). */
export function uprightNameRoom(pill: number | undefined): number {
  return Math.max((pill ?? 0) - PILL_CHROME, 0);
}

/** The invitation line's room under the name: the name's, less its ring and the gap after it. */
export function waitingRoomUnder(name: number): number {
  return Math.max(name - WAITING_RING, 0);
}

/** From AX1 the cover's pill, on the phone and beside the upright iPad's tabs, is its tile alone only where the name's widest word, at its default size, is wider than its line (sc-38149, sc-92247, sc-92314). */
export function wholeTileAlone(widestAtDefault: number, room: number): boolean {
  return room > 0 && widestAtDefault > room;
}

/** The switcher's answer pill: its spinner and the gap after it while sending, and its sides (`Pill` drawn full, `pillFull`, and its border). */
export const ANSWER = {
  spinner: 16 + tokens.spaceSm,
  sides: 2 * tokens.spaceXxl + 2 * 1.5,
  gap: tokens.spaceMd,
} as const;

/** A button is as wide as the wider of its words at rest and its spinner and sending words, so pressing it moves nothing. */
export function answerWidth(rest: number, sending: number): number {
  return ANSWER.sides + Math.max(rest, ANSWER.spinner + sending);
}

/** The two answers share a row only where both fit at their sending width; otherwise each takes the full row, Accept and join first, before anything is pressed. */
export function answersStack(row: number, accept: number, decline: number): boolean {
  return accept + ANSWER.gap + decline > row;
}
