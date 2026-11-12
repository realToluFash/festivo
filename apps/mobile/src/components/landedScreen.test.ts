import { describe, expect, it } from 'vitest';

import { homeShown, landedScreen, shownSoFar, stepShown } from './landedScreen.ts';

describe('the screen the landing toast keeps to (sc-37519)', () => {
  it('starts a new step with no foot placed, not yet landed', () => {
    const step = stepShown();

    expect(landedScreen()).toMatchObject({ landed: false, foot: null });

    step.left();
  });

  it('lands a step with no foot once it says so (sc-39703)', () => {
    const step = stepShown();
    step.placed(null);

    expect(landedScreen()).toMatchObject({ home: false, landed: true, foot: null });

    step.left();
  });

  it('lands Home as it is shown (sc-39703)', () => {
    const left = homeShown();

    expect(landedScreen()).toMatchObject({ home: true, landed: true, foot: null });

    left();
    expect(landedScreen()).toBeNull();
  });

  it('has nothing landed between the step a toast was said from leaving and the next one landing (sc-39703)', () => {
    const from = stepShown();
    from.placed({ x: 24, width: 320, top: 900 });
    const said = shownSoFar();
    from.left();

    expect(landedScreen(said)).toBeNull();

    const next = stepShown();

    expect(landedScreen(said)?.landed).toBe(false);

    next.placed({ x: 24, width: 320, top: 900 });

    expect(landedScreen(said)?.landed).toBe(true);

    next.left();
  });

  it('says again where its foot sits once the keys move it, or it moves into the page (sc-37983)', () => {
    const step = stepShown();
    step.placed({ x: 24, width: 320, top: 900 });
    step.placed({ x: 24, width: 320, top: 480 });

    expect(landedScreen()?.foot?.top).toBe(480);

    step.placed({ x: 24, width: 320, top: null });

    expect(landedScreen()?.foot?.top).toBeNull();

    step.left();
  });

  it('is the step shown last, with where its foot sits once placed', () => {
    const under = stepShown();
    const front = stepShown();
    front.placed({ x: 144, width: 480, top: 900 });

    expect(landedScreen()?.foot).toEqual({ x: 144, width: 480, top: 900 });

    front.left();
    under.left();
  });

  it('falls back to the step beneath as the one in front leaves', () => {
    const under = stepShown();
    under.placed({ x: 24, width: 320, top: 900 });
    const front = stepShown();
    front.left();

    expect(landedScreen()?.foot).toEqual({ x: 24, width: 320, top: 900 });

    under.left();
    expect(landedScreen()).toBeNull();
  });

  it('keeps the same snapshot when placed where it already was', () => {
    const step = stepShown();
    step.placed({ x: 24, width: 320, top: 900 });
    const before = landedScreen();
    step.placed({ x: 24, width: 320, top: 900 });

    expect(landedScreen()).toBe(before);

    step.left();
  });

  it('leaves out the step a toast was said from, still in front as the flow moves on', () => {
    const from = stepShown();
    from.placed({ x: 144, width: 480, top: 900 });
    const said = shownSoFar();

    expect(landedScreen(said)).toBeNull();

    const landed = stepShown();
    landed.placed({ x: 24, width: 720, top: 900 });
    from.left();

    expect(landedScreen(said)?.foot).toEqual({ x: 24, width: 720, top: 900 });

    landed.left();
  });
});
