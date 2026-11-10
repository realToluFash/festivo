import { bottomOverKeys } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';

/** How high a step's docked foot reaches above the keys: its button and the gap StepScreen pads it by while they are up. */
export const FOOT_OVER_KEYS = tokens.spaceXl + tokens.sizeHitPhoneHero;

/** The landing toast's bottom: over the inset and the tab bar at rest, and clear of the step's docked foot once the keys rise (sc-29071). */
export function landingToastBottom(
  inset: number,
  tabBar: number,
  frameHeight: number,
  keyboardTop: number | null,
): number {
  const rest = Math.max(inset, tokens.spaceLg) + (tabBar > 0 ? tabBar + tokens.spaceLg : 0);

  return bottomOverKeys(rest, frameHeight, keyboardTop, FOOT_OVER_KEYS + tokens.spaceLg);
}
