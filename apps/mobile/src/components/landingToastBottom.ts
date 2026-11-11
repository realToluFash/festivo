import { bottomOverKeys } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';
import type { LandedStep } from './landedStep.ts';
import type { FieldInSight } from './landingToastTop.ts';

/** How far over the keys the toast rides where no step's foot is measured, as it did before feet were measured (sc-29071). */
export const UNMEASURED_OVER_KEYS = tokens.spaceXl + tokens.sizeHitPhoneHero + tokens.spaceLg;

/** What the toast clears besides the tab bar: no step's foot, a step's foot that has moved into the page, or how far a step's docked foot reaches above the toast's frame's bottom, as measured. */
export type UnderToast = 'noFoot' | 'footInPage' | { footReaches: number };

/** The toast's frame in the window the foot is measured in, which on Android can start below the status bar. */
export interface Frame {
  y: number;
  height: number;
}

/** What a landed step puts under the toast, its measured foot read against the toast's own frame (sc-29071, sc-37983). */
export function underToast(step: LandedStep | null, frame: Frame): UnderToast {
  if (step?.foot == null) return 'noFoot';
  if (step.foot.top == null) return 'footInPage';

  return { footReaches: frame.y + frame.height - step.foot.top };
}

/** The landing toast's bottom: over the inset and the tab bar, and on a step, which covers the tab bar, 12pt above its docked foot wherever it was measured, or 12pt above the keys where the foot has moved into the page (sc-29071, sc-37519, sc-37983). */
export function landingToastBottom(
  inset: number,
  tabBar: number,
  frameHeight: number,
  keyboardTop: number | null,
  under: UnderToast,
): number {
  const overInset = Math.max(inset, tokens.spaceLg);
  if (under === 'noFoot') {
    const overBar = overInset + (tabBar > 0 ? tabBar + tokens.spaceLg : 0);

    return bottomOverKeys(overBar, frameHeight, keyboardTop, UNMEASURED_OVER_KEYS);
  }
  if (under === 'footInPage')
    return bottomOverKeys(overInset, frameHeight, keyboardTop, tokens.spaceLg);

  return Math.max(overInset, under.footReaches + tokens.spaceLg);
}

/** Whether the toast steps aside: with the keys up, where the focused field whole, lifted to 12pt under the scroll's top and with 12pt under it, reaches below the toast's top (sc-37983). */
export function stepsAside(
  keyboardTop: number | null,
  field: FieldInSight | null,
  toastTop: number | null,
): boolean {
  if (keyboardTop == null || field == null || toastTop == null) return false;

  return field.top + tokens.spaceLg + field.height + tokens.spaceLg > toastTop;
}
