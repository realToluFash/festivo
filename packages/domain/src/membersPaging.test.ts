import { describe, expect, it } from 'vitest';

import { MEMBERS_PAGE, rereadLimit, withNextPage } from './membersPaging.ts';

const rows = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, at) => ({ id: `m${from + at}` }));

describe('People a page at a time', () => {
  it('puts the next page under the rows held and takes its counts', () => {
    const held = { members: rows(1, 2), next: 'm2', counts: 9 };
    const page = { members: rows(3, 4), next: null, counts: 8 };

    expect(withNextPage(held, page)).toEqual({ members: rows(1, 4), next: null, counts: 8 });
  });

  it('never lists a person twice when the next page overlaps the rows held', () => {
    const held = { members: rows(1, 3), next: 'm3' };

    expect(withNextPage(held, { members: rows(3, 4), next: 'm4' }).members).toEqual(rows(1, 4));
  });

  it('reads again at least a page, every row held, and no more than one read brings', () => {
    expect(rereadLimit({ members: rows(1, 3), next: null })).toBe(MEMBERS_PAGE);
    expect(rereadLimit({ members: rows(1, 150), next: 'm150' })).toBe(150);
    expect(rereadLimit({ members: rows(1, 700), next: 'm700' })).toBe(500);
  });
});
