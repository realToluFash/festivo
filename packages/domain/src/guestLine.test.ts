import type { ListedEvent } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  followedIds,
  guestLineOf,
  sharePercent,
  todayRepliesOf,
  withFiguresFrom,
} from './guestLine.ts';

const event = (id: string, guests: ListedEvent['guests']) =>
  ({ id, name: id, milestones: [], guests }) as unknown as ListedEvent;

describe("each event's guest line on Events (sc-3786)", () => {
  it('shows on a live, happening or paused event with invited guests, and nowhere else', () => {
    const figures = { invited: 142, coming: 96, notReplied: 25 };

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

  it('follows the events it read figures for', () => {
    expect(
      followedIds([event('a', { invited: 2, coming: 1, notReplied: 1 }), event('b', null)]),
    ).toEqual(['a']);
  });

  it('takes the figures read again onto their events and leaves the rest as they were', () => {
    const was = [
      event('a', { invited: 142, coming: 96, notReplied: 25 }),
      event('b', { invited: 3, coming: 0, notReplied: 3 }),
    ];
    const next = withFiguresFrom(was, [event('a', { invited: 142, coming: 97, notReplied: 24 })]);

    expect(next.map((one) => one.guests)).toEqual([
      { invited: 142, coming: 97, notReplied: 24 },
      { invited: 3, coming: 0, notReplied: 3 },
    ]);
    expect(next[1]).toBe(was[1]);
  });
});

describe("Today's replies line (sc-29881)", () => {
  it('reads the wedding as Events does: 117 of 142 replied, 82%', () => {
    expect(todayRepliesOf({ invited: 142, coming: 96, notReplied: 25 }, false)).toEqual({
      kind: 'replies',
      coming: 96,
      percent: 82,
    });
  });

  it('reads 0% with nobody replied, and Invitations not sent with nobody invited', () => {
    expect(todayRepliesOf({ invited: 40, coming: 0, notReplied: 40 }, false)).toEqual({
      kind: 'replies',
      coming: 0,
      percent: 0,
    });
    expect(todayRepliesOf({ invited: 0, coming: 0, notReplied: 0 }, false)).toEqual({
      kind: 'notSent',
    });
  });

  it('shows nothing on a draft or without figures', () => {
    expect(todayRepliesOf({ invited: 142, coming: 96, notReplied: 25 }, true)).toBeNull();
    expect(todayRepliesOf({ invited: 0, coming: 0, notReplied: 0 }, true)).toBeNull();
    expect(todayRepliesOf(null, false)).toBeNull();
    expect(todayRepliesOf(undefined, false)).toBeNull();
  });

  it('rounds to the nearest percent, a half up, reading 100% and 0% only for everyone and nobody', () => {
    expect(sharePercent(1, 300)).toBe(1);
    expect(sharePercent(151, 152)).toBe(99);
    expect(sharePercent(152, 152)).toBe(100);
    expect(sharePercent(0, 152)).toBe(0);
    expect(sharePercent(1, 8)).toBe(13);
    expect(sharePercent(3, 200)).toBe(2);
  });
});
