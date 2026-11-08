import { describe, expect, it } from 'vitest';

import {
  answeringInvitation,
  type InvitationOutcome,
  invitationRefusal,
  invitationWording,
  organisationStep,
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

  it('holds a save while any accept or decline is in flight, and only then', () => {
    expect(answeringInvitation({})).toBe(false);
    expect(
      answeringInvitation({
        adw: { kind: 'accepted', organisationId: 'org_9' },
        kbc: { kind: 'busy', answer: 'accept' },
      }),
    ).toBe(true);
    expect(answeringInvitation({ kbc: { kind: 'busy', answer: 'decline' } })).toBe(true);
    expect(
      answeringInvitation({
        adw: { kind: 'failed' },
        kbc: { kind: 'refused', refusal: 'invitation_expired' },
      }),
    ).toBe(false);
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

describe('Your organisation, with invitations and domain offers', () => {
  const base = {
    needsOrganisation: true,
    invitations: 0,
    stillOpen: 0,
    offers: 0,
    own: false,
    joined: false,
  };

  it.each([
    // invitations, still open, offers, own, joined → heading, rows, single, offers, fields
    [1, 1, 0, false, false, 'invited', false, true, false, false],
    [1, 1, 1, false, false, 'invited', false, true, false, false],
    [1, 0, 0, false, false, 'organisation', false, true, false, true],
    [1, 0, 1, false, false, 'offers', false, true, true, false],
    [1, 0, 0, false, true, 'invited', false, true, false, false],
    [1, 1, 1, true, false, 'organisation', false, false, false, true],
    [2, 2, 0, false, false, 'invited', true, false, false, false],
    [2, 1, 1, false, false, 'invited', true, false, false, false],
    [2, 0, 0, false, false, 'organisation', true, false, false, true],
    [2, 0, 2, false, false, 'offers', true, false, true, false],
    [2, 0, 0, false, true, 'invited', true, false, false, false],
    [2, 2, 1, true, false, 'organisation', false, false, false, true],
    [0, 0, 1, false, false, 'offers', false, false, true, false],
    [0, 0, 1, true, false, 'organisation', false, false, false, true],
    [0, 0, 0, false, false, 'organisation', false, false, false, true],
  ] as const)(
    '%i invitation(s), %i open, %i offer(s), own %s, joined %s: %s',
    (invitations, stillOpen, offers, own, joined, heading, rows, single, showsOffers, fields) => {
      const step = organisationStep({ ...base, invitations, stillOpen, offers, own, joined });

      expect(step.heading).toBe(heading);
      expect(step.listsInvitations).toBe(rows);
      expect(step.showsSingleInvitation).toBe(single);
      expect(step.showsOffers).toBe(showsOffers);
      expect(step.asksForOrganisation).toBe(fields);
    },
  );

  it('keeps the rows and their notices once the last invitation is answered any way but joining', () => {
    const step = organisationStep({ ...base, invitations: 2, stillOpen: 0 });

    expect(step.invited).toBe(false);
    expect(step.listsInvitations).toBe(true);
  });

  it('offers one domain organisation as a panel only while no invitation is open', () => {
    expect(organisationStep({ ...base, offers: 1 }).singleOffer).toBe(true);
    expect(organisationStep({ ...base, invitations: 1, stillOpen: 1, offers: 1 }).singleOffer).toBe(
      false,
    );
  });
});
