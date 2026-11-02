/** Why answering an invitation was refused: the list was loaded before the press, so any of these can still happen. */
export type InvitationRefusalCode =
  | 'invitation_expired'
  | 'invitation_revoked'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'organisation_deleted'
  | 'invitation_not_yours';

export const INVITATION_REFUSALS: readonly InvitationRefusalCode[] = [
  'invitation_expired',
  'invitation_revoked',
  'invitation_accepted',
  'invitation_declined',
  'organisation_deleted',
  'invitation_not_yours',
];

export type InvitationOutcome =
  | { kind: 'busy'; answer: 'accept' | 'decline' }
  | { kind: 'failed' }
  | { kind: 'accepted'; organisationId: string }
  | { kind: 'declined' }
  | { kind: 'refused'; refusal: InvitationRefusalCode };

/** Still to be answered: nothing pressed yet, a press in flight, or one that did not reach the API. */
export function isWaiting(outcome: InvitationOutcome | undefined): boolean {
  return outcome == null || outcome.kind === 'busy' || outcome.kind === 'failed';
}

export function waitingInvitations(
  invitations: readonly { id: string }[],
  outcomes: Readonly<Record<string, InvitationOutcome>>,
): number {
  return invitations.filter(({ id }) => isWaiting(outcomes[id])).length;
}

/** An accept or decline still in flight, which a save sent now would race. */
export function answeringInvitation(
  outcomes: Readonly<Record<string, InvitationOutcome>>,
): boolean {
  return Object.values(outcomes).some((outcome) => outcome.kind === 'busy');
}

/** The refusal an error carries, when it is one of the codes a row has words for. */
export function invitationRefusal(
  is: (code: InvitationRefusalCode) => boolean,
): InvitationRefusalCode | null {
  return INVITATION_REFUSALS.find((code) => is(code)) ?? null;
}

export interface InvitationWording {
  line: string;
  until: string;
  declineNote: string;
  declined: string;
}

/** The inviter is null once their account is gone; the address is named only when it is not the one signed in with. */
export function invitationWording(invitation: {
  invitedBy: { name: string } | null;
  email: string;
  signedInAs: string | null;
}): InvitationWording {
  const named = invitation.invitedBy != null;

  return {
    line: named ? 'invitations.from' : 'invitations.fromNobody',
    until:
      invitation.email === invitation.signedInAs ? 'invitations.until' : 'invitations.untilSentTo',
    declineNote: named ? 'invitations.declineNote' : 'invitations.declineNoteNobody',
    declined: named ? 'invitations.declined' : 'invitations.declinedNobody',
  };
}

const NAMES_THE_INVITER: readonly InvitationRefusalCode[] = [
  'invitation_expired',
  'invitation_declined',
];

export function refusalBody(refusal: InvitationRefusalCode, named: boolean): string {
  return !named && NAMES_THE_INVITER.includes(refusal)
    ? `invitations.refused.${refusal}.bodyNobody`
    : `invitations.refused.${refusal}.body`;
}
