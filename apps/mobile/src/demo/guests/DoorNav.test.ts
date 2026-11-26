import { describe, expect, it } from 'vitest';

import { tokens } from '../../theme/tokens.ts';
import { navSide, titleBeside } from './DoorNav.ts';

describe("the door's title beside the back pill or under it (sc-31780)", () => {
  it('stays beside until the bar, the pill and the title are all measured', () => {
    expect(titleBeside({ width: 0, back: 80, title: 400 })).toBe(true);
    expect(titleBeside({ width: 390, back: 0, title: 400 })).toBe(true);
    expect(titleBeside({ width: 390, back: 80, title: 0 })).toBe(true);
  });

  it('stays beside while the title fits between the pill and its mirror', () => {
    const width = 390;
    const back = 80;
    const room = width - 2 * navSide(back);

    expect(titleBeside({ width, back, title: room })).toBe(true);
    expect(titleBeside({ width, back, title: room - 1 })).toBe(true);
  });

  it('moves under the pill once the title is wider than that room', () => {
    const width = 390;
    const back = 80;
    const room = width - 2 * navSide(back);

    expect(titleBeside({ width, back, title: room + 1 })).toBe(false);
  });

  it('leaves the room from the pill as measured, not from a fixed offset', () => {
    expect(navSide(80)).toBe(tokens.spaceSm + 80 + tokens.spaceXl);
    expect(titleBeside({ width: 390, back: 160, title: 120 })).toBe(false);
    expect(titleBeside({ width: 390, back: 60, title: 120 })).toBe(true);
  });
});
