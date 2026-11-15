import { describe, expect, it } from 'vitest';

import {
  MEMBERS_PAGE,
  nearsEnd,
  rereadLimit,
  withChanged,
  withNextPage,
  withPagesSince,
} from './membersPaging.ts';

const rows = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, at) => ({ id: `m${from + at}` }));

describe('People a page at a time', () => {
  it('puts the next page under the rows held, takes its counts and keeps the invitations', () => {
    const held = {
      members: rows(1, 2),
      next: 'm2' as string | null,
      counts: 9,
      invitations: ['i1'],
    };
    const page = { members: rows(3, 4), next: null, counts: 8, invitations: [] as string[] };

    expect(withNextPage(held, page)).toEqual({
      members: rows(1, 4),
      next: null,
      counts: 8,
      invitations: ['i1'],
    });
  });

  it('never lists a person twice when the next page overlaps the rows held', () => {
    const held = { members: rows(1, 3), next: 'm3', invitations: [] };

    expect(
      withNextPage(held, { members: rows(3, 4), next: 'm4', invitations: [] }).members,
    ).toEqual(rows(1, 4));
  });

  it('brings a change to somebody past what a read again brings into their row', () => {
    const as = (status: 'active' | 'suspended') => (one: { id: string }) => ({ ...one, status });
    const held = { members: rows(1, 700).map(as('active')), next: 'm700' as string | null };
    const reread = { members: rows(1, 500).map(as('active')), next: 'm500' as string | null };
    const changed: { id: string; status: 'active' | 'suspended' } = {
      id: 'm650',
      status: 'suspended',
    };

    const all = withChanged(reread, held, changed, 'all');
    expect(all.members).toHaveLength(700);
    expect(all.members[649]).toBe(changed);
    expect(all.next).toBe('m700');

    const active = withChanged(reread, held, changed, 'active');
    expect(active.members).toHaveLength(699);
    expect(active.members.some((one) => one.id === 'm650')).toBe(false);
  });

  it('keeps the rows a page brought while a read again was out, and its next', () => {
    const reread = { members: rows(1, 3), next: 'm3' as string | null, counts: 8 };
    const held = { members: rows(1, 5), next: null, counts: 9 };

    expect(withPagesSince(reread, held)).toEqual({ members: rows(1, 5), next: null, counts: 8 });
    expect(withPagesSince(reread, { ...held, members: rows(1, 2) })).toBe(reread);
  });

  it('takes a read again that reached the end as the whole list', () => {
    const reread = { members: rows(1, 3), next: null };

    expect(withPagesSince(reread, { members: rows(1, 4), next: null })).toBe(reread);
  });

  it('reads again at least a page, every row held, and no more than one read brings', () => {
    expect(rereadLimit({ members: rows(1, 3), next: null })).toBe(MEMBERS_PAGE);
    expect(rereadLimit({ members: rows(1, 150), next: 'm150' })).toBe(150);
    expect(rereadLimit({ members: rows(1, 700), next: 'm700' })).toBe(500);
  });

  it('starts the next page once the end is within one screen of the bottom of the view', () => {
    const at = (y: number) =>
      nearsEnd({
        contentOffset: { y },
        contentSize: { height: 4000 },
        layoutMeasurement: { height: 800 },
      });

    expect(at(2399)).toBe(false);
    expect(at(2400)).toBe(true);
  });
});
