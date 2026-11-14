import type { ListedEvent } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { followedIds, withFiguresFrom } from './guestLine.ts';

const event = (id: string, guests: ListedEvent['guests']) =>
  ({ id, name: id, milestones: [], guests }) as unknown as ListedEvent;

describe("each event's guest line on Events (sc-3786)", () => {
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
