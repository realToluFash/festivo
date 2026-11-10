import { describe, expect, it } from 'vitest';

import { landedStep, stepShown, stepsSoFar } from './landedStep.ts';

describe('the step the landing toast keeps to (sc-37519)', () => {
  it('is the step shown last, with where its foot sits once placed', () => {
    const under = stepShown();
    const front = stepShown();
    front.placed({ x: 144, width: 480 });

    expect(landedStep()?.column).toEqual({ x: 144, width: 480 });

    front.left();
    under.left();
  });

  it('falls back to the step beneath as the one in front leaves', () => {
    const under = stepShown();
    under.placed({ x: 24, width: 320 });
    const front = stepShown();
    front.left();

    expect(landedStep()?.column).toEqual({ x: 24, width: 320 });

    under.left();
    expect(landedStep()).toBeNull();
  });

  it('keeps the same snapshot when placed where it already was', () => {
    const step = stepShown();
    step.placed({ x: 24, width: 320 });
    const before = landedStep();
    step.placed({ x: 24, width: 320 });

    expect(landedStep()).toBe(before);

    step.left();
  });

  it('leaves out the step a toast was said from, still in front as the flow moves on', () => {
    const from = stepShown();
    from.placed({ x: 144, width: 480 });
    const said = stepsSoFar();

    expect(landedStep(said)).toBeNull();

    const landed = stepShown();
    landed.placed({ x: 24, width: 720 });
    from.left();

    expect(landedStep(said)?.column).toEqual({ x: 24, width: 720 });

    landed.left();
  });
});
