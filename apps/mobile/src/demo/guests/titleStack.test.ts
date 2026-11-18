import { describe, expect, it } from 'vitest';

import { actionsUnder } from './titleStack.ts';

const row = { room: 370, title: 170, extra: 0, plus: 44, bell: 0, gap: 16 };

describe('Export and the + under the title (sc-68417)', () => {
  it('stay beside the title where all three fit', () => {
    expect(actionsUnder({ ...row, extra: 120 })).toBe(false);
  });

  it('go under it where the title would have to break', () => {
    expect(actionsUnder({ ...row, title: 215, extra: 200 })).toBe(true);
  });

  it('fit on exactly the width the row has', () => {
    expect(actionsUnder({ ...row, extra: 124, room: 170 + 16 + 124 + 16 + 44 })).toBe(false);
    expect(actionsUnder({ ...row, extra: 124, room: 170 + 16 + 124 + 16 + 44 - 1 })).toBe(true);
  });

  it('count the bell on its side, with its own gap', () => {
    expect(
      actionsUnder({ ...row, extra: 100, bell: 44, room: 170 + 16 + 100 + 16 + 44 + 16 + 44 }),
    ).toBe(false);
    expect(
      actionsUnder({ ...row, extra: 100, bell: 44, room: 170 + 16 + 100 + 16 + 44 + 16 + 43 }),
    ).toBe(true);
  });

  it('stay beside it until the row and the title are measured', () => {
    expect(actionsUnder({ ...row, extra: 400, room: 0 })).toBe(false);
    expect(actionsUnder({ ...row, extra: 400, title: 0 })).toBe(false);
  });
});
