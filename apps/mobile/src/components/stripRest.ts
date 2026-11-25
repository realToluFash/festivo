import { tokens } from '../theme/tokens.ts';

/** The demo's AreaPills rule (sc-31370): at the start while the chosen pill fits, never past the end. */
export function stripRest(end: number, shown: number, content: number): number {
  return Math.max(0, Math.min(content - shown, end + tokens.space3xl - shown));
}
