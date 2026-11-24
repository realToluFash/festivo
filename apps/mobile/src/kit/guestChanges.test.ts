import type { Guest } from '@soirely/api-client';
import { changedRows } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { changeLine, filterMenuWidth, readerZoneOf } from './guestChanges.ts';

function guest(id: string, fullName: string, reply: Guest['reply']): Guest {
  return { id, fullName, reply, companions: [], needs: null } as unknown as Guest;
}

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key}(${Object.values(values).join('|')})`) as never;

describe('Changed since you looked on the app (sc-4331)', () => {
  const ADA = guest('g_1', 'Ada Obi', 'coming');
  const TOMI = guest('g_2', 'Tomi Bello', 'noReply');
  const CHANGES = [{ guestId: 'g_2', kind: 'needs', at: '2026-11-02T09:31:00Z' } as const];

  it('shows a needs-only guest by the bell’s label, Changed at its time today', () => {
    const [row] = changedRows([ADA, TOMI], CHANGES, '');

    expect(
      changeLine(t, row!.change, row!.person, 'UTC', 'en-GB', new Date('2026-11-02T12:00:00Z')),
    ).toBe('guestList.changed.line(guestList.changed.needs|guestList.changed.changedAt(09:31))');
  });

  it('dates a change by the member’s zone, so a late reply in Lagos is the next day in Tokyo', () => {
    const late = { guestId: 'g_1', kind: 'replied', at: '2026-10-30T20:00:00Z' } as const;
    const [row] = changedRows([ADA], [late], '');
    const now = new Date('2026-11-02T12:00:00Z');

    expect(changeLine(t, row!.change, row!.person, readerZoneOf('Asia/Tokyo'), 'en-GB', now)).toBe(
      'guestList.changed.line(guestList.reply.coming|guestList.changed.repliedOn(31 Oct))',
    );
  });

  it('reads in the device’s zone while the account has none', () => {
    expect(readerZoneOf(null)).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(readerZoneOf('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('widens the menu while its row leads it', () => {
    expect(filterMenuWidth(true)).toBe(300);
    expect(filterMenuWidth(false)).toBe(230);
  });
});
