import { ApiError, type InvitationPreview } from '@soirely/api-client';
import { type InvitationOutcome, invitationRefusal } from '@soirely/domain';

import { api } from './api.ts';
import { joinOrganisation, settleInvitation, useSignedIn } from './signedIn.ts';

export interface WaitingInvitations {
  invitations: readonly InvitationPreview[];
  outcomes: Readonly<Record<string, InvitationOutcome>>;
  answer: (invitation: InvitationPreview, choice: 'accept' | 'decline') => Promise<void>;
}

/** The invitations to any verified address of this account, read with the account, so every frame on the stack shows the same ones. */
export function useWaitingInvitations(): WaitingInvitations {
  const { invitations, invitationOutcomes } = useSignedIn();

  return { invitations, outcomes: invitationOutcomes, answer: answerInvitation };
}

async function answerInvitation(
  invitation: InvitationPreview,
  choice: 'accept' | 'decline',
): Promise<void> {
  settleInvitation(invitation.id, { kind: 'busy', answer: choice });

  try {
    if (choice === 'accept') {
      const membership = await api.acceptInvitation(invitation.id);
      joinOrganisation(membership);
      settleInvitation(invitation.id, { kind: 'accepted', organisationId: membership.id });
    } else {
      await api.declineInvitation(invitation.id);
      settleInvitation(invitation.id, { kind: 'declined' });
    }
  } catch (error) {
    const refusal = error instanceof ApiError ? invitationRefusal((code) => error.is(code)) : null;

    settleInvitation(
      invitation.id,
      refusal == null ? { kind: 'failed' } : { kind: 'refused', refusal },
    );
  }
}
