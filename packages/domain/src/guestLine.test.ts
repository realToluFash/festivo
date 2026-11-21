import type { ListedEvent } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  followedIds,
  guestLineOf,
  sharePercent,
  todayArrivalsOf,
  todayRepliesOf,
  withFiguresFrom,
} from './guestLine.ts';

const event = (id: string, guests: ListedEvent['guests']) =>
  ({ id, name: id, milestones: [], guests }) as unknown as ListedEvent;

describe("each event's guest line on Events (sc-3786)", () => {
  it('shows on a live, happening or paused event with invited guests, and nowhere else', () => {
    const figures = { invited: 142, coming: 96, notReplied: 25, attended: 0, expected: 0 };

    expect(guestLineOf(figures, 'live')).toEqual(figures);
    expect(guestLineOf(figures, 'happening_now')).toEqual(figures);
    expect(guestLineOf(figures, 'paused')).toEqual(figures);
    expect(guestLineOf(figures, 'draft')).toBeNull();
    expect(guestLineOf(figures, 'finished')).toBeNull();
    expect(
      guestLineOf({ invited: 0, coming: 0, notReplied: 0, attended: 0, expected: 0 }, 'live'),
    ).toBeNull();
    expect(guestLineOf(null, 'live')).toBeNull();
  });

  it('keeps a figure at 0 on an event with invited guests', () => {
    expect(
      guestLineOf({ invited: 3, coming: 0, notReplied: 3, attended: 0, expected: 0 }, 'live'),
    ).toEqual({
      invited: 3,
      coming: 0,
      notReplied: 3,
      attended: 0,
      expected: 0,
    });
  });

  it('follows the events it read figures for', () => {
    expect(
      followedIds([
        event('a', { invited: 2, coming: 1, notReplied: 1, attended: 0, expected: 0 }),
        event('b', null),
      ]),
    ).toEqual(['a']);
  });

  it('takes the figures read again onto their events and leaves the rest as they were', () => {
    const was = [
      event('a', { invited: 142, coming: 96, notReplied: 25, attended: 0, expected: 0 }),
      event('b', { invited: 3, coming: 0, notReplied: 3, attended: 0, expected: 0 }),
    ];
    const next = withFiguresFrom(was, [
      event('a', { invited: 142, coming: 97, notReplied: 24, attended: 0, expected: 0 }),
    ]);

    expect(next.map((one) => one.guests)).toEqual([
      { invited: 142, coming: 97, notReplied: 24, attended: 0, expected: 0 },
      { invited: 3, coming: 0, notReplied: 3, attended: 0, expected: 0 },
    ]);
    expect(next[1]).toBe(was[1]);
  });
});

describe("Today's replies line (sc-29881)", () => {
  it('reads the wedding as Events does: 117 of 142 replied, 82%', () => {
    expect(
      todayRepliesOf({ invited: 142, coming: 96, notReplied: 25, attended: 0, expected: 0 }, false),
    ).toEqual({
      kind: 'replies',
      coming: 96,
      percent: 82,
    });
  });

  it('reads 0% with nobody replied, and Invitations not sent with nobody invited', () => {
    expect(
      todayRepliesOf({ invited: 40, coming: 0, notReplied: 40, attended: 0, expected: 0 }, false),
    ).toEqual({
      kind: 'replies',
      coming: 0,
      percent: 0,
    });
    expect(
      todayRepliesOf({ invited: 0, coming: 0, notReplied: 0, attended: 0, expected: 0 }, false),
    ).toEqual({
      kind: 'notSent',
    });
  });

  it('shows nothing on a draft or without figures', () => {
    expect(
      todayRepliesOf({ invited: 142, coming: 96, notReplied: 25, attended: 0, expected: 0 }, true),
    ).toBeNull();
    expect(
      todayRepliesOf({ invited: 0, coming: 0, notReplied: 0, attended: 0, expected: 0 }, true),
    ).toBeNull();
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

describe("Today's arrived figure (sc-29978)", () => {
  const figures = (coming: number, attended: number, expected: number) => ({
    invited: 152,
    coming,
    notReplied: 0,
    attended,
    expected,
  });

  it('reads attended of expected, its bar rounded down so it is full only when everyone Coming has arrived', () => {
    expect(todayArrivalsOf(figures(152, 141, 152))).toEqual({
      kind: 'of',
      attended: 141,
      expected: 152,
      percent: 92,
    });
    expect(todayArrivalsOf(figures(1250, 1249, 1250))).toMatchObject({ percent: 99 });
    expect(todayArrivalsOf(figures(152, 153, 153))).toMatchObject({ percent: 100 });
    expect(todayArrivalsOf(figures(1250, 1, 1250))).toMatchObject({ percent: 1 });
  });

  it('reads attended alone with nobody Coming', () => {
    expect(todayArrivalsOf(figures(0, 37, 37))).toEqual({ kind: 'alone', attended: 37 });
  });

  it('is not there while nobody has arrived, or without figures', () => {
    expect(todayArrivalsOf(figures(152, 0, 152))).toBeNull();
    expect(todayArrivalsOf(null)).toBeNull();
    expect(todayArrivalsOf(undefined)).toBeNull();
  });
});
