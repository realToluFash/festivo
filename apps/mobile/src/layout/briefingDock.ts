import type { LayoutKind } from './classify.ts';

export const BRIEFING_DIALOG_MAX_HEIGHT = 640;

export const BRIEFING_DIALOG_MARGIN = 160;

export interface BriefingDock {
  /** The briefing is a panel at the right edge, not a centred dialog. */
  docked: boolean;
  /** The roster stays on the page beside the panel instead of being covered by it. */
  rosterBeside: boolean;
  /** The panel fills its frame; otherwise it takes the height of what it holds. */
  fills: boolean;
  /** The tallest an upright dialog grows; null when docked. */
  maxHeight: number | null;
}

export function briefingDock(kind: LayoutKind, windowHeight: number): BriefingDock {
  if (kind === 'tabletLandscape')
    return { docked: true, rosterBeside: true, fills: true, maxHeight: null };

  return {
    docked: false,
    rosterBeside: false,
    fills: false,
    maxHeight: Math.min(BRIEFING_DIALOG_MAX_HEIGHT, windowHeight - BRIEFING_DIALOG_MARGIN),
  };
}
