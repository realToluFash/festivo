import { describe, expect, it } from 'vitest';

import { SWITCHER_BOARDS } from './OrgSwitcherBoards.ts';
import { SWITCHER_STATES, switcherStateOf } from './OrgSwitcherModel.ts';

describe('the demo home’s switcher group', () => {
  it('links every state ?switcher= opens, once each', () => {
    expect(SWITCHER_BOARDS.map((board) => board.state)).toEqual([...SWITCHER_STATES]);
  });

  it('opens each link in the state it names', () => {
    for (const board of SWITCHER_BOARDS) {
      const param = new URLSearchParams(board.href.split('?')[1]).get('switcher') ?? undefined;
      expect(switcherStateOf(param)).toBe(board.state);
    }
  });
});
