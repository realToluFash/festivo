import { describe, expect, it } from 'vitest';

import { WEDDING, sampleGuests } from './guests.ts';
import { UNDO_SECONDS, nextCount, putBack, removable, removeGuest } from './guestRemove.ts';
import { goesWith, removedLine } from './guestRemoveRows.ts';

const list = sampleGuests(WEDDING);
const by = (id: string) => list.find((one) => one.id === id)!;

describe('guestRemove (sc-3774)', () => {
  it('Undo puts the guest back in their place, as they were', () => {
    const at = list.findIndex((one) => one.id === 'emeka');
    const after = removeGuest(list, 'emeka');

    expect(after.list).toHaveLength(list.length - 1);
    expect(after.removed?.at).toBe(at);
    expect(putBack(after.list, after.removed!)).toEqual(list);
  });

  it('a Held companion reads Held, and an unnamed one is Guest of', () => {
    expect(goesWith(by('emeka')).map((row) => row.lines[0])).toEqual([
      'Their reply',
      'Companion · Held',
    ]);
    expect(goesWith(by('musa'))[1]?.title).toBe('Guest of Alhaji Musa Bello');
  });

  it('names the companions that went too', () => {
    expect(removedLine(by('emeka'))).toBe('Dr Emeka Nwosu removed, with Adanna Nwosu.');
    expect(removedLine(by('kwame'))).toBe('Kwame Mensah removed.');
  });

  it('holds the count at 10 while held, and counts down once let go', () => {
    expect(nextCount(4, true)).toBe(UNDO_SECONDS);
    expect(nextCount(4, false)).toBe(3);
    expect(nextCount(0, false)).toBe(0);
  });

  it('offers no Remove to an arrived guest or without guests.manage', () => {
    expect(removable(by('kwame'), true)).toBe(true);
    expect(removable(by('kwame'), false)).toBe(false);
    expect(removable({ ...by('kwame'), arrived: '18:05' }, true)).toBe(false);
  });
});
