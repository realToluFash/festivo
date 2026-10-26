import { describe, expect, it } from 'vitest';

import {
  approvalRoles,
  historyLine,
  memberChannelWords,
  memberHeldNoRole,
  memberIsShown,
  memberRowLine,
  memberRowVerb,
  memberStanding,
  memberStatusWord,
} from './members.ts';

describe('which members a chip lists', () => {
  it('lists active and suspended members under All, with nobody awaiting approval twice', () => {
    expect(memberIsShown('active', 'all')).toBe(true);
    expect(memberIsShown('pending_approval', 'all')).toBe(false);
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

  it('tells a request turned down from one nobody answered', () => {
    const step = { from: 'pending_approval', to: 'left_or_removed', channel: 'settings' } as const;

    expect(historyLine({ ...step, by: 'u2' }, 'u1')).toEqual({ key: 'turnedDown', named: true });
    expect(historyLine({ ...step, by: null }, 'u1')).toEqual({
      key: 'requestExpired',
      named: false,
    });
    expect(historyLine({ ...step, by: 'u1' }, 'u1')).toEqual({ key: 'left', named: false });
  });

  it('offers Read-only first and never Owner when approving', () => {
    const roles = [
      { id: 'r1', seededAs: 'owner' },
      { id: 'r2', seededAs: 'administrator' },
      { id: 'r5', seededAs: 'read_only' },
      { id: 'r6', seededAs: null },
    ];

    expect(approvalRoles(roles).map((role) => role.id)).toEqual(['r5', 'r2', 'r6']);
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

  it('names nobody for a domain suspension, whoever or whatever triggered it', () => {
    for (const by of ['u1', 'u2', null]) {
      expect(historyLine({ from: 'active', to: 'suspended', channel: 'domain', by }, 'u1')).toEqual(
        { key: 'suspendedAddressGone', named: false },
      );
    }
  });

  it('words re-joining as joining, through the channel used the second time', () => {
    expect(
      historyLine({ from: 'left_or_removed', to: 'active', channel: 'invitation', by: 'u1' }, 'u1')
        .key,
    ).toBe('joined.invitation');
  });

  it('words a waiting member accepting an invitation as accepting it, not as an approval', () => {
    expect(
      historyLine({ from: 'pending_approval', to: 'active', channel: 'invitation', by: 'u1' }, 'u1')
        .key,
    ).toBe('joined.invitation');
  });
});

describe("what a member's page offers", () => {
  const member = (
    seededAs: string,
    status: 'active' | 'suspended' | 'left_or_removed' = 'active',
    self = false,
  ) => ({
    self,
    status,
    role: { id: seededAs, seededAs },
  });
  const owner = member('owner');
  const secondOwner = member('owner');
  const coordinator = member('coordinator');
  const you = member('administrator', 'active', true);
  const admin = { owns: false, manages: true, withholds: [{ id: 'owner' }, { id: 'finance' }] };
  const anOwner = { owns: true, manages: true, withholds: [] };

  it('offers nothing on your own page', () => {
    expect(memberStanding(you, [owner, you], admin)).toBe('self');
    expect(memberStanding(member('members desk', 'active', true), [owner], admin)).toBe('self');
  });

  it("tells an owner's own page from anybody else's", () => {
    const yourself = member('owner', 'active', true);

    expect(memberStanding(yourself, [owner, yourself], anOwner)).toBe('selfOwner');
    expect(memberStanding(yourself, [yourself], anOwner)).toBe('selfOwner');
  });

  it('keeps the only active owner as they are, whoever looks', () => {
    expect(memberStanding(owner, [owner, you, coordinator], anOwner)).toBe('onlyOwner');
    expect(memberStanding(owner, [owner, member('owner', 'suspended')], anOwner)).toBe('onlyOwner');
  });

  it('lets anyone who manages members restore or remove the suspended only owner', () => {
    const suspended = { ...member('owner', 'suspended'), suspension: { onlyOwner: true } };

    expect(memberStanding(suspended, [suspended, you], admin)).toBe('suspendedOnlyOwner');
    expect(memberStanding(suspended, [suspended, you], anOwner)).toBe('suspendedOnlyOwner');
    expect(
      memberStanding(suspended, [suspended, you], { owns: false, manages: false, withholds: [] }),
    ).toBe('readOnly');
    expect(
      memberStanding({ ...suspended, suspension: { onlyOwner: false } }, [suspended, owner], admin),
    ).toBe('ownerOnly');
  });

  it('lets an owner change or remove a second owner, and nobody else', () => {
    expect(memberStanding(secondOwner, [owner, secondOwner], anOwner)).toBe('manageable');
    expect(memberStanding(secondOwner, [owner, secondOwner], admin)).toBe('ownerOnly');
  });

  it('shows the role only to somebody without members.manage', () => {
    const reader = { owns: false, manages: false, withholds: [] };

    expect(memberStanding(coordinator, [owner, coordinator], reader)).toBe('readOnly');
    expect(memberStanding(secondOwner, [owner, secondOwner], reader)).toBe('readOnly');
  });

  it('shows a former member read-only, even to an owner', () => {
    const former = member('coordinator', 'left_or_removed');

    expect(memberStanding(former, [owner, former], anOwner)).toBe('readOnly');
    expect(memberStanding(former, [owner, former], admin)).toBe('readOnly');
    expect(memberStanding(member('finance', 'left_or_removed'), [owner], admin)).toBe('readOnly');
  });

  it('fixes the role of a member whose role holds a permission the viewer lacks', () => {
    const finance = member('finance');
    const suspended = { ...member('finance', 'suspended'), suspension: { onlyOwner: false } };

    expect(memberStanding(finance, [owner, finance], admin)).toBe('beyondGrant');
    expect(memberStanding(suspended, [owner, suspended], admin)).toBe('beyondGrant');
    expect(memberStanding(finance, [owner, finance], anOwner)).toBe('manageable');
    expect(
      memberStanding(finance, [owner, finance], { ...anOwner, withholds: [{ id: 'finance' }] }),
    ).toBe('manageable');
    expect(memberStanding(finance, [owner, finance], { ...admin, manages: false })).toBe(
      'readOnly',
    );
  });

  it('leaves a role the loaded catalogue lacks to the picker and the API', () => {
    expect(memberStanding(member('door team'), [owner], admin)).toBe('manageable');
  });

  it('keeps the owner line ahead of the grant line', () => {
    expect(memberStanding(secondOwner, [owner, secondOwner], admin)).toBe('ownerOnly');
  });

  it('leaves somebody awaiting approval to be answered, whatever role they hold for now', () => {
    const waiting = { ...member('finance'), status: 'pending_approval' as const };

    expect(memberStanding(waiting, [owner, waiting], admin)).toBe('manageable');
  });

  it('offers a role change and removal for everybody else', () => {
    expect(memberStanding(coordinator, [owner, coordinator], admin)).toBe('manageable');
    expect(memberStanding(member('administrator'), [owner, you], admin)).toBe('manageable');
  });
});

describe("what a member's row says", () => {
  const word = (key: string, values: Record<string, string>) =>
    Object.keys(values).length === 0 ? key : `${key}(${Object.values(values).join(',')})`;
  const member = {
    status: 'active' as const,
    former: null,
    channel: 'join_code' as const,
    since: '2026-10-01T09:00:00Z',
    invitedBy: null,
    self: false,
    role: { seededAs: 'coordinator', name: null },
    history: [],
  };

  it('dates a row by what happened last', () => {
    expect(memberRowVerb(member)).toBe('since');
    expect(memberRowVerb({ ...member, status: 'pending_approval' })).toBe('asked');
    expect(memberRowVerb({ ...member, status: 'suspended' })).toBe('suspended');
    expect(memberRowVerb({ ...member, status: 'left_or_removed', former: 'left' })).toBe('left');
    expect(memberRowVerb({ ...member, status: 'left_or_removed', former: null })).toBe('removed');
  });

  it('names a former member as left or removed', () => {
    expect(memberStatusWord(word, member)).toBe('membersScreen.state.active');
    expect(memberStatusWord(word, { ...member, status: 'left_or_removed', former: 'left' })).toBe(
      'membersScreen.state.left',
    );
    expect(memberStatusWord(word, { ...member, status: 'left_or_removed', former: null })).toBe(
      'membersScreen.state.removed',
    );
  });

  it('says a domain member was suspended because the company address went', () => {
    expect(
      memberStatusWord(word, {
        ...member,
        status: 'suspended',
        suspension: { reason: 'domain_closed' },
      }),
    ).toBe('membersScreen.state.domainSuspended');
    expect(memberStatusWord(word, { ...member, status: 'suspended' })).toBe(
      'membersScreen.state.suspended',
    );
  });

  it('says only Suspended for a member somebody suspended by hand', () => {
    expect(
      memberStatusWord(word, { ...member, status: 'suspended', suspension: { reason: 'manual' } }),
    ).toBe('membersScreen.state.suspended');
  });

  it('names the inviter when there is one', () => {
    const invited = { ...member, channel: 'invitation' as const, invitedBy: { name: 'Ada' } };

    expect(memberChannelWords(word, invited, 'Ìrè')).toBe('membersScreen.how.invitationFrom(Ada)');
    expect(memberChannelWords(word, { ...invited, invitedBy: null }, 'Ìrè')).toBe(
      'membersScreen.how.invitation(Ìrè)',
    );
  });

  it('joins role, you, channel and date', () => {
    expect(memberRowLine(word, { ...member, self: true }, 'Ìrè', () => '1 Oct')).toBe(
      'roles.coordinator · membersScreen.you · membersScreen.how.join_code(Ìrè) · membersScreen.when.since(1 Oct)',
    );
  });

  it('gives somebody awaiting approval no role yet', () => {
    expect(
      memberRowLine(
        word,
        { ...member, status: 'pending_approval', channel: 'request' },
        'Ìrè',
        () => '12 Oct',
      ),
    ).toBe(
      'membersScreen.noRoleYet · membersScreen.how.request(Ìrè) · membersScreen.when.asked(12 Oct)',
    );
  });

  it('gives somebody turned down, withdrawn or expired while awaiting approval no role', () => {
    const asked = { from: null, to: 'pending_approval' as const };
    const turnedDown = { from: 'pending_approval' as const, to: 'left_or_removed' as const };
    const approved = { from: 'pending_approval' as const, to: 'active' as const };
    const removed = { from: 'active' as const, to: 'left_or_removed' as const };
    const former = { ...member, status: 'left_or_removed' as const };

    expect(memberHeldNoRole({ ...former, history: [asked, turnedDown] })).toBe(true);
    expect(memberHeldNoRole({ ...former, history: [asked, approved, removed] })).toBe(false);
    expect(memberHeldNoRole({ ...former, history: [] })).toBe(false);
    expect(memberHeldNoRole({ ...member, history: [asked, approved] })).toBe(false);
    expect(
      memberRowLine(word, { ...former, history: [asked, turnedDown] }, 'Ìrè', () => '12 Oct'),
    ).toMatch(/^membersScreen\.noRoleYet · /);
  });
});
