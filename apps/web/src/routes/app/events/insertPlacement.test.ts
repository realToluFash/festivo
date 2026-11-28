import { describe, expect, it } from 'vitest';

import { insertOpensUnder } from './insertPlacement.ts';

const button = (top: number) => new DOMRect(0, top, 90, 40);
const shown = { top: 64, bottom: 900 };

describe('insertOpensUnder', () => {
  it('opens above when the composer sits at the foot of the pane', () => {
    expect(insertOpensUnder(button(780), shown, 300)).toBe(false);
  });

  it('opens under when the composer sits at the top of the pane, with no room above for the menu', () => {
    expect(insertOpensUnder(button(180), shown, 300)).toBe(true);
  });

  it('stays above when neither side fits and above has more room', () => {
    expect(insertOpensUnder(button(500), { top: 64, bottom: 600 }, 500)).toBe(false);
  });
});
