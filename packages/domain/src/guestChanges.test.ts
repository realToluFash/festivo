import type { Guest } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';
import { type GuestListChange, changeAnswer, changeWhen, changedRows } from './guestChanges.ts';

function guest(id: string, fullName: string, reply: Guest['reply']): Guest {
  return { id, fullName, reply, companions: [], needs: null } as unknown as Guest;
}

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key}(${Object.values(values).join('|')})`) as never;

describe('Changed since you looked (sc-4331)', () => {
  const ADA = guest('g_1', 'Ada Obi', 'coming');
  const TOMI = guest('g_2', 'Tomi Bello', 'noReply');
  const CHANGES: GuestListChange[] = [
    { guestId: 'g_2', kind: 'needs', at: '2026-11-02T09:31:00Z' },
    { guestId: 'g_1', kind: 'replied', at: '2026-10-30T10:00:00Z' },
    { guestId: 'gone', kind: 'replied', at: '2026-10-29T10:00:00Z' },
  ];
  const NOON = new Date('2026-11-02T12:00:00Z');

  it('lists the guests the changes name, in their order, and leaves out one no longer on the list', () => {
    expect(changedRows([ADA, TOMI], CHANGES, '').map((row) => row.person.guest.id)).toEqual([
      'g_2',
      'g_1',
    ]);
    expect(changedRows([ADA, TOMI], CHANGES, 'tomi').map((row) => row.person.guest.id)).toEqual([
      'g_2',
    ]);
  });

  it('shows a needs-only guest by the bell’s label and a reply in the list’s words', () => {
    const [tomi, ada] = changedRows([ADA, TOMI], CHANGES, '');

    expect(changeAnswer(t, tomi!.change, tomi!.person)).toBe('guestList.changed.needs');
    expect(changeAnswer(t, ada!.change, ada!.person)).toBe('guestList.reply.coming');
  });

  it('says the time today in the event’s zone and the day before it, Replied only for a first reply', () => {
    const [needs, replied] = CHANGES;

    expect(changeWhen(t, needs!, 'UTC', 'en-GB', NOON)).toBe('guestList.changed.changedAt(09:31)');
    expect(changeWhen(t, replied!, 'UTC', 'en-GB', NOON)).toBe(
      'guestList.changed.repliedOn(30 Oct)',
    );
    expect(changeWhen(t, needs!, 'Pacific/Honolulu', 'en-GB', NOON)).toBe(
      'guestList.changed.changedOn(1 Nov)',
    );
  });
});
