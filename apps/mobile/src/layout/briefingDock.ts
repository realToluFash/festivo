import type { LayoutKind } from './classify.ts';

export const BRIEFING_DIALOG_MARGIN = 160;

export interface BriefingDock {
  /** The briefing is a panel at the right edge, not a centred dialog. */
  docked: boolean;
  /** The panel fills its frame; otherwise it takes the height of what it holds. */
  fills: boolean;
  /** How far down an upright dialog grows, from the top of the window to a margin above its foot; null when docked. */
  maxHeight: number | null;
}

export function briefingDock(kind: LayoutKind, windowHeight: number): BriefingDock {
  if (kind === 'tabletLandscape') return { docked: true, fills: true, maxHeight: null };

  return {
    docked: false,
    fills: false,
    maxHeight: windowHeight - BRIEFING_DIALOG_MARGIN,
  };
}
