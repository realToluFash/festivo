import type { CheckIn, CheckInGuest } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  isCheckInCode,
  scanned,
  sendWaiting,
  unwait,
  waitFor,
  withWaiting,
  type WaitingArrival,
} from './doorScan.ts';

const CODE_DIGEST = 'a'.repeat(64);

function guest(id: string, more: Partial<CheckInGuest> = {}): CheckInGuest {
  return {
    id,
    fullName: id,
    reply: 'coming',
    repliedAt: '2030-11-01T10:00:00+01:00',
    code: null,
    walkIn: false,
    arrival: null,
    companions: [],
    ...more,
  };
}

const ADAEZE = guest('adaeze', {
  code: CODE_DIGEST,
  companions: [
    { id: 'obi', fullName: 'Obi', state: 'coming', arrival: null },
    { id: 'held', fullName: null, state: 'held', arrival: null },
  ],
});

const LIST: CheckIn = {
  state: 'open',
  opensAt: '2030-11-14T14:00:00+01:00',
  timeZone: 'Africa/Lagos',
  count: { attended: 0, expected: 3 },
  guests: [ADAEZE, guest('musa', { code: 'b'.repeat(64) })],
};

const ON_SEVEN: WaitingArrival = { guestId: 'adaeze', at: '2030-11-14T19:00:00+01:00', by: 'Ana' };

describe("the door's scan (sc-1301)", () => {
  it('takes 43 base64url characters as a code and nothing else a camera reads', () => {
    expect(isCheckInCode('q2k9tD0tX3vYb1mLw7pZc4sRf8hJn6aE5uGi0oKy2Vx')).toBe(true);
    expect(isCheckInCode('https://soirely.com/d/ABCD-1234')).toBe(false);
    expect(isCheckInCode('q2k9tD0tX3vYb1mLw7pZc4sRf8hJn6aE5uGi0oKy2V')).toBe(false);
  });

  it('brings up the guest and their companions by the digest, held ones held', () => {
    const read = scanned(LIST, CODE_DIGEST);

    expect(read.kind).toBe('guest');
    if (read.kind !== 'guest') return;
    expect(read.guest.id).toBe('adaeze');
    expect(read.companions.map((one) => one.state)).toEqual(['coming', 'held']);
    expect([read.arrived, read.notComingSince]).toEqual([null, null]);
  });

  it('says when, and who, for a guest already in', () => {
    const arrival = { at: '2030-11-14T18:12:00+01:00', by: 'Ana Souza' };
    const list = { ...LIST, guests: [{ ...ADAEZE, arrival }] };

    expect(scanned(list, CODE_DIGEST)).toMatchObject({ kind: 'guest', arrived: arrival });
  });

  it('names the date of a reply now Not coming', () => {
    const list = { ...LIST, guests: [{ ...ADAEZE, reply: 'notComing' as const }] };

    expect(scanned(list, CODE_DIGEST)).toMatchObject({
      notComingSince: '2030-11-01T10:00:00+01:00',
    });
  });

  it('gives one answer for a code the list does not hold, a walk-in with no code included', () => {
    const list = { ...LIST, guests: [...LIST.guests, guest('walk', { walkIn: true })] };

    expect(scanned(list, 'c'.repeat(64))).toEqual({ kind: 'notOnList' });
    expect(scanned(list, '')).toEqual({ kind: 'notOnList' });
  });
});

describe('arrivals waiting to sync (sc-1301)', () => {
  it('shows a waiting arrival as arrived and counts it once', () => {
    const shown = withWaiting(LIST, [ON_SEVEN, { ...ON_SEVEN, guestId: 'obi' }]);

    expect(shown.guests[0]?.arrival).toEqual({ at: ON_SEVEN.at, by: 'Ana' });
    expect(shown.guests[0]?.companions[0]?.arrival).not.toBeNull();
    expect(shown.count.attended).toBe(2);
  });

  it('keeps an arrival the list already has, adding nothing to the count', () => {
    const arrival = { at: '2030-11-14T18:50:00+01:00', by: 'Bo' };
    const list = { ...LIST, guests: [{ ...ADAEZE, arrival }], count: { attended: 1, expected: 3 } };

    const shown = withWaiting(list, [ON_SEVEN]);

    expect(shown.guests[0]?.arrival).toEqual(arrival);
    expect(shown.count.attended).toBe(1);
  });

  it('records one arrival a person, the first, and undo takes it back', () => {
    const later = { ...ON_SEVEN, at: '2030-11-14T19:10:00+01:00' };

    expect(waitFor(waitFor([], ON_SEVEN), later)).toEqual([ON_SEVEN]);
    expect(unwait([ON_SEVEN], 'adaeze')).toEqual([]);
  });

  it('sends in order, drops one refused for good, and stops on a failed connection keeping the rest', async () => {
    const obi = { ...ON_SEVEN, guestId: 'obi' };
    const musa = { ...ON_SEVEN, guestId: 'musa' };
    const sent: string[] = [];
    const gone = new Error('gone');
    const offline = new Error('offline');

    const result = await sendWaiting(
      [ON_SEVEN, obi, musa],
      async (arrival) => {
        sent.push(arrival.guestId);
        if (arrival.guestId === 'adaeze') throw gone;
        if (arrival.guestId === 'musa') throw offline;

        return LIST;
      },
      (error) => error === gone,
    );

    expect(sent).toEqual(['adaeze', 'obi', 'musa']);
    expect(result).toEqual({ left: [musa], checkIn: LIST });
  });
});
