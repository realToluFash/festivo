import { describe, expect, it } from 'vitest';

import {
  type InvitationOutcome,
  invitationRefusal,
  invitationWording,
  refusalBody,
  waitingInvitations,
} from './invitations.ts';

describe('invitations waiting in the product', () => {
  const two = [{ id: 'adw' }, { id: 'kbc' }];

  it('counts every invitation still to be answered, a failed or unfinished press included', () => {
    const outcomes: Record<string, InvitationOutcome> = { adw: { kind: 'failed' } };

    expect(waitingInvitations(two, outcomes)).toBe(2);
    expect(waitingInvitations(two, { adw: { kind: 'busy', answer: 'accept' } })).toBe(2);
  });

  it('stops counting one once it is answered or refused', () => {
    expect(
      waitingInvitations(two, {
        adw: { kind: 'accepted', organisationId: 'org_9' },
        kbc: { kind: 'refused', refusal: 'invitation_expired' },
      }),
    ).toBe(0);
    expect(waitingInvitations(two, { kbc: { kind: 'declined' } })).toBe(1);
  });

  it('reads the refusal a stale invitation is answered with, and nothing else', () => {
    expect(invitationRefusal((code) => code === 'invitation_revoked')).toBe('invitation_revoked');
    expect(invitationRefusal((code) => code === 'organisation_deleted')).toBe(
      'organisation_deleted',
    );
    expect(invitationRefusal(() => false)).toBeNull();
  });

  it('names the inviter while there is one, and the address only when it is another', () => {
    expect(
      invitationWording({
        invitedBy: { name: 'Bisi Adeyemi' },
        email: 'folake@ire.events',
        signedInAs: 'folake@ire.events',
      }),
    ).toEqual({
      line: 'invitations.from',
      until: 'invitations.until',
      declineNote: 'invitations.declineNote',
      declined: 'invitations.declined',
    });
    expect(
      invitationWording({
        invitedBy: null,
        email: 'folake.o@gmail.com',
        signedInAs: 'folake@ire.events',
      }),
    ).toEqual({
      line: 'invitations.fromNobody',
      until: 'invitations.untilSentTo',
      declineNote: 'invitations.declineNoteNobody',
      declined: 'invitations.declinedNobody',
    });
  });

  it('asks whoever invited you only where a refusal would otherwise name the inviter', () => {
    expect(refusalBody('invitation_expired', false)).toBe(
      'invitations.refused.invitation_expired.bodyNobody',
    );
    expect(refusalBody('invitation_expired', true)).toBe(
      'invitations.refused.invitation_expired.body',
    );
    expect(refusalBody('invitation_revoked', false)).toBe(
      'invitations.refused.invitation_revoked.body',
    );
  });
});
