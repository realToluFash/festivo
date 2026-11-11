import { bottomOverKeys } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';

/** How high a step's docked foot reaches above the keys: its button and the gap StepScreen pads it by while they are up. */
export const FOOT_OVER_KEYS = tokens.spaceXl + tokens.sizeHitPhoneHero;

/** How high a step's docked foot reaches above the screen's foot while the keys are down: its button over the inset StepScreen pads it by. */
export function footAtRest(inset: number): number {
  return Math.max(inset, tokens.spaceLg) + tokens.sizeHitPhoneHero;
}

/** The landing toast's bottom: over the inset and the tab bar at rest, and clear of a step's docked foot with the keys up or down (sc-29071, sc-37519). */
export function landingToastBottom(
  inset: number,
  tabBar: number,
  frameHeight: number,
  keyboardTop: number | null,
  onStep: boolean,
): number {
  const overBar = Math.max(inset, tokens.spaceLg) + (tabBar > 0 ? tabBar + tokens.spaceLg : 0);
  const rest = onStep ? Math.max(overBar, footAtRest(inset) + tokens.spaceLg) : overBar;

  return bottomOverKeys(rest, frameHeight, keyboardTop, FOOT_OVER_KEYS + tokens.spaceLg);
}
