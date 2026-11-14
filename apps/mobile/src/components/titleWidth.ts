export interface TitleWidth {
  width: number | null;
  key: number;
}

export const UNMEASURED_TITLE: TitleWidth = { width: null, key: 0 };

/** The title's key changes when its row lays out at a new width, so Android measures the title again rather than keep a width from before a rotation (sc-40664). */
export function titleAtWidth(last: TitleWidth, laidOut: number): TitleWidth {
  const width = Math.round(laidOut);
  if (last.width == null || last.width === width) return { width, key: last.key };
  return { width, key: last.key + 1 };
}

/** Android sizes a title by its letters' advance and draws it by their ink, which ends past the advance after a y or a k, so the title breaks inside the width it measured and its last word drops; a hair space after it, which no line keeps, gives the ink that room (sc-41787). A selectable title is left as it is, so a copied DNS value carries no hair space. */
export function titleWithInkRoom(title: string, os: string, selectable = false): string {
  return os === 'android' && !selectable ? `${title}\u200A` : title;
}
