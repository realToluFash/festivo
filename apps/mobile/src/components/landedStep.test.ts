import { describe, expect, it } from 'vitest';

import { landedStep, stepShown, stepsSoFar } from './landedStep.ts';

describe('the step the landing toast keeps to (sc-37519)', () => {
  it('has no foot to rest on until it has landed and been placed (sc-37983)', () => {
    const step = stepShown();

    expect(landedStep()?.foot).toBeNull();

    step.left();
  });

  it('says again where its foot sits once the keys move it, or it moves into the page (sc-37983)', () => {
    const step = stepShown();
    step.placed({ x: 24, width: 320, top: 900 });
    step.placed({ x: 24, width: 320, top: 480 });

    expect(landedStep()?.foot?.top).toBe(480);

    step.placed({ x: 24, width: 320, top: null });

    expect(landedStep()?.foot?.top).toBeNull();

    step.left();
  });

  it('is the step shown last, with where its foot sits once placed', () => {
    const under = stepShown();
    const front = stepShown();
    front.placed({ x: 144, width: 480, top: 900 });

    expect(landedStep()?.foot).toEqual({ x: 144, width: 480, top: 900 });

    front.left();
    under.left();
  });

  it('falls back to the step beneath as the one in front leaves', () => {
    const under = stepShown();
    under.placed({ x: 24, width: 320, top: 900 });
    const front = stepShown();
    front.left();

    expect(landedStep()?.foot).toEqual({ x: 24, width: 320, top: 900 });

    under.left();
    expect(landedStep()).toBeNull();
  });

  it('keeps the same snapshot when placed where it already was', () => {
    const step = stepShown();
    step.placed({ x: 24, width: 320, top: 900 });
    const before = landedStep();
    step.placed({ x: 24, width: 320, top: 900 });

    expect(landedStep()).toBe(before);

    step.left();
  });

  it('leaves out the step a toast was said from, still in front as the flow moves on', () => {
    const from = stepShown();
    from.placed({ x: 144, width: 480, top: 900 });
    const said = stepsSoFar();

    expect(landedStep(said)).toBeNull();

    const landed = stepShown();
    landed.placed({ x: 24, width: 720, top: 900 });
    from.left();

    expect(landedStep(said)?.foot).toEqual({ x: 24, width: 720, top: 900 });

    landed.left();
  });
});
