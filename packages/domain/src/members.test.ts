import { describe, expect, it } from 'vitest';

import { historyLine, memberIsShown, memberStanding } from './members.ts';

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

describe("what a member's page offers", () => {
  const member = (seededAs: string, status: 'active' | 'suspended' = 'active', self = false) => ({
    self,
    status,
    role: { seededAs },
  });
  const owner = member('owner');
  const secondOwner = member('owner');
  const coordinator = member('coordinator');
  const you = member('administrator', 'active', true);
  const admin = { owns: false, manages: true };
  const anOwner = { owns: true, manages: true };

  it('offers nothing on your own page', () => {
    expect(memberStanding(you, [owner, you], anOwner)).toBe('self');
  });

  it('keeps the only active owner as they are, whoever looks', () => {
    expect(memberStanding(owner, [owner, you, coordinator], anOwner)).toBe('onlyOwner');
    expect(memberStanding(owner, [owner, member('owner', 'suspended')], anOwner)).toBe('onlyOwner');
  });

  it('lets an owner change or remove a second owner, and nobody else', () => {
    expect(memberStanding(secondOwner, [owner, secondOwner], anOwner)).toBe('manageable');
    expect(memberStanding(secondOwner, [owner, secondOwner], admin)).toBe('ownerOnly');
  });

  it('shows the role only to somebody without members.manage', () => {
    const reader = { owns: false, manages: false };

    expect(memberStanding(coordinator, [owner, coordinator], reader)).toBe('readOnly');
    expect(memberStanding(secondOwner, [owner, secondOwner], reader)).toBe('readOnly');
  });

  it('offers a role change and removal for everybody else', () => {
    expect(memberStanding(coordinator, [owner, coordinator], admin)).toBe('manageable');
  });
});
