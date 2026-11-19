import type { MembersList, OrganisationMember } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  membersAfterWrite,
  withApproved,
  withRemoved,
  withRestored,
  withRole,
  withTurnedDown,
} from './membersAfterWrite.ts';
import { membersListOf } from '../test-members.ts';

const member = (id: string): OrganisationMember => ({
  id,
  user: { id: `user_${id}`, name: id, email: null },
  role: { id: 'role_coordinator', seededAs: 'coordinator', name: null },
  status: 'active',
  former: null,
  channel: 'join_code',
  message: null,
  since: null,
  removesAt: null,
  invitedBy: null,
  invitedAt: null,
  self: false,
  history: [],
  suspension: null,
  alsoMemberOf: null,
});

const list: MembersList = membersListOf([member('m1'), member('m2')]);
const unreadable = async (): Promise<MembersList> => {
  throw new Error('offline');
};

describe('the members list after a write that landed', () => {
  it('is the list read again when that read works', async () => {
    const fresh: MembersList = membersListOf([member('m3')]);

    expect(await membersAfterWrite(async () => fresh, list, withRemoved('m1'))).toBe(fresh);
  });

  it('still shows the removal when the read fails', async () => {
    const after = await membersAfterWrite(unreadable, list, withRemoved('m1'));

    expect(after.members[0]).toMatchObject({ status: 'left_or_removed', former: 'removed' });
    expect(after.members[1]).toEqual(member('m2'));
  });

  it('still shows the new role when the read fails', async () => {
    const role = { id: 'role_admin', seededAs: 'administrator', name: null };
    const after = await membersAfterWrite(unreadable, list, withRole('m2', role));

    expect(after.members[1]?.role).toEqual(role);
    expect(after.members[0]).toEqual(member('m1'));
  });

  it('still shows an approval or a turn-down when the read fails', async () => {
    const waiting = membersListOf(
      [
        {
          ...member('m1'),
          status: 'pending_approval',
          removesAt: { at: '2026-11-11T08:40:00+00:00', written: 'Wednesday, Nov 11 at 09:40 WAT' },
        },
      ],
      'waiting',
    );
    const role = { id: 'role_read_only', seededAs: 'read_only', name: null };

    expect(
      (await membersAfterWrite(unreadable, waiting, withApproved('m1', role))).members[0],
    ).toMatchObject({
      status: 'active',
      role,
      removesAt: null,
    });
    expect(
      (await membersAfterWrite(unreadable, waiting, withTurnedDown('m1'))).members[0],
    ).toMatchObject({
      status: 'left_or_removed',
      former: 'removed',
      removesAt: null,
    });
  });

  it('takes an approval off Waiting and into the counts when the read fails (sc-49170)', async () => {
    const asked = { ...member('m1'), status: 'pending_approval' as const };
    const role = { id: 'role_owner', seededAs: 'owner', name: null };
    const after = await membersAfterWrite(
      unreadable,
      membersListOf([asked, member('m2')]),
      withApproved('m1', role),
    );

    expect(after.waiting).toEqual([]);
    expect(after.counts).toEqual({ all: 2, active: 2, waiting: 0, suspended: 0, former: 0 });
    expect(after.owners).toBe(1);
  });

  it('still shows a restore when the read fails', async () => {
    const suspended = membersListOf([
      {
        ...member('m1'),
        status: 'suspended',
        suspension: {
          reason: 'manual',
          domain: null,
          since: { at: '2026-10-20T08:40:00+00:00', written: 'Tuesday, Oct 20 at 09:40 WAT' },
          removesAt: null,
          onlyOwner: false,
        },
      },
    ]);

    expect(
      (await membersAfterWrite(unreadable, suspended, withRestored('m1'))).members[0],
    ).toMatchObject({ status: 'active', suspension: null, role: member('m1').role });
  });
});
