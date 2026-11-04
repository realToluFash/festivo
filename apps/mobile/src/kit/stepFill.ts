/** How full the step bar is on step `step` of `steps`: never quite full until the flow ends. */
export function stepFill(step: number, steps: number): number {
  if (steps <= 0) return 0;

  return Math.min(1, Math.max(0, step / (steps + 0.5)));
}
