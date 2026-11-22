export interface TouchPoint {
  pageX?: number;
  pageY?: number;
}

/** How far a finger may wander and still be a tap, as far as UIKit lets a scroll view's touch travel before it takes it. */
const TAP_SLOP = 10;

/** A press began at `from` and ended at `to` without the finger moving the list under it; a press with no place, a screen reader's, is still. */
export function stillTouch(from: TouchPoint | null, to: TouchPoint): boolean {
  if (from?.pageX == null || from.pageY == null || to.pageX == null || to.pageY == null) {
    return true;
  }

  return Math.hypot(to.pageX - from.pageX, to.pageY - from.pageY) <= TAP_SLOP;
}
