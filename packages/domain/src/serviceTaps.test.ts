import { describe, expect, it } from 'vitest';

import { needsConnection, refusalKey, tapKind, tapOutcome, tapRefusals } from './serviceTaps.ts';

const ERRORS = 'https://soirely.com/errors/';

describe('which taps need a connection', () => {
  it('keeps a step and refuses a tray start or a tick on a flagged guest', () => {
    expect(needsConnection(tapKind('check'))).toBe(false);
    expect(needsConnection(tapKind('tick'))).toBe(false);
    expect(needsConnection(tapKind('tick', true))).toBe(true);
    expect(needsConnection('startTray')).toBe(true);
  });
});

describe('a refused tap', () => {
  it('names each plate as it is now, off the tray or at another stage, and who moved it', () => {
    const lines = tapRefusals({
      type: `${ERRORS}service_changed`,
      title: 'Changed',
      changed: [
        {
          plateId: 'p1',
          guestId: 'g1',
          table: '4',
          stage: 'toServe',
          onTray: false,
          by: 'Ifeoma Nduka',
        },
        { plateId: 'p2', guestId: 'g2', table: '4', stage: 'served', onTray: true, by: null },
        { item: 'plantain', state: 'preparing', by: 'Bisi' },
        'nonsense',
      ],
    });

    expect(lines).toEqual([
      { kind: 'offTray', plateId: 'p1', guestId: 'g1', table: '4', by: 'Ifeoma Nduka' },
      { kind: 'stageNow', plateId: 'p2', guestId: 'g2', table: '4', stage: 'served', by: null },
      { kind: 'itemNow', item: 'plantain', state: 'preparing', by: 'Bisi' },
    ]);
    expect(lines.map(refusalKey)).toEqual([
      'service.notSent.offTray',
      'service.notSent.stageNowUnnamed.served',
      'service.notSent.itemNow.preparing',
    ]);
  });

  it('reads a tray taken by someone else and an undo too late, and anything else by its title', () => {
    expect(
      tapRefusals({ type: `${ERRORS}tray_not_yours`, title: 't', waiter: { name: 'Bisi' } }),
    ).toEqual([{ kind: 'trayNotYours', name: 'Bisi' }]);
    expect(tapRefusals({ type: `${ERRORS}undo_expired`, title: 't' })).toEqual([
      { kind: 'undoExpired' },
    ]);
    expect(tapRefusals({ type: `${ERRORS}forbidden`, title: 'Not allowed' })).toEqual([
      { kind: 'other', title: 'Not allowed' },
    ]);
  });

  it('drops a refusal, keeps a tap with no answer, a 5xx or a lapsed sign-in, and waits on a 429', () => {
    expect([200, 204, 409, 422, 403, 401, 500, 503, null, 429].map(tapOutcome)).toEqual([
      'answered',
      'answered',
      'refused',
      'refused',
      'refused',
      'keep',
      'keep',
      'keep',
      'keep',
      'wait',
    ]);
  });
});
