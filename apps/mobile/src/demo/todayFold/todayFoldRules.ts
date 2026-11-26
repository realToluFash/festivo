/** How far the phone's tab bar fade reaches up from the screen's foot, as main draws it (`TabBarFade`). */
export const TAB_FADE = 150;

export const OPEN_ABOVE_SHEET = 22;

export const BAND_COMES = 24;
export const WORDS_GO = 96;

export interface Fold {
  coverFoot: number;
  sheetRise: number;
  /** On the screen, the status bar included. */
  bandFoot: number;
  screen: number;
}

export function foldAt({ coverFoot, sheetRise, bandFoot }: Fold): number {
  return coverFoot - sheetRise - bandFoot;
}

/** The scroll at which Open the event's foot sits at the top of the tab bar's fade, or null where it is already there at the top of the page. */
export function reachAt(fold: Fold): number | null {
  const openFoot = fold.coverFoot - fold.sheetRise - OPEN_ABOVE_SHEET;
  const reach = Math.ceil(openFoot - (fold.screen - TAB_FADE));

  return reach > 0 && reach < foldAt(fold) - BAND_COMES ? reach : null;
}

/** sc-95084: where Today comes to rest on the phone. Open at the top and folded, as on main; and where the cover is taller than the screen, between them, with Open the event whole above the tabs. */
export function restingPlaces(fold: Fold): number[] {
  const reach = reachAt(fold);
  const folded = foldAt(fold);

  return reach == null ? [0, folded] : [0, reach, folded];
}

/** Where the cover's words start to go: main's 96 before the band comes, but never before the resting place that holds Open the event, so it rests at its full ink. */
export function wordsGoFrom(fold: Fold): number {
  const reach = reachAt(fold) ?? 0;

  return Math.max(0, reach, foldAt(fold) - BAND_COMES - WORDS_GO);
}
