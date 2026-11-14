import { describe, expect, it } from 'vitest';

import { figuresOf, guestLineOf } from './guestLine.ts';

const WEDDING = {
  onList: 156,
  notYetInvited: 14,
  invited: 142,
  accepted: 96,
  maybe: 10,
  awaitingReply: 21,
  held: 6,
  heldBy: { hostNoReply: 4, hostMaybe: 1, hostNotComing: 1 },
  declined: 9,
};

describe("each event's guest line on Events (sc-3786)", () => {
  it("counts the guests who owe an answer and the companions held behind them as haven't replied", () => {
    expect(figuresOf(WEDDING)).toEqual({ invited: 142, coming: 96, notReplied: 25 });
  });

  it('shows on a live, happening or paused event with invited guests, and nowhere else', () => {
    const figures = figuresOf(WEDDING);

    expect(guestLineOf(figures, 'live')).toEqual(figures);
    expect(guestLineOf(figures, 'happening_now')).toEqual(figures);
    expect(guestLineOf(figures, 'paused')).toEqual(figures);
    expect(guestLineOf(figures, 'draft')).toBeNull();
    expect(guestLineOf(figures, 'finished')).toBeNull();
    expect(guestLineOf({ invited: 0, coming: 0, notReplied: 0 }, 'live')).toBeNull();
    expect(guestLineOf(null, 'live')).toBeNull();
  });

  it('keeps a figure at 0 on an event with invited guests', () => {
    expect(guestLineOf({ invited: 3, coming: 0, notReplied: 3 }, 'live')).toEqual({
      invited: 3,
      coming: 0,
      notReplied: 3,
    });
  });
});
