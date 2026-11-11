import { describe, expect, it } from 'vitest';

import { NAME_ROOM, roomBeside, stacksRows } from './rowArrangement.ts';

describe('a role page arranges its rows by the room it has', () => {
  it('leaves the name what the row keeps after the buttons, their gaps and its own', () => {
    expect(roomBeside(416, [40, 50, 60])).toBe(416 - 8 - (150 + 3 * 28) - 2 * 6);
  });

  it('leaves the whole row less its gap when it has no buttons', () => {
    expect(roomBeside(300, [])).toBe(292);
  });

  it('keeps every row beside its buttons while each keeps the room', () => {
    expect(stacksRows([NAME_ROOM, 300, 200])).toBe(false);
  });

  it('stacks every row once one falls short', () => {
    expect(stacksRows([300, NAME_ROOM - 1, 200])).toBe(true);
  });

  it('keeps rows beside their buttons before any is measured', () => {
    expect(stacksRows([])).toBe(false);
  });
});
