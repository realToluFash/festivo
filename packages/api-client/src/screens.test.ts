import { describe, expect, it } from 'vitest';

import { asRoomScreen, asScreenLinks } from './screens.ts';

describe('The room screen’s answer (sc-3897)', () => {
  const named = { eventId: 'ev_1', event: 'Owambe', locale: 'en', at: '2027-03-06T19:40:00+01:00' };

  it('reads each kind with only what its screen shows', () => {
    const coming = [{ id: 'it_1', title: 'Dinner', startsAt: '2027-03-06T20:00:00+01:00' }];

    expect(asRoomScreen({ kind: 'live', ...named, now: null, coming })).toEqual({
      kind: 'live',
      ...named,
      now: null,
      coming,
    });
    expect(asRoomScreen({ kind: 'finished', ...named, coming })).toEqual({
      kind: 'finished',
      ...named,
    });
    expect(asRoomScreen({ kind: 'replaced', at: named.at, event: 'Owambe' })).toEqual({
      kind: 'replaced',
      at: named.at,
    });
  });

  it('refuses a shape it does not know', () => {
    expect(asRoomScreen({ kind: 'live', ...named, now: { id: 1 }, coming: [] })).toBeNull();
    expect(asRoomScreen({ kind: 'later', ...named })).toBeNull();
    expect(asScreenLinks({ links: [{ place: null }] })).toBeNull();
    expect(asScreenLinks({ links: [{ place: null, token: 't', replacedAt: null }] })).toEqual([
      { place: null, token: 't', replacedAt: null },
    ]);
  });
});
