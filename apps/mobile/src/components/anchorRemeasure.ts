export interface AnchorFrame {
  width: number;
  height: number;
  /** Where the frame's body starts, which the offline band moves. */
  bodyTop: number;
}

/** How long an open menu waits to measure its opener again: a turned window once it settles, a moved body at once; null when nothing it hangs from has moved. */
export function remeasureAfter(
  was: AnchorFrame,
  now: AnchorFrame,
  open: boolean,
  settledMs: number,
): number | null {
  if (!open) return null;
  if (was.width !== now.width || was.height !== now.height) return settledMs;
  if (was.bodyTop !== now.bodyTop) return 0;
  return null;
}
