import { describe, expect, it } from 'vitest';

import { tokens } from '../../theme/tokens.ts';
import { arrivedUnder, nameRoomBeside } from './DoorRow.ts';

describe("Check-in's Arrived beside the name or under it (sc-95416)", () => {
  it('stays beside until the row, the button and the widest word are all measured', () => {
    expect(arrivedUnder({ row: 0, button: 140, widest: 400 })).toBe(false);
    expect(arrivedUnder({ row: 335, button: 0, widest: 400 })).toBe(false);
    expect(arrivedUnder({ row: 335, button: 140, widest: 0 })).toBe(false);
  });

  it('stays beside while the widest word fits the name column', () => {
    const room = nameRoomBeside(335, 120);

    expect(arrivedUnder({ row: 335, button: 120, widest: room })).toBe(false);
    expect(arrivedUnder({ row: 335, button: 120, widest: room - 1 })).toBe(false);
  });

  it('moves under the name once the widest word is wider than the column', () => {
    const room = nameRoomBeside(335, 120);

    expect(arrivedUnder({ row: 335, button: 120, widest: room + 1 })).toBe(true);
  });

  it('takes the room from the button as measured, so a longer label gives way sooner', () => {
    expect(nameRoomBeside(335, 120)).toBe(335 - 28 - 120 - 2 * tokens.spaceLg);
    expect(arrivedUnder({ row: 335, button: 120, widest: 150 })).toBe(false);
    expect(arrivedUnder({ row: 335, button: 150, widest: 150 })).toBe(true);
  });

  it('takes the room from the row as measured, so an indented companion gives way sooner', () => {
    expect(arrivedUnder({ row: 335, button: 120, widest: 150 })).toBe(false);
    expect(arrivedUnder({ row: 295, button: 120, widest: 150 })).toBe(true);
  });
});
