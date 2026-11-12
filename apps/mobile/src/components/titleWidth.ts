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
