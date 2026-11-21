import type { Guest, GuestChange } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { changeLine, changedRows, filterMenuWidth } from './guestChanges.ts';

function guest(id: string, fullName: string, reply: Guest['reply']): Guest {
  return { id, fullName, reply, companions: [], needs: null } as unknown as Guest;
}

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key}(${Object.values(values).join('|')})`) as never;

describe('Changed since you looked (sc-4331)', () => {
  const ADA = guest('g_1', 'Ada Obi', 'coming');
  const TOMI = guest('g_2', 'Tomi Bello', 'noReply');
  const CHANGES: GuestChange[] = [
    { guestId: 'g_2', kind: 'needs', at: '2026-11-02T09:31:00Z' },
    { guestId: 'g_1', kind: 'replied', at: '2026-10-30T10:00:00Z' },
    { guestId: 'gone', kind: 'replied', at: '2026-10-29T10:00:00Z' },
  ];

  it('lists the guests the changes name, in their order, and leaves out one no longer on the list', () => {
    expect(changedRows([ADA, TOMI], CHANGES, '').map((row) => row.person.guest.id)).toEqual([
      'g_2',
      'g_1',
    ]);
    expect(changedRows([ADA, TOMI], CHANGES, 'tomi').map((row) => row.person.guest.id)).toEqual([
      'g_2',
    ]);
  });

  it('shows a needs-only guest by the bell’s label, Changed at its time today', () => {
    const [row] = changedRows([ADA, TOMI], CHANGES, '');

    expect(
      changeLine(t, row!.change, row!.person, 'UTC', 'en-GB', new Date('2026-11-02T12:00:00Z')),
    ).toBe('guestList.changed.line(guestList.changed.needs|guestList.changed.changedAt(09:31))');
  });

  it('widens the menu while its row leads it', () => {
    expect(filterMenuWidth(true)).toBe(300);
    expect(filterMenuWidth(false)).toBe(230);
  });
});
