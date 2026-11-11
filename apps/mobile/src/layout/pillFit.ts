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

/** The switcher's answer pill: its spinner and the gap after it while sending, and its sides (`Pill`, not full). */
export const ANSWER = {
  spinner: 16 + tokens.spaceSm,
  sides: 2 * 22 + 2 * 1.5,
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
