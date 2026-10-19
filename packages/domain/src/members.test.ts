import { describe, expect, it } from 'vitest';

import { historyLine, memberIsShown } from './members.ts';

describe('which members a chip lists', () => {
  it('lists everybody but former members under All', () => {
    expect(memberIsShown('active', 'all')).toBe(true);
    expect(memberIsShown('pending_approval', 'all')).toBe(true);
    expect(memberIsShown('suspended', 'all')).toBe(true);
    expect(memberIsShown('left_or_removed', 'all')).toBe(false);
  });

  it('lists left and removed only under Former', () => {
    expect(memberIsShown('left_or_removed', 'former')).toBe(true);
    expect(memberIsShown('active', 'former')).toBe(false);
  });

  it('lists no membership under Invited, which is invitations', () => {
    expect(memberIsShown('active', 'invited')).toBe(false);
    expect(memberIsShown('pending_approval', 'invited')).toBe(false);
  });
});

describe('how a member got here', () => {
  it('words an entry by its channel', () => {
    expect(historyLine({ from: null, to: 'active', channel: 'join_code', by: 'u1' }, 'u1')).toEqual(
      { key: 'joined.join_code', named: false },
    );
    expect(
      historyLine({ from: null, to: 'pending_approval', channel: 'request', by: 'u1' }, 'u1'),
    ).toEqual({ key: 'asked.request', named: false });
  });

  it('tells leaving from being removed by who caused it', () => {
    const step = { from: 'active', to: 'left_or_removed', channel: 'invitation' } as const;

    expect(historyLine({ ...step, by: 'u1' }, 'u1')).toEqual({ key: 'left', named: false });
    expect(historyLine({ ...step, by: 'u2' }, 'u1')).toEqual({ key: 'removed', named: true });
    expect(historyLine({ ...step, by: null }, 'u1')).toEqual({ key: 'removed', named: true });
  });

  it('names who suspended, restored and approved', () => {
    expect(
      historyLine({ from: 'active', to: 'suspended', channel: 'join_code', by: 'u2' }, 'u1').key,
    ).toBe('suspended');
    expect(
      historyLine({ from: 'suspended', to: 'active', channel: 'join_code', by: 'u2' }, 'u1').key,
    ).toBe('restored');
    expect(
      historyLine({ from: 'pending_approval', to: 'active', channel: 'request', by: 'u2' }, 'u1')
        .key,
    ).toBe('approved');
  });

  it('words re-joining as joining, through the channel used the second time', () => {
    expect(
      historyLine({ from: 'left_or_removed', to: 'active', channel: 'invitation', by: 'u1' }, 'u1')
        .key,
    ).toBe('joined.invitation');
  });
});
